import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CjsWebGPUPackage } from "../src/index.js";

/**
 * Equivalence between the WGSB path and the legacy WGSL-chunk path, on real
 * packages.
 *
 * This is stronger than a pixel comparison and costs seconds rather than a
 * device: both paths converge on a JSON blob consumed by byte-identical browser
 * code, so JSON equality of the GPU-determining fields deterministically
 * implies pixel equality. A JSON diff also names the discrepant field, where a
 * pixel diff says "row 47 byte 12 is 203 vs 204".
 *
 * It needs real packages, which are derived artifacts and deliberately not
 * committed. Build them per `test/fixtures/quadv5/manifest.json` and point
 * `CJS_WEBGPU_FIXTURE_DIR` at the output directory.
 */

const FIXTURE_DIR = process.env.CJS_WEBGPU_FIXTURE_DIR || null;
const STEM = process.env.CJS_WEBGPU_FIXTURE_STEM || "unpacked_quadv5.sm_hi";
const BACKENDS = [ "dx11", "dx12" ];

// Fields a WGSB unit deliberately does not carry. A translation unit is stage
// bytecode, semantic bindings and layouts; Carbon reflection and render states
// live in ANLS and portable reflection. Enumerating them means a future drift
// into a GPU-determining field cannot hide inside "they always differed".
const ANALYSIS_ONLY_PIPELINE_FIELDS = Object.freeze([ "renderStates" ]);
const ANALYSIS_ONLY_MODULE_FIELDS = Object.freeze([
  "pipelineInputs", "bindings", "shaderBytecode", "dxbc", "dxbcError", "sourceMap", "shaderRecord"
]);
const ANALYSIS_ONLY_BINDING_FIELDS = Object.freeze([
  "name", "stageName", "stageType", "metadataName", "carbon", "annotations",
  "heapView", "stages", "isSRGB", "bufferKind", "dynamic"
]);

function fixturePath(kind, backend)
{
  return `${FIXTURE_DIR}/${STEM}-${kind}.${backend}.cewgpu`;
}

async function readerModule()
{
  return import("@carbonenginejs/runtime-resource/formats/webgpu");
}

function stageProjection(modules)
{
  return modules
    .map((entry) => ({
      stageName: entry.stageName,
      stageType: entry.stageType,
      entryPoint: entry.entryPoint,
      wgsl: entry.wgsl
    }))
    .sort((left, right) => left.stageName.localeCompare(right.stageName));
}

function bindingProjection(bindGroups)
{
  return bindGroups
    .flatMap((group) => group.bindings.map((entry) => ({
      group: entry.group,
      binding: entry.binding,
      identity: entry.identity,
      scopeIdentity: entry.scopeIdentity,
      resourceKind: entry.resourceKind,
      bindingKind: entry.bindingKind,
      access: entry.access,
      generatedSymbol: entry.generatedSymbol,
      registerSpace: entry.registerSpace,
      registerIndex: entry.registerIndex,
      registerCount: entry.registerCount,
      arrayCount: entry.arrayCount,
      visibility: entry.visibility,
      structureStride: entry.structureStride ?? null,
      layout: entry.layout,
      sourceTruth: entry.sourceTruth
    })))
    .sort((left, right) => (left.group - right.group) || (left.binding - right.binding));
}

function differingFields(left, right)
{
  return [ ...new Set([ ...Object.keys(left || {}), ...Object.keys(right || {}) ]) ]
    .filter((field) => JSON.stringify(left?.[field]) !== JSON.stringify(right?.[field]));
}

