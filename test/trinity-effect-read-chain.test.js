// Stage 6a: prove the Trinity read chain reaches the same pipeline the fixture
// hook hands the dispatcher today, using real Trinity types rather than stand-ins.
//
// No loader exists yet - nothing anywhere writes Tr2Effect.effectResource - so the
// resource is assigned by hand. That is the honest boundary of this gate: it shows
// that once something does write it, effect -> GetEffectRes() -> package ->
// pipeline resolves to exactly what the harness resolves directly. It does not
// pretend the loader exists, and it never touches a GPU.
//
// Two payload shapes appear here, and the difference matters:
//
//   - Tr2EffectRes (runtime-resource) takes a real CewgpuPackage - the raw-emit
//     reader object, which implements GetPortableEffectReflection - and resolves
//     a real Tr2Shader from it. That needs package bytes, so it is env-gated.
//   - The engine's own CjsWebGPUPackage is NOT a valid Tr2EffectRes payload:
//     normalizePackageShape drops permutationGraph and reflection, which is
//     exactly what validateEffectPayload requires. A loader must therefore hand
//     Tr2EffectRes the reader package, not the engine package. Asserted below so
//     the constraint is pinned rather than rediscovered.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Tr2Effect } from "@carbonenginejs/runtime-trinity/shader";
import {
  Tr2RenderBatch,
  TriRenderBatchAccumulator,
  TriRenderBatchMap
} from "@carbonenginejs/runtime-trinity/trinityCore";
import { TriBatchType } from "@carbonenginejs/runtime-trinity/generated/trinityCore";

import { CjsWebGPUPackage } from "../src/index.js";
import { CjsWebGPUTrinityBatchDispatcher } from "../src/core/trinityBatchDispatcher.js";

const TRIANGLE_LIST = 4;

const FIXTURE_DIR = process.env.CJS_WEBGPU_FIXTURE_DIR || null;
const FIXTURE_STEM = process.env.CJS_WEBGPU_FIXTURE_STEM || "unpacked_quadv5.sm_hi";

async function readerModules()
{
  const [ shader, webgpu ] = await Promise.all([
    import("@carbonenginejs/runtime-resource/resource/shader"),
    import("@carbonenginejs/runtime-resource/formats/webgpu")
  ]);
  return { Tr2EffectRes: shader.Tr2EffectRes, CjsWebgpuFormat: webgpu.CjsWebgpuFormat };
}

function canonicalPackage()
{
  const bindings = [ {
    resourceKind: "uniform-buffer",
    generatedSymbol: "cb0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding: 0,
    visibility: [ "fragment" ],
    type: "array<vec4<f32>, 3>",
    buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 48 }
  }, {
    resourceKind: "sampled-resource",
    generatedSymbol: "t0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding: 1,
    visibility: [ "fragment" ],
    type: "texture_2d<f32>",
    texture: { sampleType: "float", viewDimension: "2d", multisampled: false }
  } ];
  return CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    sourcePath: "res:/fixture/trinity-read-chain.cewgpu",
    analysis: {
      source: "res:/fixture/trinity-read-chain.cewgpu",
      passes: [ {
        techniqueName: "Main",
        passIndex: 0,
        renderStates: 1,
        states: []
      } ],
      stages: []
    },
    stages: [ {
      key: "Main.pass0.vertex",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "vertex",
      stageType: 0,
      bindings: []
    }, {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings: []
    } ],
    layouts: [ {
      key: "Main.pass0",
      bindGroups: [ { group: 0, bindings } ]
    } ]
  });
}

// The seam is Tr2Effect.RebuildCachedDataInternal, which duck-types the assigned
// resource: GetShader(options), then getShader(options), then .shader. Nothing
// requires a Tr2EffectRes class - there isn't one in runtime-trinity - so a
// package-carrying resource satisfies it directly.
function effectResourceFor(pkg)
{
  return {
    package: pkg,
    GetShader()
    {
      return pkg;
    }
  };
}

function opaqueBatchFor(effect, geometry)
{
  const batch = new Tr2RenderBatch();
  batch.material = effect;
  batch.shader = effect.shader;
  batch.SetGeometrySource(geometry, 0, 0, 1, false);
  batch.topology = TRIANGLE_LIST;
  batch.indexCountPerInstance = 36;
  batch.instanceCount = 1;
  return batch;
}

