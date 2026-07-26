import assert from "node:assert/strict";
import test from "node:test";

import { CjsWebGPUTrinityBatchDispatcher } from "../src/core/trinityBatchDispatcher.js";

function indexedBatch(overrides = {})
{
  return {
    material: { id: "material" },
    geometrySource: { id: "geometry" },
    objectData: { id: "object-data" },
    topology: 4,
    indexCountPerInstance: 36,
    instanceCount: 2,
    startIndexLocation: 3,
    baseVertexLocation: 0xffffffff,
    startInstanceLocation: 1,
    ...overrides
  };
}

function mockBoundary(options = {})
{
  const calls = [];
  const bindingSets = [];
  const webgpu = {
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
    CreateBindingSet(livePipeline, values)
    {
      calls.push([ "CreateBindingSet", livePipeline, values ]);
      const bindingSet = {
        destroyed: 0,
        Destroy()
        {
          this.destroyed += 1;
        }
      };
      bindingSets.push(bindingSet);
      return bindingSet;
    },
    CreateDraw(livePipeline, values)
    {
      calls.push([ "CreateDraw", livePipeline, values ]);
      if (options.rejectDraw || options.rejectDrawAt === bindingSets.length)
      {
        throw new Error("draw rejected");
      }
      return { livePipeline, values };
    },
    EncodeDraw(pass, draw)
    {
      calls.push([ "EncodeDraw", pass, draw ]);
    }
  };
  return { bindingSets, calls, webgpu };
}

function hooks(indexed = true)
{
  return {
    async ResolveMaterial(material, batch)
    {
      assert.equal(material, batch.material);
      return {
        pipeline: { key: "Main.pass0" },
        recipe: {
          vertex: { buffers: [ { arrayStride: 16, attributes: [] } ] },
          fragment: { targets: [ { format: "rgba8unorm" } ] },
          primitive: { cullMode: "none" }
        }
      };
    },
    async ResolveGeometry(source, batch)
    {
      assert.equal(source, batch.geometrySource);
      return {
        geometry: { id: "live-geometry" },
        indexed
      };
    },
    async ResolveBindings(batch, livePipeline)
    {
      assert.equal(batch.objectData.id, "object-data");
      assert.equal(livePipeline.recipe.primitive.topology, "triangle-list");
      return {
        uniformData: new Map([ [ "cb0", new Float32Array(4) ] ]),
        resources: new Map([ [ "t0", { id: "texture" } ] ])
      };
    }
  };
}

test("Trinity batch dispatcher resolves an indexed batch without importing Trinity", async () =>
{
  const { bindingSets, calls, webgpu } = mockBoundary();
  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(webgpu, hooks());
  const batch = indexedBatch();
  const handle = await dispatcher.Prepare(batch);

  assert.equal(handle.batch, batch);
  assert.equal(calls[1][2].primitive.topology, "triangle-list");
  assert.deepEqual(calls[3][2].draw, {
    indexCount: 36,
    instanceCount: 2,
    firstIndex: 3,
    baseVertex: -1,
    firstInstance: 1
  });

  const pass = { id: "pass" };
  dispatcher.Encode(pass, handle);
  assert.deepEqual(calls.at(-1), [ "EncodeDraw", pass, handle.draw ]);
  dispatcher.Destroy(handle);
  dispatcher.Destroy(handle);
  assert.equal(bindingSets[0].destroyed, 1);
  assert.throws(() => dispatcher.Encode(pass, handle), /prepared batch is destroyed/u);
});

test("Trinity batch dispatcher maps non-indexed batches and owns rollback", async () =>
{
  const success = mockBoundary();
  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(success.webgpu, hooks(false));
  const prepared = await dispatcher.Prepare(indexedBatch({
    indexCountPerInstance: 13,
    instanceCount: 1,
    startIndexLocation: 4,
    baseVertexLocation: 0
  }));
  assert.deepEqual(success.calls[3][2].draw, {
    vertexCount: 13,
    instanceCount: 1,
    firstVertex: 4,
    firstInstance: 1
  });
  dispatcher.Destroy(prepared);
  assert.equal(success.bindingSets[0].destroyed, 1);

  const rejected = mockBoundary({ rejectDraw: true });
  const rejecting = new CjsWebGPUTrinityBatchDispatcher(rejected.webgpu, hooks());
  await assert.rejects(rejecting.Prepare(indexedBatch()), /draw rejected/u);
  assert.equal(rejected.bindingSets[0].destroyed, 1);
});

