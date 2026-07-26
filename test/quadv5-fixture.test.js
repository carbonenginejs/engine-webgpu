import assert from "node:assert/strict";
import { test } from "node:test";

import {
  QUADV5_CLEAR_TARGETS,
  QUADV5_PPT_SELECTION,
  QUADV5_SKINNED_PPT_SELECTION,
  QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT,
  QUADV5_TARGET_HEIGHT,
  QUADV5_TARGET_WIDTH,
  QUADV5_VERTEX_BUFFER_LAYOUT,
  createQuadV5FixtureValues,
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

function selections(skinned = false)
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
  const selection = skinned ? QUADV5_SKINNED_PPT_SELECTION : QUADV5_PPT_SELECTION;
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

function analysisPixelBindings(backend)
{
  const resources = RESOURCE_REGISTERS[backend].map((registerIndex, index) => ({
    kind: "resource",
    registerSpace: 0,
    registerIndex,
    carbon: { name: RESOURCE_NAMES[index] }
  }));
  const samplers = [
    ...(backend === "dx11" ? [ {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 0,
      carbon: {
        name: null,
        sampler: {
          comparison: false,
          minFilter: 3,
          magFilter: 2,
          mipFilter: 2,
          addressU: 1,
          addressV: 1,
          addressW: 3,
          mipLODBias: 0,
          maxAnisotropy: 16,
          isDynamic: false
        }
      }
    } ] : []),
    {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 1,
      carbon: { name: "PatternMask1MapSampler" }
    },
    {
      kind: "sampler",
      registerSpace: 0,
      registerIndex: 2,
      carbon: { name: "PatternMask2MapSampler" }
    }
  ];
  return [ ...resources, ...samplers ];
}

function pipelineBindings(backend, skinned = false)
{
  const uniforms = [
    binding("uniform-buffer", 0, 0, "fragment", {
      buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 384 }
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
  const textures = RESOURCE_REGISTERS[backend].map((registerIndex, index) =>
    binding("sampled-resource", registerIndex, (skinned ? 6 : 5) + index, "fragment", {
      texture: {
        sampleType: "float",
        viewDimension: index === 0 ? "cube" : "2d",
        multisampled: false
      }
    }));
  const samplers = [ 0, 1, 2 ].map((registerIndex) =>
    binding("sampler", registerIndex, (skinned ? 17 : 16) + registerIndex, "fragment", {
      sampler: { type: "filtering" }
    }));
  return [ ...uniforms, ...bone, ...textures, ...samplers ];
}

function validRecord(backend = "dx11", variant = "static")
{
  const skinned = variant === "skinned";
  const selectedOptions = selections(skinned);
  const stem = skinned ? "unpackedskinned_quadv5" : "unpacked_quadv5";
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
      stages: [
        {
          techniqueName: "Main",
          passIndex: 0,
          stageName: "vertex",
          pipelineInputs: [
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
            carbon: { name: "BoneTransforms" }
          } ] : []
        },
        {
          techniqueName: "Main",
          passIndex: 0,
          stageName: "pixel",
          bindings: analysisPixelBindings(backend)
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
      shaderModules: [
        {
          key: "Main.pass0.vertex",
          techniqueName: "Main",
          passIndex: 0,
          stageName: "vertex",
          stageType: 0,
          entryPoint: "main",
          wgsl: [
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
          wgsl: "@location(0) output0: vec4f, @location(1) output1: vec4f"
        }
      ],
      bindGroups: [ {
        group: 0,
        bindings: pipelineBindings(backend, skinned)
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
  assert.deepEqual(values.perFramePS.TargetResolution, [ 64, 64 ]);
  assert.deepEqual(values.perObjectPS.shipData, [ 0, 1, 0, 0 ]);
  assert.deepEqual(QUADV5_CLEAR_TARGETS, [ [ 0, 255, 0, 255 ], [ 255, 0, 255, 255 ] ]);
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