test("WGSB-derived and WGSL-chunk-derived pipelines agree on every GPU-determining field", async (t) =>
{
  if (!FIXTURE_DIR)
  {
    t.skip("set CJS_WEBGPU_FIXTURE_DIR to a directory holding the built "
      + `${STEM}-ppt-main.<backend>.cewgpu and ${STEM}-allbody.<backend>.cewgpu packages `
      + "(build them per test/fixtures/quadv5/manifest.json)");
    return;
  }

  const { CjsWebgpuFormat } = await readerModule();

  for (const backend of BACKENDS)
  {
    const allBodyBytes = await readFile(fixturePath("allbody", backend));
    const selectedBytes = await readFile(fixturePath("ppt-main", backend));

    const rawAll = CjsWebgpuFormat.read(allBodyBytes, {
      source: fixturePath("allbody", backend),
      emit: CjsWebgpuFormat.OUTPUT_RAW
    });
    const allBody = CjsWebGPUPackage.fromBytes(allBodyBytes, {
      read: CjsWebgpuFormat.read,
      readOptions: { source: fixturePath("allbody", backend), emit: CjsWebgpuFormat.OUTPUT_RAW }
    });
    const selected = CjsWebGPUPackage.fromBytes(selectedBytes, {
      read: CjsWebgpuFormat.read,
      readOptions: { source: fixturePath("ppt-main", backend) }
    });

    // Body identity, resolved from the selected package's own recorded
    // selections rather than assumed. Without this a green comparison could be
    // luck: any body would compare equal to itself.
    const graph = rawAll.permutationGraph;
    const wanted = new Map(selected.metadata.selectedOptions.map((option) => [ option.name, option.value ]));
    const optionIndices = graph.axes.map((axis) =>
    {
      const index = axis.options.indexOf(wanted.get(axis.name));
      assert.notEqual(index, -1, `${backend}: axis ${axis.name} has no option ${wanted.get(axis.name)}`);
      return index;
    });
    const variants = graph.variants.filter(
      (variant) => variant.optionIndices.every((value, index) => value === optionIndices[index])
    );
    assert.equal(variants.length, 1, `${backend}: selections must resolve exactly one permutation`);
    assert.equal(
      variants[0].permutationIndex,
      selected.metadata.bodyIndex,
      `${backend}: the resolved permutation must be the one the selected package baked in`
    );

    const body = allBody.GetBackendBody(variants[0].permutationIndex);
    assert.equal(body.status, "translated", `${backend}: ${body.bodyKey} is ${body.status}: ${body.error}`);
    const main = body.passes.find((pass) => pass.passKey === "Main.pass0");
    assert.ok(main, `${backend}: the resolved body has no Main.pass0`);

    const wgsbPackage = CjsWebGPUPackage.from({
      sourcePath: fixturePath("allbody", backend),
      analysis: {
        passes: [ { techniqueName: "Main", passIndex: 0, renderStates: 0, states: [] } ],
        stages: main.shaders.map((shader) => ({
          key: shader.key,
          techniqueName: "Main",
          passIndex: 0,
          stageName: shader.stageName,
          stageType: shader.stageType,
          bindings: []
        }))
      },
      wgsl: {
        format: "CJS_WGSL_SET",
        formatVersion: main.wgslSetVersion,
        shaders: main.shaders,
        layouts: main.layouts
      }
    });

    const wgsb = wgsbPackage.GetPipeline("Main", 0).ToJSON();
    const legacy = selected.GetPipeline("Main", 0).ToJSON();

    assert.deepEqual(
      stageProjection(wgsb.shaderModules),
      stageProjection(legacy.shaderModules),
      `${backend}: WGSL payloads differ between the WGSB and WGSL-chunk paths`
    );
    assert.deepEqual(
      bindingProjection(wgsb.bindGroups),
      bindingProjection(legacy.bindGroups),
      `${backend}: canonical bindings differ between the WGSB and WGSL-chunk paths`
    );

    // Everything else that differs must be analysis-only, and nothing else.
    assert.deepEqual(
      differingFields(wgsb, legacy).filter((field) => ![ "key", "shaderModules", "bindGroups" ].includes(field)),
      [ ...ANALYSIS_ONLY_PIPELINE_FIELDS ],
      `${backend}: unexpected pipeline-level divergence`
    );
    for (let index = 0; index < legacy.shaderModules.length; index += 1)
    {
      assert.deepEqual(
        differingFields(wgsb.shaderModules[index], legacy.shaderModules[index]).filter((field) => field !== "key"),
        [ ...ANALYSIS_ONLY_MODULE_FIELDS ].filter((field) => differingFields(
          wgsb.shaderModules[index],
          legacy.shaderModules[index]
        ).includes(field)),
        `${backend}: unexpected shader-module divergence at ${index}`
      );
    }
    const wgsbBindings = wgsb.bindGroups.flatMap((group) => group.bindings);
    const legacyBindings = legacy.bindGroups.flatMap((group) => group.bindings);
    for (let index = 0; index < legacyBindings.length; index += 1)
    {
      const differing = differingFields(wgsbBindings[index], legacyBindings[index]).filter((field) => field !== "key");
      const unexpected = differing.filter((field) => !ANALYSIS_ONLY_BINDING_FIELDS.includes(field));
      assert.deepEqual(unexpected, [], `${backend}: unexpected binding divergence at ${index}`);
    }

    // Render states are the one pipeline-level divergence, and it is expected:
    // the body set carries none at all.
    assert.equal(wgsb.renderStates, 0, `${backend}: a WGSB unit cannot carry a render-state handle`);
    assert.deepEqual(wgsb.states, [], `${backend}: a WGSB unit cannot carry render states`);
  }
});
