import assert from "node:assert/strict";
import { test } from "node:test";

import {
  QUADV5_CLEAR_TARGETS,
  QUADV5_PPT_SELECTION,
  QUADV5_SKINNED_HEAT_DETAIL_PPT_SELECTION,
  QUADV5_SKINNED_PPT_SELECTION,
  QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT,
  QUADV5_TARGET_HEIGHT,
  QUADV5_TARGET_WIDTH,
  QUADV5_VERTEX_BUFFER_LAYOUT,
  createQuadV5FixtureValues,
  createQuadV5HeatDetailBindingCases,
  createQuadV5MainBindingValues,
  getQuadV5ResourcePlan,
  validateQuadV5PackagePair,
  validateQuadV5PackageRecord
} from "../harness/webgpu/quadV5Fixture.js";

const RESOURCE_NAMES = [
  "EveSpaceSceneEnvMap",
  "SSAOMap",
  "EveSpaceSceneShadowMap",
  "NormalMap",
  "GlowMap",
  "AlbedoMap",
  "RoughnessMap",
  "MaterialMap",
  "PaintMaskMap",
  "PatternMask1Map",
  "PatternMask2Map"
];

const RESOURCE_REGISTERS = {
  dx11: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ],
  dx12: [ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12 ]
};

const HEAT_DETAIL_RESOURCE_NAMES = [
  ...RESOURCE_NAMES,
  "HeatGlowNoiseMap",
  "Detail1Map",
  "Detail2Map"
];

const HEAT_DETAIL_RESOURCE_REGISTERS = {
  dx11: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 ],
  dx12: [ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15 ]
};

const HEAT_DETAIL_MATERIAL_CONSTANTS = [
  [ "GeneralData", 0 ],
  [ "Mtl1DiffuseColor", 32 ],
  [ "Mtl2DiffuseColor", 48 ],
  [ "Mtl3DiffuseColor", 64 ],
  [ "Mtl4DiffuseColor", 80 ],
  [ "Mtl1FresnelColor", 96 ],
  [ "Mtl2FresnelColor", 112 ],
  [ "Mtl3FresnelColor", 128 ],
  [ "Mtl4FresnelColor", 144 ],
  [ "Mtl1Gloss", 160 ],
  [ "Mtl2Gloss", 176 ],
  [ "Mtl3Gloss", 192 ],
  [ "Mtl4Gloss", 208 ],
  [ "PMtl1DiffuseColor", 288 ],
  [ "PMtl1FresnelColor", 304 ],
  [ "PMtl1Gloss", 320 ],
  [ "PMtl2DiffuseColor", 336 ],
  [ "PMtl2FresnelColor", 352 ],
  [ "PMtl2Gloss", 368 ],
  [ "Mtl1HeatGlowData", 384 ],
  [ "Mtl2HeatGlowData", 400 ],
  [ "Mtl3HeatGlowData", 416 ],
  [ "Mtl4HeatGlowData", 432 ],
  [ "GeneralHeatGlowColor", 448 ],
  [ "Detail1Data", 464 ],
  [ "Detail2Data", 480 ],
  [ "SecondaryDetail2Data", 496 ],
  [ "Detail3Data", 512 ],
  [ "DetailAlbedoColor", 528 ],
  [ "DetailFresnelColor", 544 ],
  [ "DetailSelector", 624 ]
];

const HEAT_DETAIL_VERTEX_INPUTS = [
  { usageName: "POSITION", usageIndex: 0, registerIndex: 0, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "BLENDINDICES", usageIndex: 0, registerIndex: 1, usedMask: 1, type: 2, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 0, registerIndex: 2, usedMask: 3, type: 0, dimension: 2 },
  { usageName: "NORMAL", usageIndex: 0, registerIndex: 3, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "TANGENT", usageIndex: 0, registerIndex: 4, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "BITANGENT", usageIndex: 0, registerIndex: 5, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "TEXCOORD", usageIndex: 1, registerIndex: 6, usedMask: 3, type: 0, dimension: 2 }
];

