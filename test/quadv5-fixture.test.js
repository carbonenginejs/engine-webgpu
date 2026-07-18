import assert from "node:assert/strict";
import { test } from "node:test";

import {
  QUADV5_EXPECTED_TARGETS,
  QUADV5_PPT_SELECTION,
  QUADV5_VERTEX_BUFFER_LAYOUT,
  createQuadV5FixtureValues,
  createQuadV5MainBindingValues,
  validateQuadV5PackagePair,
  validateQuadV5PackageRecord
} from "../harness/webgpu/quadV5Fixture.js";

function selections()
{
  const provenance = {
    BINDLESS_RENDERING: [ 0, 0, "BINDLESS_RENDERING_DISABLED" ],
    SPACE_OBJECT_CLIPPING: [ 0, 0, "SOC_DISABLED" ],
    SPACE_OBJECT_PPT_ENABLED: [ 1, 0, "SOPPT_DISABLED" ],
    SPACE_OBJECT_TRANSPARENCY: [ 0, 0, "SOT_OPAQUE" ],
    V5_DEBUG: [ 0, 0, "OFF" ],
    SPACE_OBJECT_INSTANCED_ATTACHMENT: [ 0, 0, "SOIA_DISABLED" ],
    BLEND_MODE: [ 0, 0, "BLEND_MODE_OVERLAY" ]
  };
  return Object.entries(QUADV5_PPT_SELECTION).map(([ name, value ]) => ({
    name,
    value,
    optionIndex: provenance[name][0],
    defaultOption: provenance[name][1],
    defaultValue: provenance[name][2],
    source: "local"
  }));
}

function binding(resourceKind, registerIndex, bindingIndex, visibility, layout)
{
  return {
    sourceTruth: "wgsl-layout",
    resourceKind,
    registerSpace: 0,
    registerIndex,
    group: 0,
    binding: bindingIndex,
    visibility: [ visibility ],
    dynamic: false,
    layout
  };
}

function validRecord(backend = "dx11")
{
  const selectedOptions = selections();
  const source = `E:/shaderdiscovery/graphics/effect.${backend}/managed/space/quadv5.sm_lo`;
  return {
    backend,
    label: "quadv5-ppt-on.cewgpu",
    filePath: `E:/packages/quadv5-ppt-on-${backend}.cewgpu`,
    resourcePath: `res:/webgpu-harness/quadv5/${backend}.cewgpu`,
    analysis: {
      source,
      bodyIndex: 4,
      selectedOptions,
      stages: [ {
        techniqueName: "Main",
        passIndex: 0,
        stageName: "vertex",
        pipelineInputs: [
          { registerIndex: 0, dimension: 3, type: 0, usedMask: 7 },
          { registerIndex: 1, dimension: 4, type: 2, usedMask: 0 },
          { registerIndex: 2, dimension: 2, type: 0, usedMask: 3 },
          { registerIndex: 3, dimension: 3, type: 0, usedMask: 7 },
          { registerIndex: 6, dimension: 2, type: 0, usedMask: 3 }
        ]
      } ]
    },
    metadata: {
      sourcePath: source,
      bodyIndex: 4,
      selectedOptions,
      wgslSelection: {
        techniqueName: "Main",
        passIndex: 0,
        completePasses: true,
        selectedStageKeys: [ "Main.pass0.vertex", "Main.pass0.pixel" ]
      }
    },
    pipeline: {
      techniqueName: "Main",
      passIndex: 0,
      shaderModules: [
        {
          stageName: "vertex",
          entryPoint: "main",
          wgsl: "@location(0) input0: vec3f, @location(2) input2: vec2f, @location(3) input3: vec3f, @location(6) input6: vec2f"
        },
        {
          stageName: "pixel",
          entryPoint: "main",
          wgsl: "@location(0) output0: vec4f, @location(1) output1: vec4f"
        }
      ],
      bindGroups: [ {
        group: 0,
        bindings: [
          binding("uniform-buffer", 0, 0, "fragment", { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 160 } }),
          binding("uniform-buffer", 1, 1, "vertex", { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 656 } }),
          binding("uniform-buffer", 2, 2, "fragment", { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 352 } }),
          binding("uniform-buffer", 3, 3, "vertex", { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 128 } }),
          binding("uniform-buffer", 4, 4, "fragment", { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 208 } }),
          binding("sampled-resource", 0, 5, "fragment", { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } }),
          binding("sampled-resource", 1, 6, "fragment", { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } }),
          binding("sampled-resource", 2, 7, "fragment", { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } }),
          binding("sampler", 0, 8, "fragment", { sampler: { type: "filtering" } })
        ]
      } ]
    }
  };
}

