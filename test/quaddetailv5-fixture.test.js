import assert from "node:assert/strict";
import { test } from "node:test";

import {
  QUAD_DETAIL_V5_SELECTION,
  QUAD_DETAIL_V5_TARGET_HEIGHT,
  QUAD_DETAIL_V5_TARGET_WIDTH,
  QUAD_DETAIL_V5_VERTEX_BUFFER_LAYOUT,
  createQuadDetailV5BindingCases,
  createQuadDetailV5FixtureValues,
  getQuadDetailV5ResourcePlan,
  validateQuadDetailV5PackagePair,
  validateQuadDetailV5PackageRecord
} from "../harness/webgpu/quadDetailV5Fixture.js";

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
  "PatternMask2Map",
  "Detail1Map",
  "Detail2Map",
  "Detail3Map"
];

const RESOURCE_REGISTERS = {
  dx11: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 ],
  dx12: [ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15 ]
};

const MATERIAL_CONSTANTS = [
  [ "GeneralData", 0 ],
  [ "GeneralGlowColor", 16 ],
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
  [ "Detail1Data", 448 ],
  [ "Detail2Data", 464 ],
  [ "Detail3Data", 480 ],
  [ "DetailAlbedoColor", 496 ],
  [ "DetailFresnelColor", 512 ],
  [ "DetailSelector", 592 ]
];

const VERTEX_INPUTS = [
  [ "POSITION", 0, 0, 7, 0, 3 ],
  [ "BLENDINDICES", 0, 1, 0, 2, 4 ],
  [ "TEXCOORD", 0, 2, 3, 0, 2 ],
  [ "NORMAL", 0, 3, 7, 0, 3 ],
  [ "TANGENT", 0, 4, 7, 0, 3 ],
  [ "BITANGENT", 0, 5, 7, 0, 3 ],
  [ "TEXCOORD", 1, 6, 3, 0, 2 ]
];

const PIXEL_INPUTS = [
  [ "TEXCOORD", 0, 1, 3, 0, 4 ],
  [ "TEXCOORD", 1, 2, 7, 0, 3 ],
  [ "TEXCOORD", 2, 3, 7, 0, 3 ],
  [ "TEXCOORD", 3, 4, 7, 0, 3 ],
  [ "TEXCOORD", 4, 5, 15, 0, 4 ],
  [ "TEXCOORD", 5, 6, 0, 0, 4 ],
  [ "TEXCOORD", 6, 7, 15, 0, 4 ],
  [ "TEXCOORD", 8, 8, 0, 0, 4 ],
  [ "TEXCOORD", 9, 9, 11, 0, 4 ]
];

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
  return Object.entries(QUAD_DETAIL_V5_SELECTION).map(([ name, value ]) => ({
    name,
    value,
    optionIndex: provenance[name][0],
    defaultOption: provenance[name][1],
    defaultValue: provenance[name][2],
    source: "local"
  }));
}

function pipelineInput([
  usageName,
  usageIndex,
  registerIndex,
  usedMask,
  type,
  dimension
])
{
  return { usageName, usageIndex, registerIndex, usedMask, type, dimension };
}

function constantBuffer(registerIndex, local = false)
{
  return {
    kind: "constantBuffer",
    registerSpace: 0,
    registerIndex,
    registerType: 0,
    carbon: local
      ? {
        hasLocalConstants: true,
        constantValueSize: 608,
        constants: MATERIAL_CONSTANTS.map(([ name, offset ]) => ({
          name,
          offset,
          size: 16,
          dimension: 4,
          type: 0,
          elements: 0
        }))
      }
      : {
        hasLocalConstants: false,
        constantValueSize: 0,
        constants: []
      }
  };
}

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

function analysisResource(name, registerIndex, index)
{
  return {
    kind: "resource",
    registerSpace: 0,
    registerIndex,
    registerType: index === 0 ? 41 : 36,
    carbon: {
      name,
      type: index === 0 ? 4 : 2,
      arrayElements: 1,
      isSRGB: index === 0 || name === "AlbedoMap",
      isAutoregister: name === "EveSpaceSceneShadowMap"
    }
  };
}

function analysisSampler(registerIndex)
{
  return {
    kind: "sampler",
    registerSpace: 0,
    registerIndex,
    registerType: 1,
    carbon: {
      name: registerIndex === 0 ? null : `PatternMask${registerIndex}MapSampler`,
      sampler: samplerState(registerIndex !== 0)
    }
  };
}