const HEAT_DETAIL_PIXEL_INPUTS = [
  { usageName: "TEXCOORD", usageIndex: 0, registerIndex: 1, usedMask: 3, type: 0, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 1, registerIndex: 2, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "TEXCOORD", usageIndex: 2, registerIndex: 3, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "TEXCOORD", usageIndex: 3, registerIndex: 4, usedMask: 7, type: 0, dimension: 3 },
  { usageName: "TEXCOORD", usageIndex: 4, registerIndex: 5, usedMask: 15, type: 0, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 5, registerIndex: 6, usedMask: 0, type: 0, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 6, registerIndex: 7, usedMask: 15, type: 0, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 8, registerIndex: 8, usedMask: 0, type: 0, dimension: 4 },
  { usageName: "TEXCOORD", usageIndex: 9, registerIndex: 9, usedMask: 11, type: 0, dimension: 4 }
];

function samplerState(isDynamic)
{
  return {
    comparison: false,
    minFilter: 3,
    magFilter: 2,
    mipFilter: 2,
    addressU: 1,
    addressV: 1,
    addressW: 3,
    mipLODBias: 0,
    maxAnisotropy: 16,
    isDynamic
  };
}

function heatDetailVertexWgsl()
{
  return `struct VertexInput {
  @location(0) input0: vec3<f32>,
  @location(1) input1: vec4<u32>,
  @location(2) input2: vec2<f32>,
  @location(3) input3: vec3<f32>,
  @location(4) input4: vec3<f32>,
  @location(5) input5: vec3<f32>,
  @location(6) input6: vec2<f32>,
};
struct VertexOutput {
  @invariant @builtin(position) position: vec4<f32>,
  @location(1) output1: vec4<f32>,
  @location(2) output2: vec3<f32>,
  @location(3) output3: vec3<f32>,
  @location(4) output4: vec3<f32>,
  @location(5) output5: vec4<f32>,
  @location(6) output6: vec4<f32>,
  @location(7) output7: vec4<f32>,
  @location(8) output8: vec4<f32>,
  @location(9) output9: vec4<f32>,
};`;
}

function heatDetailPixelWgsl()
{
  return `struct FragmentInput {
  @builtin(position) position: vec4<f32>,
  @location(1) input1: vec4<f32>,
  @location(2) input2: vec3<f32>,
  @location(3) input3: vec3<f32>,
  @location(4) input4: vec3<f32>,
  @location(5) input5: vec4<f32>,
  @location(7) input7: vec4<f32>,
  @location(9) input9: vec4<f32>,
};
struct FragmentOutput {
  @location(0) output0: vec4<f32>,
  @location(1) output1: vec4<f32>,
};`;
}