test("QuadV5 fixture separates indexed GPU assets from semantic binding values", () =>
{
  const fixture = createQuadV5FixtureValues(4, 4);
  const values = createQuadV5MainBindingValues(4, 4);
  assert.equal(fixture.vertices.byteLength, 4 * QUADV5_VERTEX_BUFFER_LAYOUT.arrayStride);
  assert.deepEqual(Array.from(fixture.indices), [ 0, 1, 2, 2, 1, 3 ]);
  assert.equal(Object.hasOwn(fixture, "uniforms"), false);
  assert.deepEqual(values.material.GeneralGlowColor, [ 0.25, 0.5, 1, 0 ]);
  assert.deepEqual(values.perFramePS.TargetResolution, [ 4, 4 ]);
  assert.deepEqual(values.perObjectPS.shipData, [ 0, 1, 0, 0 ]);
  assert.deepEqual(QUADV5_EXPECTED_TARGETS, [ [ 64, 128, 255, 255 ], [ 0, 0, 0, 255 ] ]);
});

test("QuadV5 fixture accepts only the exact PPT-on Main pass contract", () =>
{
  const record = validRecord();
  assert.equal(validateQuadV5PackageRecord(record), record);

  const wrongBody = structuredClone(record);
  wrongBody.analysis.bodyIndex = 0;
  assert.throws(() => validateQuadV5PackageRecord(wrongBody), /body index 4/u);

  const pptOff = structuredClone(record);
  pptOff.analysis.selectedOptions.find((entry) => entry.name === "SPACE_OBJECT_PPT_ENABLED").value = "SOPPT_DISABLED";
  assert.throws(() => validateQuadV5PackageRecord(pptOff), /SOPPT_ENABLED/u);

  const defaulted = structuredClone(record);
  defaulted.metadata.selectedOptions.find((entry) => entry.name === "SPACE_OBJECT_PPT_ENABLED").source = "default";
  assert.throws(() => validateQuadV5PackageRecord(defaulted), /unexpected provenance/u);
});

test("QuadV5 fixture rejects binding and MRT drift", () =>
{
  const wrongSize = structuredClone(validRecord());
  wrongSize.pipeline.bindGroups[0].bindings[1].layout.buffer.minBindingSize = 640;
  assert.throws(() => validateQuadV5PackageRecord(wrongSize), /uniform-buffer layout/u);

  const oneTarget = structuredClone(validRecord());
  oneTarget.pipeline.shaderModules[1].wgsl = "@location(0) output0: vec4f";
  assert.throws(() => validateQuadV5PackageRecord(oneTarget), /both QuadV5 render targets/u);
});

test("QuadV5 fixture requires distinct ordered backend provenance", () =>
{
  const dx11 = validRecord("dx11");
  const dx12 = validRecord("dx12");
  dx12.pipeline.shaderModules[0].wgsl += " // SM5.1";
  assert.deepEqual(validateQuadV5PackagePair([ dx11, dx12 ]), [ dx11, dx12 ]);

  const sameFile = structuredClone(dx12);
  sameFile.filePath = dx11.filePath.toUpperCase();
  assert.throws(() => validateQuadV5PackagePair([ dx11, sameFile ]), /distinct physical/u);

  const missingFile = structuredClone(dx12);
  missingFile.filePath = "";
  assert.throws(() => validateQuadV5PackagePair([ dx11, missingFile ]), /distinct physical/u);

  const missingResource = structuredClone(dx12);
  missingResource.resourcePath = "";
  assert.throws(() => validateQuadV5PackagePair([ dx11, missingResource ]), /distinct logical/u);

  const mislabeled = structuredClone(dx12);
  mislabeled.analysis.source = dx11.analysis.source;
  mislabeled.metadata.sourcePath = dx11.metadata.sourcePath;
  assert.throws(() => validateQuadV5PackagePair([ dx11, mislabeled ]), /must match dx12/u);

  assert.throws(() => validateQuadV5PackagePair([ dx12, dx11 ]), /must match dx12|order must be DX11/u);

  const identicalWgsl = structuredClone(dx12);
  identicalWgsl.pipeline.shaderModules = structuredClone(dx11.pipeline.shaderModules);
  assert.throws(() => validateQuadV5PackagePair([ dx11, identicalWgsl ]), /identical WGSL/u);
});