function binding(identity, bindingIndex, visibility, kind, layout)
{
  const [ resourceKind, registerSpace, registerIndex ] = identity.split(":");
  return {
    identity,
    scopeIdentity: `${identity}@${visibility}`,
    resourceKind,
    registerSpace: Number(registerSpace),
    registerIndex: Number(registerIndex),
    sourceTruth: "wgsl-layout",
    group: 0,
    binding: bindingIndex,
    visibility: [ visibility ],
    dynamic: false,
    layout: {
      type: layout.type,
      buffer: kind === "buffer" ? layout.value : null,
      texture: kind === "texture" ? layout.value : null,
      sampler: kind === "sampler" ? layout.value : null
    }
  };
}

function uniformBinding(registerIndex, bindingIndex, visibility, size)
{
  return binding(
    `uniform-buffer:0:${registerIndex}`,
    bindingIndex,
    visibility,
    "buffer",
    {
      type: `array<vec4<f32>, ${size / 16}>`,
      value: {
        type: "uniform",
        hasDynamicOffset: false,
        minBindingSize: size
      }
    }
  );
}

function resourceBinding(name, registerIndex, bindingIndex, index)
{
  const viewDimension = index === 0 ? "cube" : "2d";
  return {
    ...binding(
      `sampled-resource:0:${registerIndex}`,
      bindingIndex,
      "fragment",
      "texture",
      {
        type: `texture_${viewDimension}<f32>`,
        value: {
          sampleType: "float",
          viewDimension,
          multisampled: false
        }
      }
    ),
    name,
    textureKind: viewDimension,
    arrayElements: 1,
    isSRGB: index === 0 || name === "AlbedoMap"
  };
}

function samplerBinding(registerIndex, bindingIndex)
{
  return binding(
    `sampler:0:${registerIndex}`,
    bindingIndex,
    "fragment",
    "sampler",
    { type: "sampler", value: { type: "filtering" } }
  );
}