function selections(variant = "static")
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
  const selection = variant === "skinnedHeatDetail"
    ? QUADV5_SKINNED_HEAT_DETAIL_PPT_SELECTION
    : (variant === "skinned" ? QUADV5_SKINNED_PPT_SELECTION : QUADV5_PPT_SELECTION);
  return Object.entries(selection).map(([ name, value ]) => ({
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
  const identity = `${resourceKind}:0:${registerIndex}`;
  return {
    identity,
    scopeIdentity: `${identity}@${visibility}`,
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

function analysisPixelBindings(backend, heatDetail = false)
{
  const names = heatDetail ? HEAT_DETAIL_RESOURCE_NAMES : RESOURCE_NAMES;
  const registers = (heatDetail ? HEAT_DETAIL_RESOURCE_REGISTERS : RESOURCE_REGISTERS)[backend];
  const resources = registers.map((registerIndex, index) => ({
    kind: "resource",
    registerSpace: 0,
    registerIndex,
    registerType: index === 0 ? 41 : 36,
    carbon: {
      name: names[index],
      type: index === 0 ? 4 : 2,
      arrayElements: 1,
      isSRGB: index === 0 || names[index] === "AlbedoMap",
      isAutoregister: names[index] === "EveSpaceSceneShadowMap"
    }
  }));
  const samplers = [
    ...(backend === "dx11" ? [ {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 0,
      carbon: {
        name: null,
        sampler: samplerState(false)
      }
    } ] : []),
    {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 1,
      carbon: { name: "PatternMask1MapSampler", sampler: samplerState(true) }
    },
    {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 2,
      carbon: { name: "PatternMask2MapSampler", sampler: samplerState(true) }
    }
  ];
  const material = heatDetail ? [ {
    kind: "constantBuffer",
    registerSpace: 0,
    registerIndex: 0,
    carbon: {
      hasLocalConstants: true,
      constantValueSize: 640,
      constants: HEAT_DETAIL_MATERIAL_CONSTANTS.map(([ name, offset ]) => ({
        name,
        offset,
        size: 16,
        dimension: 4,
        type: 0,
        elements: 0
      }))
    }
  } ] : [];
  return [ ...resources, ...samplers, ...material ];
}

function pipelineBindings(backend, skinned = false, heatDetail = false)
{
  const uniforms = [
    binding("uniform-buffer", 0, 0, "fragment", {
      buffer: {
        type: "uniform",
        hasDynamicOffset: false,
        minBindingSize: heatDetail ? 640 : 384
      }
    }),
    binding("uniform-buffer", 1, 1, "vertex", {
      buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 512 }
    }),
    binding("uniform-buffer", 2, 2, "fragment", {
      buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 352 }
    }),
    binding("uniform-buffer", 3, 3, "vertex", {
      buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: skinned ? 432 : 416 }
    }),
    binding("uniform-buffer", 4, 4, "fragment", {
      buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 432 }
    })
  ];
  const bone = skinned ? [ {
    ...binding("sampled-resource", 0, 5, "vertex", {
      buffer: { type: "read-only-storage", hasDynamicOffset: false, minBindingSize: 48 }
    }),
    structureStride: 48
  } ] : [];
  const registers = (heatDetail ? HEAT_DETAIL_RESOURCE_REGISTERS : RESOURCE_REGISTERS)[backend];
  const textures = registers.map((registerIndex, index) =>
    binding("sampled-resource", registerIndex, (skinned ? 6 : 5) + index, "fragment", {
      texture: {
        sampleType: "float",
        viewDimension: index === 0 ? "cube" : "2d",
        multisampled: false
      }
    }));
  const samplers = [ 0, 1, 2 ].map((registerIndex) =>
    binding("sampler", registerIndex,
      (heatDetail ? 20 : (skinned ? 17 : 16)) + registerIndex, "fragment", {
      sampler: { type: "filtering" }
    }));
  return [ ...uniforms, ...bone, ...textures, ...samplers ];
}

