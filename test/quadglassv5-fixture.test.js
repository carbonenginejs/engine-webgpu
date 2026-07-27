import assert from "node:assert/strict";
import { test } from "node:test";

import {
  QUAD_GLASS_V5_CLEAR_TARGETS,
  QUAD_GLASS_V5_SELECTION,
  QUAD_GLASS_V5_TARGET_HEIGHT,
  QUAD_GLASS_V5_TARGET_WIDTH,
  QUAD_GLASS_V5_VERTEX_BUFFER_LAYOUT,
  createQuadGlassV5FixtureValues,
  getQuadGlassV5PrimitiveRecipe,
  getQuadGlassV5ResourcePlan,
  validateQuadGlassV5PackagePair,
  validateQuadGlassV5PackageRecord
} from "../harness/webgpu/quadGlassV5Fixture.js";

const MATERIAL_NAMES = Object.freeze([
  "GeneralGlowColor",
  "Mtl1DiffuseColor",
  "Mtl2DiffuseColor",
  "Mtl3DiffuseColor",
  "Mtl4DiffuseColor",
  "Mtl1FresnelColor",
  "Mtl2FresnelColor",
  "Mtl3FresnelColor",
  "Mtl4FresnelColor",
  "Mtl1Gloss",
  "Mtl2Gloss",
  "Mtl3Gloss",
  "Mtl4Gloss"
]);

const RESOURCES = Object.freeze({
  dx11: Object.freeze([
    [ "EveSpaceSceneEnvMap", 0, "cube" ],
    [ "EveSceneFogVolumeMap", 1, "2d-array" ],
    [ "NormalMap", 2, "2d" ],
    [ "GlowMap", 3, "2d" ],
    [ "RoughnessMap", 4, "2d" ],
    [ "MaterialMap", 5, "2d" ],
    [ "PaintMaskMap", 6, "2d" ]
  ]),
  dx12: Object.freeze([
    [ "EveSpaceSceneEnvMap", 0, "cube" ],
    [ "EveSceneFogVolumeMap", 2, "2d-array" ],
    [ "NormalMap", 4, "2d" ],
    [ "GlowMap", 5, "2d" ],
    [ "RoughnessMap", 8, "2d" ],
    [ "MaterialMap", 10, "2d" ],
    [ "PaintMaskMap", 11, "2d" ]
  ])
});

const UNIFORMS = Object.freeze([
  [ 0, 0, "fragment", 224 ],
  [ 1, 1, "vertex", 512 ],
  [ 2, 2, "fragment", 384 ],
  [ 3, 3, "vertex", 128 ],
  [ 4, 4, "fragment", 208 ]
]);

function selectionEntries()
{
  return Object.entries(QUAD_GLASS_V5_SELECTION).map(([ name, value ]) => ({
    name,
    value,
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: value,
    source: "local"
  }));
}

function uniformBinding(registerIndex, binding, visibility, minBindingSize)
{
  const identity = `uniform-buffer:0:${registerIndex}`;
  return {
    identity,
    scopeIdentity: `${identity}@${visibility}`,
    resourceKind: "uniform-buffer",
    registerSpace: 0,
    registerIndex,
    sourceTruth: "wgsl-layout",
    group: 0,
    binding,
    dynamic: false,
    visibility: [ visibility ],
    layout: {
      buffer: {
        type: "uniform",
        hasDynamicOffset: false,
        minBindingSize
      },
      texture: null,
      sampler: null
    }
  };
}

function resourceBinding(name, registerIndex, viewDimension, binding)
{
  const identity = `sampled-resource:0:${registerIndex}`;
  return {
    name,
    identity,
    scopeIdentity: `${identity}@fragment`,
    resourceKind: "sampled-resource",
    registerSpace: 0,
    registerIndex,
    sourceTruth: "wgsl-layout",
    group: 0,
    binding,
    dynamic: false,
    visibility: [ "fragment" ],
    layout: {
      buffer: null,
      texture: {
        sampleType: "float",
        viewDimension,
        multisampled: false
      },
      sampler: null
    }
  };
}

function samplerBinding(registerIndex, binding)
{
  const identity = `sampler:0:${registerIndex}`;
  return {
    identity,
    scopeIdentity: `${identity}@fragment`,
    resourceKind: "sampler",
    registerSpace: 0,
    registerIndex,
    sourceTruth: "wgsl-layout",
    group: 0,
    binding,
    dynamic: false,
    visibility: [ "fragment" ],
    layout: {
      buffer: null,
      texture: null,
      sampler: { type: "filtering" }
    }
  };
}