test("Trinity batch dispatcher fails closed on unsupported or conflicting contracts", async () =>
{
  const { webgpu } = mockBoundary();
  assert.throws(
    () => new CjsWebGPUTrinityBatchDispatcher(webgpu, {}),
    /composition hooks require ResolveMaterial/u
  );

  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(webgpu, hooks());
  await assert.rejects(dispatcher.Prepare(indexedBatch({ topology: 99 })), /topology 99 is unsupported/u);
  await assert.rejects(
    dispatcher.Prepare(indexedBatch({ geometrySource: null })),
    /geometrySource is required/u
  );

  const conflicting = hooks();
  conflicting.ResolveMaterial = async () => ({
    pipeline: { key: "Main.pass0" },
    recipe: {
      vertex: { buffers: [] },
      fragment: { targets: [] },
      primitive: { topology: "line-list" }
    }
  });
  await assert.rejects(
    new CjsWebGPUTrinityBatchDispatcher(webgpu, conflicting).Prepare(indexedBatch()),
    /batch topology triangle-list conflicts/u
  );
});

test("Trinity batch dispatcher preserves ordinary accumulator order and lifecycle", async () =>
{
  const boundary = mockBoundary();
  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(boundary.webgpu, hooks());
  const first = indexedBatch({ material: { id: "first" }, startIndexLocation: 0 });
  const second = indexedBatch({ material: { id: "second" }, startIndexLocation: 36 });
  const accumulator = {
    GetGdprBatches: () => [],
    GetBatches: () => [ first, second ],
    GetBatchCount: () => 2
  };
  const prepared = await dispatcher.PrepareAccumulator(accumulator);
  assert.deepEqual(prepared.batches.map((entry) => entry.batch), [ first, second ]);

  const pass = { id: "pass" };
  dispatcher.EncodeAccumulator(pass, prepared);
  assert.deepEqual(
    boundary.calls.filter(([ name ]) => name === "EncodeDraw").map((entry) => entry[2]),
    prepared.batches.map((entry) => entry.draw)
  );
  dispatcher.DestroyAccumulator(prepared);
  dispatcher.DestroyAccumulator(prepared);
  assert.deepEqual(boundary.bindingSets.map((entry) => entry.destroyed), [ 1, 1 ]);
  assert.throws(
    () => dispatcher.EncodeAccumulator(pass, prepared),
    /prepared accumulator is destroyed/u
  );
});

test("Trinity batch dispatcher rejects GDPR and rolls back partial accumulators", async () =>
{
  const boundary = mockBoundary();
  const dispatcher = new CjsWebGPUTrinityBatchDispatcher(boundary.webgpu, hooks());
  await assert.rejects(
    dispatcher.PrepareAccumulator({
      GetGdprBatches: () => [ indexedBatch() ],
      GetBatches: () => [],
      GetBatchCount: () => 1
    }),
    /GDPR batch dispatch is not implemented/u
  );
  assert.equal(boundary.bindingSets.length, 0);

  const rejected = mockBoundary({ rejectDrawAt: 2 });
  const rejecting = new CjsWebGPUTrinityBatchDispatcher(rejected.webgpu, hooks());
  await assert.rejects(
    rejecting.PrepareAccumulator({
      GetGdprBatches: () => [],
      GetBatches: () => [ indexedBatch(), indexedBatch() ],
      GetBatchCount: () => 2
    }),
    /draw rejected/u
  );
  assert.deepEqual(rejected.bindingSets.map((entry) => entry.destroyed), [ 1, 1 ]);
});