function validRecord(backend = "dx11", variant = "static")
{
  const skinned = variant === "skinned" || variant === "skinnedHeatDetail";
  const heatDetail = variant === "skinnedHeatDetail";
  const selectedOptions = selections(variant);
  const stem = heatDetail
    ? "unpackedskinned_quadheatdetailv5"
    : (skinned ? "unpackedskinned_quadv5" : "unpacked_quadv5");
  const source = `fixtures/shaders/effect.${backend}/managed/space/spaceobject/v5/quad/${stem}.sm_hi`;
  return {
    backend,
    variant,
    label: "unpacked-quadv5-ppt-on.cewgpu",
    filePath: `fixtures/packages/unpacked-quadv5-ppt-on-${backend}.cewgpu`,
    resourcePath: `res:/webgpu-harness/quadv5/${backend}.cewgpu`,
    analysis: {
      source,
      bodyIndex: 4,
      selectedOptions,
      passes: [ {
        techniqueName: "Main",
        passIndex: 0,
        renderStates: 1,
        states: []
      } ],
      stages: [
        {
          key: "Main.pass0.vertex",
          techniqueName: "Main",
          passIndex: 0,
          stageName: "vertex",
          stageType: 0,
          pipelineInputs: heatDetail ? HEAT_DETAIL_VERTEX_INPUTS.map((entry) => ({ ...entry })) : [
            { registerIndex: 0, dimension: 3, type: 0, usedMask: 7 },
            { registerIndex: 1, dimension: 4, type: 2, usedMask: skinned ? 1 : 0 },
            { registerIndex: 2, dimension: 2, type: 0, usedMask: 3 },
            { registerIndex: 3, dimension: 3, type: 0, usedMask: 7 },
            { registerIndex: 4, dimension: 3, type: 0, usedMask: 7 },
            { registerIndex: 5, dimension: 3, type: 0, usedMask: 7 },
            { registerIndex: 6, dimension: 2, type: 0, usedMask: 3 }
          ],
          bindings: skinned ? [ {
            kind: "resource",
            registerSpace: 0,
            registerIndex: 0,
            registerType: 33,
            carbon: {
              name: "BoneTransforms",
              type: 7,
              arrayElements: 1,
              isSRGB: false,
              isAutoregister: false
            }
          } ] : []
        },
        {
          key: "Main.pass0.pixel",
          techniqueName: "Main",
          passIndex: 0,
          stageName: "pixel",
          stageType: 1,
          pipelineInputs: heatDetail
            ? HEAT_DETAIL_PIXEL_INPUTS.map((entry) => ({ ...entry }))
            : [],
          bindings: analysisPixelBindings(backend, heatDetail)
        }
      ]
    },
    metadata: {
      sourcePath: source,
      bodyIndex: 4,
      selectedOptions,
      wgslSelection: {
        mode: "explicit",
        techniqueName: "Main",
        passIndex: 0,
        completePasses: true,
        requestedStageNames: [ "vertex", "pixel" ],
        selectedStageKeys: [ "Main.pass0.vertex", "Main.pass0.pixel" ]
      }
    },
    pipeline: {
      techniqueName: "Main",
      passIndex: 0,
      renderStates: 1,
      states: [],
      shaderModules: [
        {
          key: "Main.pass0.vertex",
          techniqueName: "Main",
          passIndex: 0,
          stageName: "vertex",
          stageType: 0,
          entryPoint: "main",
          wgsl: heatDetail ? heatDetailVertexWgsl() : [
            "@location(0) input0: vec3f,",
            ...(skinned ? [ "@location(1) input1: vec4u," ] : []),
            "@location(2) input2: vec2f,",
            "@location(3) input3: vec3f,",
            "@location(4) input4: vec3f,",
            "@location(5) input5: vec3f,",
            "@location(6) input6: vec2f"
          ].join("\n")
        },
        {
          key: "Main.pass0.pixel",
          techniqueName: "Main",
          passIndex: 0,
          stageName: "pixel",
          stageType: 1,
          entryPoint: "main",
          wgsl: heatDetail
            ? heatDetailPixelWgsl()
            : "@location(0) output0: vec4f, @location(1) output1: vec4f"
        }
      ],
      bindGroups: [ {
        group: 0,
        bindings: pipelineBindings(backend, skinned, heatDetail)
      } ]
    }
  };
}