function materialBinding()
{
  return {
    kind: "constantBuffer",
    registerSpace: 0,
    registerIndex: 0,
    carbon: {
      hasLocalConstants: true,
      constantValueSize: 224,
      constants: MATERIAL_NAMES.map((name, index) => ({
        name,
        offset: 16 + index * 16,
        size: 16,
        type: 0,
        dimension: 4,
        elements: 0
      }))
    }
  };
}

function staticSampler(registerIndex)
{
  return {
    kind: "sampler",
    registerSpace: 0,
    registerIndex,
    carbon: {
      name: null,
      sampler: registerIndex === 0
        ? {
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
        : {
            comparison: false,
            minFilter: 2,
            magFilter: 2,
            mipFilter: 2,
            addressU: 3,
            addressV: 3,
            addressW: 3,
            mipLODBias: 0,
            maxAnisotropy: 16,
            isDynamic: false
          }
    }
  };
}

function vertexWgsl(suffix)
{
  return `struct VertexInput {
@location(0) input0: vec3<f32>,
@location(2) input2: vec2<f32>,
@location(3) input3: vec3<f32>,
@location(4) input4: vec3<f32>,
@location(5) input5: vec3<f32>,
@location(6) input6: vec2<f32>,
};
@vertex fn main(input: VertexInput) -> @builtin(position) vec4<f32> {
return vec4<f32>(input.input0, ${suffix}.0);
}`;
}

function pixelWgsl(suffix)
{
  return `struct FragmentInput {
@builtin(position) position: vec4<f32>,
@builtin(front_facing) front_facing: bool,
@location(1) input1: vec4<f32>,
@location(2) input2: vec3<f32>,
@location(3) input3: vec3<f32>,
@location(4) input4: vec3<f32>,
@location(5) input5: vec4<f32>,
@location(8) input8: vec4<f32>,
};
struct PixelOutput {
@location(0) output0: vec4<f32>,
@location(1) output1: vec4<f32>,
};
@fragment fn main(input: FragmentInput) -> PixelOutput {
var output: PixelOutput;
output.output0 = vec4<f32>(select(-${suffix}.0, ${suffix}.0, input.front_facing));
output.output1 = vec4<f32>(0.0);
return output;
}`;
}

function validRecord(backend)
{
  const source =
    `E:/fixtures/res/graphics/effect.${backend}/managed/space/spaceobject/v5/quad/` +
    "unpacked_quadglassv5.sm_hi";
  const resources = RESOURCES[backend];
  const selectedOptions = selectionEntries();
  const analysisBindings = [
    materialBinding(),
    ...resources.map(([ name, registerIndex ]) => ({
      kind: "resource",
      registerSpace: 0,
      registerIndex,
      carbon: { name }
    })),
    ...(backend === "dx11" ? [ staticSampler(0), staticSampler(1) ] : [])
  ];
  const analysisStages = [];
  for (const passIndex of [ 0, 1 ])
  {
    analysisStages.push(
      {
        techniqueName: "Main",
        passIndex,
        stageName: "vertex",
        pipelineInputs: [
          { registerIndex: 0, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 1, usedMask: 0, dimension: 4, type: 2 },
          { registerIndex: 2, usedMask: 3, dimension: 2, type: 0 },
          { registerIndex: 3, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 4, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 5, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 6, usedMask: 3, dimension: 2, type: 0 }
        ],
        bindings: []
      },
      {
        techniqueName: "Main",
        passIndex,
        stageName: "pixel",
        pipelineInputs: [
          { registerIndex: 1, usedMask: 3, dimension: 4, type: 0 },
          { registerIndex: 2, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 3, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 4, usedMask: 7, dimension: 3, type: 0 },
          { registerIndex: 5, usedMask: 15, dimension: 4, type: 0 },
          { registerIndex: 6, usedMask: 0, dimension: 4, type: 0 },
          { registerIndex: 8, usedMask: 11, dimension: 4, type: 0 }
        ],
        bindings: structuredClone(analysisBindings)
      }
    );
  }
  const makePipeline = (passIndex) => ({
    techniqueName: "Main",
    passIndex,
    renderStates: passIndex === 0 ? 1 : 2,
    states: [ { state: 22, value: passIndex === 0 ? 3 : 2 } ],
    shaderModules: [
      {
        key: `Main.pass${passIndex}.vertex`,
        techniqueName: "Main",
        passIndex,
        stageName: "vertex",
        stageType: 0,
        entryPoint: "main",
        wgsl: vertexWgsl(backend === "dx11" ? 1 : 2)
      },
      {
        key: `Main.pass${passIndex}.pixel`,
        techniqueName: "Main",
        passIndex,
        stageName: "pixel",
        stageType: 1,
        entryPoint: "main",
        wgsl: pixelWgsl(backend === "dx11" ? 1 : 2)
      }
    ],
    bindGroups: [ {
      group: 0,
      bindings: [
        ...UNIFORMS.map((entry) => uniformBinding(...entry)),
        ...resources.map(([ name, registerIndex, viewDimension ], index) =>
          resourceBinding(name, registerIndex, viewDimension, 5 + index)),
        samplerBinding(0, 12),
        samplerBinding(1, 13)
      ]
    } ]
  });
  return {
    backend,
    label: `unpacked_quadglassv5.${backend}.cewgpu`,
    filePath: `E:/fixtures/unpacked_quadglassv5.${backend}.cewgpu`,
    resourcePath: `res:/webgpu-harness/quadglassv5/${backend}.cewgpu`,
    analysis: {
      source,
      bodyIndex: 0,
      selectedOptions,
      passes: [
        {
          techniqueName: "Main",
          passIndex: 0,
          renderStates: 1,
          states: [ { state: 22, value: 3 } ]
        },
        {
          techniqueName: "Main",
          passIndex: 1,
          renderStates: 2,
          states: [ { state: 22, value: 2 } ]
        }
      ],
      stages: analysisStages
    },
    metadata: {
      sourcePath: source,
      bodyIndex: 0,
      selectedOptions: selectionEntries(),
      wgslSelection: {
        mode: "explicit",
        techniqueName: "Main",
        passIndex: null,
        completePasses: true,
        requestedStageNames: [],
        selectedStageKeys: [
          "Main.pass0.vertex",
          "Main.pass0.pixel",
          "Main.pass1.vertex",
          "Main.pass1.pixel"
        ]
      }
    },
    pipelines: [ makePipeline(0), makePipeline(1) ]
  };
}

test("QuadGlassV5 fixture supplies the exact active geometry and texture dimensions", () =>
{
  const values = createQuadGlassV5FixtureValues(
    QUAD_GLASS_V5_TARGET_WIDTH,
    QUAD_GLASS_V5_TARGET_HEIGHT
  );
  assert.equal(values.vertices.length, 26 * 16);
  assert.equal(values.indices.length, 72);
  assert.equal(values.indices[36], 13);
  assert.equal(values.indices[37], 15);
  assert.equal(values.indices[38], 14);
  assert.deepEqual(
    QUAD_GLASS_V5_VERTEX_BUFFER_LAYOUT.attributes.map((entry) => entry.shaderLocation),
    [ 0, 2, 3, 4, 5, 6 ]
  );
  assert.deepEqual(getQuadGlassV5PrimitiveRecipe(0), {
    frontFace: "cw",
    cullMode: "back"
  });
  assert.deepEqual(getQuadGlassV5PrimitiveRecipe(1), {
    frontFace: "cw",
    cullMode: "front"
  });
  assert.throws(() => getQuadGlassV5PrimitiveRecipe(2), /pass 0 or 1/u);

  const signedAreas = [];
  for (let index = 0; index < values.indices.length; index += 3)
  {
    const points = [ 0, 1, 2 ].map((offset) =>
    {
      const vertex = values.indices[index + offset] * 16;
      return [ values.vertices[vertex], values.vertices[vertex + 1] ];
    });
    signedAreas.push(
      (points[1][0] - points[0][0]) * (points[2][1] - points[0][1])
        - (points[1][1] - points[0][1]) * (points[2][0] - points[0][0])
    );
  }
  assert.equal(signedAreas.slice(0, 12).every((area) => area < 0), true);
  assert.equal(signedAreas.slice(12).every((area) => area > 0), true);
  assert.deepEqual(QUAD_GLASS_V5_CLEAR_TARGETS, [
    [ 0, 255, 0, 255 ],
    [ 255, 0, 255, 255 ]
  ]);
  assert.deepEqual(
    values.textures.map(({ name, dimension }) => [ name, dimension ]),
    [
      [ "EveSpaceSceneEnvMap", "cube" ],
      [ "NormalMap", "2d" ],
      [ "GlowMap", "2d" ],
      [ "RoughnessMap", "2d" ],
      [ "MaterialMap", "2d" ],
      [ "OpaquePaintMaskMap", "2d" ],
      [ "TransparentPaintMaskMap", "2d" ],
      [ "EveSceneFogVolumeMap", "2d-array" ]
    ]
  );
  assert.deepEqual(values.bindingValues.perFramePS.VolumetricSlices, [ 1, 2, 3, 4 ]);
  assert.equal(
    values.textures.find((entry) => entry.name === "EveSceneFogVolumeMap")
      .depthOrArrayLayers,
    4
  );
  assert.deepEqual(Object.keys(values.textureResourceVariants), [ "base", "transparentPaint" ]);
  assert.deepEqual(values.textureResourceVariants.base, {
    PaintMaskMap: "OpaquePaintMaskMap"
  });
  assert.deepEqual(
    values.samplers.map(({ name, addressModeU, addressModeV, maxAnisotropy }) => ({
      name,
      addressModeU,
      addressModeV,
      maxAnisotropy
    })),
    [
      {
        name: "SurfaceSampler",
        addressModeU: "repeat",
        addressModeV: "repeat",
        maxAnisotropy: 16
      },
      {
        name: "FogSampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        maxAnisotropy: 16
      }
    ]
  );
});

test("QuadGlassV5 validates the ordered default-body DX11/DX12 contract", () =>
{
  const dx11 = validRecord("dx11");
  const dx12 = validRecord("dx12");
  assert.equal(validateQuadGlassV5PackageRecord(dx11), dx11);
  assert.deepEqual(validateQuadGlassV5PackagePair([ dx11, dx12 ]), [ dx11, dx12 ]);

  const left = getQuadGlassV5ResourcePlan(dx11);
  const right = getQuadGlassV5ResourcePlan(dx12);
  assert.deepEqual(left.textures.map((entry) => entry.registerIndex), [ 0, 1, 2, 3, 4, 5, 6 ]);
  assert.deepEqual(right.textures.map((entry) => entry.registerIndex), [ 0, 2, 4, 5, 8, 10, 11 ]);
  assert.deepEqual(left.textures.map((entry) => entry.viewDimension), [
    "cube", "2d-array", "2d", "2d", "2d", "2d", "2d"
  ]);
  assert.deepEqual(left.samplers.map((entry) => entry.registerIndex), [ 0, 1 ]);
});

test("QuadGlassV5 rejects provenance, pass-state, reflection, and pair drift", () =>
{
  const dx11 = validRecord("dx11");
  const dx12 = validRecord("dx12");

  const wrongBody = structuredClone(dx11);
  wrongBody.analysis.bodyIndex = 1;
  assert.throws(() => validateQuadGlassV5PackageRecord(wrongBody), /body index 0/u);

  const wrongSelection = structuredClone(dx11);
  wrongSelection.metadata.selectedOptions[2].value = "SOPPT_ENABLED";
  assert.throws(() => validateQuadGlassV5PackageRecord(wrongSelection), /SOPPT_DISABLED/u);

  const wrongPass = structuredClone(dx11);
  wrongPass.pipelines[0].states[0].value = 2;
  assert.throws(
    () => validateQuadGlassV5PackageRecord(wrongPass),
    /complementary cull state/u
  );

  const wrongAnalysisPass = structuredClone(dx11);
  wrongAnalysisPass.analysis.passes[1].states[0].value = 3;
  assert.throws(
    () => validateQuadGlassV5PackageRecord(wrongAnalysisPass),
    /analysis.*complementary Main cull states/u
  );

  const wrongFog = structuredClone(dx12);
  wrongFog.pipelines[0].bindGroups[0].bindings[6].layout.texture.viewDimension = "2d";
  assert.throws(() => validateQuadGlassV5PackageRecord(wrongFog), /texture layout/u);

  const wrongMaterial = structuredClone(dx11);
  wrongMaterial.analysis.stages[1].bindings[0].carbon.constants[0].name = "Changed";
  assert.throws(() => validateQuadGlassV5PackageRecord(wrongMaterial), /GeneralGlowColor/u);

  const missingFrontFacing = structuredClone(dx11);
  missingFrontFacing.pipelines[0].shaderModules[1].wgsl =
    missingFrontFacing.pipelines[0].shaderModules[1].wgsl
      .replace("@builtin(front_facing) front_facing: bool,", "");
  missingFrontFacing.pipelines[1].shaderModules[1].wgsl =
    missingFrontFacing.pipelines[0].shaderModules[1].wgsl;
  assert.throws(
    () => validateQuadGlassV5PackageRecord(missingFrontFacing),
    /front_facing/u
  );

  const sameFile = structuredClone(dx12);
  sameFile.filePath = dx11.filePath;
  assert.throws(
    () => validateQuadGlassV5PackagePair([ dx11, sameFile ]),
    /distinct physical/u
  );
});