function boundary()
{
  const calls = [];
  return {
    calls,
    webgpu: {
      async PreparePipeline(pipeline, prepareOptions)
      {
        calls.push([ "PreparePipeline", pipeline, prepareOptions ]);
        return { pipeline, diagnostics: [] };
      },
      async CreateRenderPipeline(prepared, recipe)
      {
        calls.push([ "CreateRenderPipeline", prepared, recipe ]);
        return { prepared, recipe };
      },
      CreateBindingSet()
      {
        return { Destroy() {} };
      },
      CreateDraw(livePipeline, values)
      {
        return { livePipeline, values };
      },
      EncodeDraw(pass, draw)
      {
        calls.push([ "EncodeDraw", pass, draw ]);
      }
    }
  };
}

test("a real Tr2Effect resolves the package pipeline the fixture hook returns", () =>
{
  const pkg = canonicalPackage();
  const direct = pkg.GetPipeline("Main", 0);
  assert.ok(direct, "the package must expose Main.pass0");

  const effect = new Tr2Effect();
  assert.equal(effect.GetEffectRes(), null, "an effect starts with no resource");

  effect.effectResource = effectResourceFor(pkg);
  effect.RebuildCachedData();

  // The chain the loader will one day drive, walked by hand.
  const resource = effect.GetEffectRes();
  assert.ok(resource, "GetEffectRes must return the assigned resource");
  assert.equal(resource.package, pkg);
  assert.equal(effect.shader, pkg, "the duck-typed GetShader must resolve the package");

  const throughChain = effect.GetEffectRes().package.GetPipeline("Main", 0);
  assert.deepEqual(
    throughChain.ToJSON(),
    direct.ToJSON(),
    "the traversed pipeline must equal the one resolved directly from the package"
  );
});

test("a real Tr2RenderBatch carries the effect through a real accumulator", () =>
{
  const pkg = canonicalPackage();
  const effect = new Tr2Effect();
  effect.effectResource = effectResourceFor(pkg);
  effect.RebuildCachedData();

  const batch = opaqueBatchFor(effect, { id: "geometry" });
  assert.equal(batch.IsValid(), true, "a batch is valid once its shader resolves");
  assert.equal(batch.material, effect);

  const accumulator = new TriRenderBatchAccumulator();
  assert.equal(accumulator.Commit(batch), true);
  accumulator.Finalize();

  assert.equal(accumulator.GetBatchCount(), 1);
  assert.equal(accumulator.GetBatches()[0], batch, "the accumulator holds the batch itself");

  // The GDPR path needs an index buffer, and SetGeometrySource never sets one -
  // it records a geometry-resource descriptor instead. Asserted rather than
  // assumed, because a batch that silently took that path would never reach the
  // dispatcher the engine drives.
  assert.equal(batch.indexBuffer, null);
  assert.deepEqual(accumulator.GetGdprBatches(), []);

  const map = new TriRenderBatchMap([ TriBatchType.TRIBATCHTYPE_OPAQUE ]);
  assert.deepEqual(map.GetBatchTypes(), [ TriBatchType.TRIBATCHTYPE_OPAQUE ]);
  const mapped = map.GetAccumulator(TriBatchType.TRIBATCHTYPE_OPAQUE);
  assert.ok(mapped instanceof TriRenderBatchAccumulator);
  assert.equal(map.GetAccumulator(TriBatchType.TRIBATCHTYPE_TRANSPARENT), null);
});