test("QuadV5 fixture supplies explicit full-contract synthetic silhouette inputs", () =>
{
  const fixture = createQuadV5FixtureValues(QUADV5_TARGET_WIDTH, QUADV5_TARGET_HEIGHT);
  const values = createQuadV5MainBindingValues(QUADV5_TARGET_WIDTH, QUADV5_TARGET_HEIGHT);
  assert.equal(fixture.vertices.byteLength, 13 * QUADV5_VERTEX_BUFFER_LAYOUT.arrayStride);
  assert.equal(fixture.boneIndices.byteLength, 13 * QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT.arrayStride);
  for (let index = 0; index < 13; index += 1)
  {
    assert.deepEqual(Array.from(fixture.boneIndices.slice(index * 4, index * 4 + 4)), [ 1, 0, 0, 0 ]);
  }
  assert.equal(fixture.indices.length, 36);
  assert.equal(Math.max(...fixture.indices), 12);
  assert.equal(Object.hasOwn(fixture, "uniforms"), false);
  assert.equal(fixture.textures.length, 11);
  assert.equal(fixture.textures.filter((entry) => entry.dimension === "cube").length, 1);
  assert.equal(fixture.textures.filter((entry) => entry.dimension === "2d").length, 10);
  assert.equal(fixture.textures.find((entry) => entry.name === "AlbedoMap").format, "rgba8unorm-srgb");
  assert.equal(fixture.textures.find((entry) => entry.name === "NormalMap").data.byteLength, 8 * 8 * 4);
  assert.deepEqual(fixture.samplerNames, [ "Sampler0", "PatternMask1MapSampler", "PatternMask2MapSampler" ]);
  assert.equal(Object.keys(values.material).length, 20);
  assert.deepEqual(values.material.GeneralData, [ 1, 0, 0, 0 ]);
  assert.deepEqual(values.material.GeneralGlowColor, [ 0.08, 0.22, 0.7, 0 ]);
  assert.deepEqual(values.perFramePS.TargetResolution, [ 64, 64 ]);
  assert.deepEqual(values.perObjectPS.shipData, [ 0, 1, 0, 0 ]);
  assert.deepEqual(QUADV5_CLEAR_TARGETS, [ [ 0, 255, 0, 255 ], [ 255, 0, 255, 255 ] ]);
});