function vertexWgsl(tag)
{
  return `// ${tag}
struct VertexInput {
  @location(0) input0: vec3<f32>,
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

function pixelWgsl(tag)
{
  return `// ${tag}
struct FragmentInput {
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

function packageRecord(backend)
{
  const source = `res:/graphics/effect.${backend}/managed/space/spaceobject/v5/quad/unpacked_quaddetailv5.sm_hi`;
  const registers = RESOURCE_REGISTERS[backend];
  const shaderModules = [
    {
      key: "Main.pass0.vertex",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "vertex",
      stageType: 0,
      entryPoint: "main",
      wgsl: vertexWgsl(backend)
    },
    {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      entryPoint: "main",
      wgsl: pixelWgsl(backend)
    }
  ];
  const bindings = [
    uniformBinding(0, 0, "fragment", 608),
    uniformBinding(1, 1, "vertex", 512),
    uniformBinding(2, 2, "fragment", 352),
    uniformBinding(3, 3, "vertex", 416),
    uniformBinding(4, 4, "fragment", 432),
    ...RESOURCE_NAMES.map((name, index) =>
      resourceBinding(name, registers[index], 5 + index, index)),
    samplerBinding(0, 19),
    samplerBinding(1, 20),
    samplerBinding(2, 21)
  ];
  const selectedOptions = selections();
  return {
    backend,
    filePath: `C:/fixture/quaddetail-${backend}.cewgpu`,
    resourcePath: `res:/fixture/quaddetail-${backend}.cewgpu`,
    analysis: {
      source,
      bodyIndex: 4,
      selectedOptions: structuredClone(selectedOptions),
      passes: [
        {
          techniqueName: "Main",
          passIndex: 0,
          renderStates: 1,
          states: []
        }
      ],
      stages: [
        {
          techniqueName: "Main",
          passIndex: 0,
          stageName: "vertex",
          pipelineInputs: VERTEX_INPUTS.map(pipelineInput),
          bindings: [ constantBuffer(1), constantBuffer(3) ]
        },
        {
          techniqueName: "Main",
          passIndex: 0,
          stageName: "pixel",
          pipelineInputs: PIXEL_INPUTS.map(pipelineInput),
          bindings: [
            ...(backend === "dx11" ? [ analysisSampler(0) ] : []),
            analysisSampler(1),
            analysisSampler(2),
            ...RESOURCE_NAMES.map((name, index) =>
              analysisResource(name, registers[index], index)),
            constantBuffer(0, true),
            constantBuffer(2),
            constantBuffer(4)
          ]
        }
      ]
    },
    metadata: {
      sourcePath: source,
      bodyIndex: 4,
      selectedOptions,
      wgslSelection: {
        mode: "explicit",
        completePasses: true,
        techniqueName: "Main",
        passIndex: 0,
        requestedStageNames: [ "vertex", "pixel" ],
        selectedStageKeys: [ "Main.pass0.vertex", "Main.pass0.pixel" ]
      }
    },
    pipeline: {
      techniqueName: "Main",
      passIndex: 0,
      renderStates: 1,
      states: [],
      shaderModules,
      bindGroups: [ { group: 0, bindings } ]
    }
  };
}

function changedMaterialFields(left, right)
{
  const names = new Set([
    ...Object.keys(left.material),
    ...Object.keys(right.material)
  ]);
  return [ ...names ].filter((name) =>
    JSON.stringify(left.material[name]) !== JSON.stringify(right.material[name]));
}

test("QuadDetailV5 exact static body4 records and resource plans validate", () =>
{
  const dx11 = packageRecord("dx11");
  const dx12 = packageRecord("dx12");
  assert.equal(validateQuadDetailV5PackageRecord(dx11), dx11);
  assert.equal(validateQuadDetailV5PackageRecord(dx12), dx12);
  assert.equal(validateQuadDetailV5PackagePair([ dx11, dx12 ])[1], dx12);

  const dx11Plan = getQuadDetailV5ResourcePlan(dx11);
  const dx12Plan = getQuadDetailV5ResourcePlan(dx12);
  assert.deepEqual(dx11Plan.textures.map((entry) => entry.name), RESOURCE_NAMES);
  assert.deepEqual(dx11Plan.textures.map((entry) => entry.registerIndex), RESOURCE_REGISTERS.dx11);
  assert.deepEqual(dx12Plan.textures.map((entry) => entry.registerIndex), RESOURCE_REGISTERS.dx12);
  assert.deepEqual(dx12Plan.samplers.map((entry) => entry.binding), [ 19, 20, 21 ]);
  assert.equal(dx12Plan.textures.length + dx12Plan.samplers.length + 5, 22);
  assert.equal(Object.isFrozen(dx12Plan), true);
});

test("QuadDetailV5 rejects permutation, IO, sparse material, binding, and bone drift", () =>
{
  const mutations = [
    (record) => { record.analysis.bodyIndex = 0; },
    (record) => { record.metadata.selectedOptions[2].value = "SOPPT_DISABLED"; },
    (record) => { record.analysis.selectedOptions[6].defaultValue = "OTHER"; },
    (record) => { record.metadata.wgslSelection.completePasses = false; },
    (record) => { record.analysis.stages[0].pipelineInputs[1].usedMask = 1; },
    (record) => { record.analysis.stages[1].pipelineInputs[6].registerIndex = 8; },
    (record) => { record.pipeline.shaderModules[0].wgsl =
      record.pipeline.shaderModules[0].wgsl.replace("@location(9)", "@location(8)"); },
    (record) => { record.pipeline.bindGroups[0].bindings[0].layout.buffer.minBindingSize = 592; },
    (record) => { record.pipeline.bindGroups[0].bindings[3].layout.buffer.minBindingSize = 432; },
    (record) => { record.pipeline.bindGroups[0].bindings.pop(); },
    (record) => { record.analysis.stages[0].bindings.push(analysisResource("BoneTransforms", 0, 0)); },
    (record) => {
      record.analysis.stages[1].bindings
        .find((entry) => entry.carbon?.name === "Detail3Map").registerIndex = 99;
    },
    (record) => {
      record.analysis.stages[1].bindings
        .find((entry) => entry.carbon?.hasLocalConstants)
        .carbon.constants.at(-1).offset = 576;
    },
    (record) => {
      record.analysis.stages[1].bindings
        .find((entry) => entry.kind === "sampler" && entry.registerIndex === 1)
        .carbon.sampler.addressU = 3;
    }
  ];
  for (const mutate of mutations)
  {
    const record = packageRecord("dx11");
    mutate(record);
    assert.throws(() => validateQuadDetailV5PackageRecord(record), /QuadDetailV5 fixture/u);
  }
});

test("QuadDetailV5 rejects unordered, aliased, and identical parity inputs", () =>
{
  const dx11 = packageRecord("dx11");
  const dx12 = packageRecord("dx12");
  assert.throws(
    () => validateQuadDetailV5PackagePair([ dx12, dx11 ]),
    /order must be DX11 then DX12/u
  );
  dx12.filePath = dx11.filePath;
  assert.throws(
    () => validateQuadDetailV5PackagePair([ dx11, dx12 ]),
    /distinct physical package files/u
  );
  dx12.filePath = "C:/fixture/quaddetail-dx12.cewgpu";
  dx12.resourcePath = dx11.resourcePath;
  assert.throws(
    () => validateQuadDetailV5PackagePair([ dx11, dx12 ]),
    /distinct logical resource paths/u
  );
  dx12.resourcePath = "res:/fixture/quaddetail-dx12.cewgpu";
  dx12.pipeline.shaderModules.forEach((module, index) =>
  {
    module.wgsl = dx11.pipeline.shaderModules[index].wgsl;
  });
  assert.throws(
    () => validateQuadDetailV5PackagePair([ dx11, dx12 ]),
    /identical WGSL payloads/u
  );
});

test("QuadDetailV5 cases isolate pattern surface and individual detail weights", () =>
{
  const cases = createQuadDetailV5BindingCases(64, 64);
  assert.deepEqual(cases.caseNames, [ "pptNeutral", "surface", "detail1", "detail2" ]);
  assert.equal(Object.isFrozen(cases), true);
  assert.equal(Object.isFrozen(cases.bindingValuesByCase), true);
  const { pptNeutral, surface, detail1, detail2 } = cases.bindingValuesByCase;

  assert.deepEqual(changedMaterialFields(pptNeutral, surface), [
    "PMtl1DiffuseColor",
    "PMtl1FresnelColor",
    "PMtl1Gloss",
    "PMtl2DiffuseColor",
    "PMtl2FresnelColor",
    "PMtl2Gloss"
  ]);
  assert.deepEqual(changedMaterialFields(surface, detail1), [ "Detail1Data" ]);
  assert.deepEqual(changedMaterialFields(surface, detail2), [ "Detail2Data" ]);
  for (const value of [ pptNeutral, surface, detail1, detail2 ])
  {
    assert.deepEqual(value.material.DetailSelector, [ 1, 1, 1, 1 ]);
    assert.deepEqual(value.material.Detail3Data, [ 1, 0, 0, 0 ]);
    assert.deepEqual(value.material.DetailAlbedoColor, [ 0.32, 0.18, 0.08, 1 ]);
    assert.deepEqual(value.material.DetailFresnelColor, [ 0.24, 0.2, 0.16, 1 ]);
    assert.deepEqual(
      value.perObjectPS.customMaskMaterialIDs,
      [ 4, 5, 0, 0, 0, 0, 0, 0 ]
    );
    assert.deepEqual(
      value.perObjectPS.customMaskTargets,
      [ 1, 1, 1, 1, 1, 1, 1, 1 ]
    );
  }
  assert.deepEqual(detail1.material.Detail1Data, [ 1, 0.75, 0, 0 ]);
  assert.deepEqual(detail2.material.Detail2Data, [ 1, 0.75, 0, 0 ]);
});

test("QuadDetailV5 fixture is static, complete, neutral-RGB, and alpha-distinct", () =>
{
  assert.equal(QUAD_DETAIL_V5_TARGET_WIDTH, 64);
  assert.equal(QUAD_DETAIL_V5_TARGET_HEIGHT, 64);
  assert.deepEqual(
    QUAD_DETAIL_V5_VERTEX_BUFFER_LAYOUT.attributes.map((entry) => entry.shaderLocation),
    [ 0, 2, 3, 4, 5, 6 ]
  );
  const fixture = createQuadDetailV5FixtureValues(64, 64);
  assert.ok(fixture.vertices instanceof Float32Array);
  assert.ok(fixture.indices instanceof Uint16Array);
  assert.equal("boneIndices" in fixture, false);
  assert.deepEqual(fixture.textures.map((entry) => entry.name), RESOURCE_NAMES);
  assert.deepEqual(
    fixture.samplers.map((entry) => entry.name),
    [ "Sampler0", "PatternMask1MapSampler", "PatternMask2MapSampler" ]
  );
  const detail1 = fixture.textures.find((entry) => entry.name === "Detail1Map");
  const detail2 = fixture.textures.find((entry) => entry.name === "Detail2Map");
  const detail3 = fixture.textures.find((entry) => entry.name === "Detail3Map");
  for (const detail of [ detail1, detail2, detail3 ])
  {
    for (let offset = 0; offset < detail.data.length; offset += 4)
    {
      assert.deepEqual(Array.from(detail.data.slice(offset, offset + 3)), [ 128, 128, 128 ]);
    }
  }
  assert.deepEqual([ ...new Set(Array.from(detail1.data).filter((_value, index) =>
    index % 4 === 3)) ].sort((a, b) => a - b), [ 48, 208 ]);
  assert.deepEqual([ ...new Set(Array.from(detail2.data).filter((_value, index) =>
    index % 4 === 3)) ].sort((a, b) => a - b), [ 32, 176 ]);
  assert.equal(Array.from(detail3.data).every((value, index) =>
    index % 4 !== 3 || value === 0), true);
  assert.deepEqual(fixture.caseNames, [ "pptNeutral", "surface", "detail1", "detail2" ]);
});