test("the engine dispatcher reaches the package pipeline through a real batch map", async () =>
{
  const pkg = canonicalPackage();
  const expected = pkg.GetPipeline("Main", 0);

  const effect = new Tr2Effect();
  effect.effectResource = effectResourceFor(pkg);
  effect.RebuildCachedData();

  const geometry = { id: "geometry" };
  const batch = opaqueBatchFor(effect, geometry);

  // A real map and its real accumulator, driven through the engine's own
  // batch-map entry point rather than a single hand-fed batch.
  const map = new TriRenderBatchMap([ TriBatchType.TRIBATCHTYPE_OPAQUE ]);
  const accumulator = map.GetAccumulator(TriBatchType.TRIBATCHTYPE_OPAQUE);
  assert.equal(accumulator.Commit(batch), true);
  map.Finalize();

  const { calls, webgpu } = boundary();
  const resolvedMaterials = [];
  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(webgpu, {
    // The same traversal the fixture hook performs today, except the material is
    // a real Tr2Effect instead of a package record.
    async ResolveMaterial(material, dispatched)
    {
      assert.equal(material, dispatched.material);
      const resolved = material.GetEffectRes().package.GetPipeline("Main", 0);
      resolvedMaterials.push(resolved);
      return {
        pipeline: resolved,
        recipe: {
          vertex: { buffers: [ { arrayStride: 16, attributes: [] } ] },
          fragment: { targets: [ { format: "rgba8unorm" } ] },
          primitive: { cullMode: "none" }
        }
      };
    },
    async ResolveGeometry(source, dispatched)
    {
      assert.equal(source, dispatched.geometrySource);
      assert.equal(source.geometry, geometry, "the geometry source survives the batch");
      return { geometry: { id: "live-geometry" }, indexed: true };
    },
    async ResolveBindings()
    {
      return { uniformData: new Map(), resources: new Map() };
    }
  });

  const handle = await dispatcher.PrepareBatchMap(map);
  dispatcher.EncodeBatchType({ id: "pass" }, handle, TriBatchType.TRIBATCHTYPE_OPAQUE);

  assert.equal(resolvedMaterials.length, 1);
  assert.equal(resolvedMaterials[0], expected, "the dispatcher resolved the package pipeline");

  const prepared = calls.find(([ name ]) => name === "PreparePipeline");
  assert.ok(prepared, "the dispatcher must prepare a pipeline");
  assert.equal(prepared[1], expected, "the prepared pipeline is the package's own Main.pass0");
  assert.deepEqual(prepared[1].ToJSON(), pkg.GetPipeline("Main", 0).ToJSON());

  assert.ok(
    calls.some(([ name ]) => name === "EncodeDraw"),
    "the batch must reach the draw encoder"
  );

  dispatcher.DestroyBatchMap(handle);
});

test("a real Tr2EffectRes resolves a shader from a real CewgpuPackage", async (t) =>
{
  if (!FIXTURE_DIR)
  {
    t.skip("set CJS_WEBGPU_FIXTURE_DIR to a directory holding the built "
      + `${FIXTURE_STEM}-ppt-main.<backend>.cewgpu packages `
      + "(build them per test/fixtures/quadv5/manifest.json)");
    return;
  }

  const { Tr2EffectRes, CjsWebgpuFormat } = await readerModules();
  const path = join(FIXTURE_DIR, `${FIXTURE_STEM}-ppt-main.dx11.cewgpu`);
  const bytes = new Uint8Array(await readFile(path));

  // The raw emit is the CewgpuPackage itself. The default emit is a plain JSON
  // projection without GetPortableEffectReflection, so it would be accepted as a
  // payload and then silently resolve no shader at all - the failure a loader is
  // most likely to ship by accident.
  const reader = CjsWebgpuFormat.read(bytes, { source: path, emit: CjsWebgpuFormat.OUTPUT_RAW });
  assert.equal(typeof reader.GetPortableEffectReflection, "function");

  const resource = new Tr2EffectRes();
  resource.SetPayload(reader);

  const effect = new Tr2Effect();
  effect.effectResource = resource;
  effect.RebuildCachedData();

  assert.equal(effect.GetEffectRes(), resource);
  assert.ok(effect.shader, "the effect must resolve a shader through Tr2EffectRes");
  assert.equal(effect.shader.constructor.name, "Tr2Shader");
  assert.equal(resource.GetShader([]).constructor.name, "Tr2Shader");

  // The engine package built from the same bytes carries the pipeline the
  // dispatcher consumes; the reader package carries the shader reflection. A
  // loader has to produce both, from one read.
  const enginePackage = CjsWebGPUPackage.fromBytes(bytes, {
    source: path,
    read: CjsWebgpuFormat.read
  });
  const pipeline = enginePackage.GetPipeline("Main", 0);
  assert.ok(pipeline, "the engine package must expose Main.pass0");

  // Pins why the two cannot be collapsed: the engine package drops exactly the
  // fields Tr2EffectRes validates, so handing it over fails closed rather than
  // resolving a shaderless effect.
  assert.equal(enginePackage.permutationGraph, undefined);
  assert.throws(
    () => new Tr2EffectRes().SetPayload(enginePackage),
    /permutation graph, permutations array, or one portable reflection/u,
    "the engine package must not be accepted as a Tr2EffectRes payload"
  );
});