test("QuadV5 heat-detail fixture exposes ordered isolated binding cases", () =>
{
  const cases = createQuadV5HeatDetailBindingCases(
    QUADV5_TARGET_WIDTH,
    QUADV5_TARGET_HEIGHT
  );
  assert.equal(Object.isFrozen(cases), true);
  assert.equal(Object.isFrozen(cases.caseNames), true);
  assert.equal(Object.isFrozen(cases.bindingValuesByCase), true);
  assert.deepEqual(cases.caseNames, [ "surface", "detail", "hotDetail" ]);

  const expectedMaterialNames = HEAT_DETAIL_MATERIAL_CONSTANTS.map(([ name ]) => name);
  for (const caseName of cases.caseNames)
  {
    const values = cases.bindingValuesByCase[caseName];
    assert.equal(Object.isFrozen(values), true);
    assert.equal(Object.isFrozen(values.material), true);
    assert.deepEqual(Object.keys(values.material), expectedMaterialNames);
    assert.equal(Object.hasOwn(values.material, "GeneralGlowColor"), false);
    assert.equal(Object.keys(values.material).length, 31);
  }

  assert.deepEqual(cases.bindingValuesByCase.surface.material.DetailSelector, [ 0, 0, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.detail.material.DetailSelector, [ 1, 1, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.hotDetail.material.DetailSelector, [ 1, 1, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.surface.perObjectVS.shipData, [ 0, 1, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.detail.perObjectPS.shipData, [ 0, 1, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.hotDetail.perObjectVS.shipData, [ 1, 1, 0, 0 ]);
  assert.deepEqual(cases.bindingValuesByCase.hotDetail.perObjectPS.shipData, [ 1, 1, 0, 0 ]);
});

test("QuadV5 fixture validates the PPT-on skinned heat-detail contract", () =>
{
  const dx11 = validRecord("dx11", "skinnedHeatDetail");
  const dx12 = validRecord("dx12", "skinnedHeatDetail");
  dx12.pipeline.shaderModules[0].wgsl += " // SM5.1";
  assert.deepEqual(validateQuadV5PackagePair([ dx11, dx12 ]), [ dx11, dx12 ]);

  const fixture = createQuadV5FixtureValues(
    QUADV5_TARGET_WIDTH,
    QUADV5_TARGET_HEIGHT,
    "skinnedHeatDetail"
  );
  assert.equal(fixture.textures.length, 14);
  assert.deepEqual(fixture.textures.slice(-3).map((entry) => entry.name), [
    "HeatGlowNoiseMap",
    "Detail1Map",
    "Detail2Map"
  ]);
  const plan = getQuadV5ResourcePlan(dx12);
  assert.equal(plan.storage.length, 1);
  assert.equal(plan.textures.length, 14);
  assert.equal(plan.samplers.length, 3);
  assert.equal(plan.textures.find((entry) => entry.name === "Detail2Map").registerIndex, 15);
  assert.equal(plan.samplers[0].binding, 20);

  const wrongMaterial = structuredClone(dx11);
  wrongMaterial.analysis.stages[1].bindings
    .find((entry) => entry.kind === "constantBuffer")
    .carbon.constants.at(-1).offset = 608;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongMaterial),
    /DetailSelector layout/u
  );
});

test("QuadV5 heat-detail validator rejects stage, interface, and WGSL drift", () =>
{
  const wrongAnalysisState = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongAnalysisState.analysis.passes[0].renderStates = 0;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongAnalysisState),
    /exact heat-detail Main\.pass0 render state/u
  );

  const wrongPipelineState = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongPipelineState.pipeline.renderStates = 0;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongPipelineState),
    /exact heat-detail Main\.pass0 render state/u
  );

  const extraMainStage = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  extraMainStage.analysis.stages.push({
    key: "Main.pass1.pixel",
    techniqueName: "Main",
    passIndex: 1,
    stageName: "pixel",
    stageType: 1
  });
  assert.throws(
    () => validateQuadV5PackageRecord(extraMainStage),
    /exactly the heat-detail Main\.pass0 stage pair/u
  );

  const wrongVertexMask = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongVertexMask.analysis.stages[0].pipelineInputs[1].usedMask = 15;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongVertexMask),
    /unexpected heat-detail used-mask interface/u
  );

  const wrongInactivePixelMask = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongInactivePixelMask.analysis.stages[1].pipelineInputs[5].usedMask = 1;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongInactivePixelMask),
    /unexpected heat-detail used-mask interface/u
  );

  const wrongVertexOutput = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongVertexOutput.pipeline.shaderModules[0].wgsl =
    wrongVertexOutput.pipeline.shaderModules[0].wgsl.replace(
      "@location(8) output8: vec4<f32>",
      "@location(8) output8: vec3<f32>"
    );
  assert.throws(
    () => validateQuadV5PackageRecord(wrongVertexOutput),
    /unexpected VertexOutput contract/u
  );

  const wrongFragmentInput = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongFragmentInput.pipeline.shaderModules[1].wgsl =
    wrongFragmentInput.pipeline.shaderModules[1].wgsl.replace(
      "@location(7) input7: vec4<f32>",
      "@location(6) input6: vec4<f32>"
    );
  assert.throws(
    () => validateQuadV5PackageRecord(wrongFragmentInput),
    /unexpected FragmentInput contract/u
  );
});

test("QuadV5 heat-detail validator rejects reflected resource and sampler drift", () =>
{
  const wrongBoneType = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongBoneType.analysis.stages[0].bindings[0].registerType = 36;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongBoneType),
    /BoneTransforms has unexpected heat-detail Carbon metadata/u
  );

  const wrongAlbedoSrgb = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongAlbedoSrgb.analysis.stages[1].bindings
    .find((entry) => entry.carbon?.name === "AlbedoMap")
    .carbon.isSRGB = false;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongAlbedoSrgb),
    /sampled-resource:0:5 has unexpected heat-detail Carbon metadata/u
  );

  const wrongShadowAutoreg = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongShadowAutoreg.analysis.stages[1].bindings
    .find((entry) => entry.carbon?.name === "EveSpaceSceneShadowMap")
    .carbon.isAutoregister = false;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongShadowAutoreg),
    /sampled-resource:0:2 has unexpected heat-detail Carbon metadata/u
  );

  const wrongDetailArray = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongDetailArray.analysis.stages[1].bindings
    .find((entry) => entry.carbon?.name === "Detail2Map")
    .carbon.arrayElements = 2;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongDetailArray),
    /sampled-resource:0:13 has unexpected heat-detail Carbon metadata/u
  );

  const extraTexture = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  extraTexture.analysis.stages[1].bindings.push({
    kind: "resource",
    registerSpace: 0,
    registerIndex: 99,
    registerType: 36,
    carbon: {
      name: "UnexpectedMap",
      type: 2,
      arrayElements: 1,
      isSRGB: false,
      isAutoregister: false
    }
  });
  assert.throws(
    () => validateQuadV5PackageRecord(extraTexture),
    /exact heat-detail inventory/u
  );

  const wrongSamplerAddress = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongSamplerAddress.analysis.stages[1].bindings
    .find((entry) => entry.kind === "sampler" && entry.registerIndex === 1)
    .carbon.sampler.addressU = 2;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongSamplerAddress),
    /unexpected dynamic sampler state/u
  );

  const wrongSamplerDynamic = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  wrongSamplerDynamic.analysis.stages[1].bindings
    .find((entry) => entry.kind === "sampler" && entry.registerIndex === 2)
    .carbon.sampler.isDynamic = false;
  assert.throws(
    () => validateQuadV5PackageRecord(wrongSamplerDynamic),
    /unexpected dynamic sampler state/u
  );

  const extraSampler = structuredClone(validRecord("dx11", "skinnedHeatDetail"));
  extraSampler.analysis.stages[1].bindings.push({
    kind: "sampler",
    registerSpace: 0,
    registerIndex: 99,
    carbon: { name: "UnexpectedSampler", sampler: samplerState(true) }
  });
  assert.throws(
    () => validateQuadV5PackageRecord(extraSampler),
    /exact heat-detail inventory/u
  );
});

test("QuadV5 fixture validates the skinned storage and vertex contract", () =>
{
  const dx11 = validRecord("dx11", "skinned");
  const dx12 = validRecord("dx12", "skinned");
  dx12.pipeline.shaderModules[0].wgsl += " // SM5.1";
  assert.deepEqual(validateQuadV5PackagePair([ dx11, dx12 ]), [ dx11, dx12 ]);

  const plan = getQuadV5ResourcePlan(dx11);
  assert.deepEqual(plan.storage, [ {
    name: "BoneTransforms",
    identity: "sampled-resource:0:0",
    scopeIdentity: "sampled-resource:0:0@vertex",
    registerIndex: 0,
    binding: 5
  } ]);
  assert.equal(plan.textures[0].scopeIdentity, "sampled-resource:0:0@fragment");
  assert.equal(plan.textures[0].binding, 6);
  assert.equal(plan.samplers[0].binding, 17);

  const missingBone = structuredClone(dx11);
  missingBone.analysis.stages[0].bindings = [];
  assert.throws(() => validateQuadV5PackageRecord(missingBone), /BoneTransforms reflection/u);

  const wrongStride = structuredClone(dx11);
  wrongStride.pipeline.bindGroups[0].bindings[5].structureStride = 64;
  assert.throws(() => validateQuadV5PackageRecord(wrongStride), /BoneTransforms.*storage layout/u);
});

test("QuadV5 fixture accepts only the current full PPT-on Main contract", () =>
{
  const record = validRecord();
  assert.equal(validateQuadV5PackageRecord(record), record);

  const wrongBody = structuredClone(record);
  wrongBody.analysis.bodyIndex = 0;
  assert.throws(() => validateQuadV5PackageRecord(wrongBody), /body index 4/u);

  const pptOff = structuredClone(record);
  pptOff.analysis.selectedOptions.find((entry) => entry.name === "SPACE_OBJECT_PPT_ENABLED").value = "SOPPT_DISABLED";
  assert.throws(() => validateQuadV5PackageRecord(pptOff), /SOPPT_ENABLED/u);

  const wrongSource = structuredClone(record);
  wrongSource.analysis.source = wrongSource.analysis.source.replace("unpacked_quadv5", "quadv5");
  wrongSource.metadata.sourcePath = wrongSource.analysis.source;
  assert.throws(() => validateQuadV5PackageRecord(wrongSource), /unpacked_quadv5 ship shader/u);

  const defaulted = structuredClone(record);
  defaulted.metadata.selectedOptions.find((entry) => entry.name === "SPACE_OBJECT_PPT_ENABLED").source = "default";
  assert.throws(() => validateQuadV5PackageRecord(defaulted), /unexpected provenance/u);

  const wrongShaderKey = structuredClone(record);
  wrongShaderKey.pipeline.shaderModules[0].key = "Bogus.pass9.vertex";
  assert.throws(() => validateQuadV5PackageRecord(wrongShaderKey), /complete vertex module/u);

  const wrongEntryPoint = structuredClone(record);
  wrongEntryPoint.pipeline.shaderModules[1].entryPoint = "bogus";
  assert.throws(() => validateQuadV5PackageRecord(wrongEntryPoint), /complete pixel module/u);

  const wrongSelectionMode = structuredClone(record);
  wrongSelectionMode.metadata.wgslSelection.mode = "default";
  assert.throws(() => validateQuadV5PackageRecord(wrongSelectionMode), /complete Main.pass0/u);
});

test("QuadV5 fixture maps backend-local registers through reflected semantic names", () =>
{
  const dx11 = getQuadV5ResourcePlan(validRecord("dx11"));
  const dx12 = getQuadV5ResourcePlan(validRecord("dx12"));
  const dx11Albedo = dx11.textures.find((entry) => entry.name === "AlbedoMap");
  const dx12Albedo = dx12.textures.find((entry) => entry.name === "AlbedoMap");
  assert.equal(dx11Albedo.identity, "sampled-resource:0:5");
  assert.equal(dx12Albedo.identity, "sampled-resource:0:6");
  assert.equal(dx11Albedo.binding, dx12Albedo.binding);
  assert.equal(dx11.samplers.length, 3);
  assert.equal(dx12.samplers.length, 3);

  const wrongName = structuredClone(validRecord("dx12"));
  wrongName.analysis.stages[1].bindings.find((entry) => entry.carbon?.name === "AlbedoMap").carbon.name = "WrongMap";
  assert.throws(() => validateQuadV5PackageRecord(wrongName), /must reflect AlbedoMap/u);

  const wrongStaticSampler = structuredClone(validRecord("dx11"));
  wrongStaticSampler.analysis.stages[1].bindings
    .find((entry) => entry.kind === "sampler" && entry.registerIndex === 0)
    .carbon.sampler.maxAnisotropy = 1;
  assert.throws(() => validateQuadV5PackageRecord(wrongStaticSampler), /unexpected static sampler state/u);
});

test("QuadV5 fixture rejects binding and MRT drift", () =>
{
  const wrongSize = structuredClone(validRecord());
  wrongSize.pipeline.bindGroups[0].bindings[1].layout.buffer.minBindingSize = 496;
  assert.throws(() => validateQuadV5PackageRecord(wrongSize), /uniform-buffer layout/u);

  const wrongDimension = structuredClone(validRecord());
  wrongDimension.pipeline.bindGroups[0].bindings[5].layout.texture.viewDimension = "2d";
  assert.throws(() => validateQuadV5PackageRecord(wrongDimension), /texture layout/u);

  const wrongRegister = structuredClone(validRecord());
  const albedo = wrongRegister.pipeline.bindGroups[0].bindings
    .find((entry) => entry.scopeIdentity === "sampled-resource:0:5@fragment");
  albedo.resourceKind = "sampler";
  albedo.registerSpace = 7;
  albedo.registerIndex = 99;
  assert.throws(() => validateQuadV5PackageRecord(wrongRegister), /slot, scope, register, or visibility/u);

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
