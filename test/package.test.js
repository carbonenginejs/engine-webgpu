import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CjsWebGPUBindGroup,
  CjsWebGPUBuffer,
  CjsWebGPUPackage,
  CjsWebGPUSampler,
  CjsWebGPUShaderModule,
  CjsWebGPUTexture,
  normalizeEffectPath,
  shaderModelSuffix,
  toCompiledEffectPath
} from "../src/index.js";
import { buildCopyblitDrawDescriptor } from "../src/core/packageDraw.js";

test("effect-path helpers preserve Carbon basename behavior and quality tiers", () =>
{
  assert.equal(normalizeEffectPath("RES:\\Graphics\\Effect\\Space\\QuadV5.fx"), "res:/graphics/effect/space/quadv5.fx");
  assert.equal(shaderModelSuffix("low"), "sm_lo");
  assert.equal(shaderModelSuffix("medium"), "sm_hi");
  assert.equal(shaderModelSuffix("high"), "sm_depth");
  assert.equal(
    toCompiledEffectPath("res:/graphics/effect/space/quadv5.fx", {
      effectRoot: "/effect.webgpu/",
      quality: "high"
    }),
    "res:/graphics/effect.webgpu/space/quadv5.sm_depth"
  );
});

test("CjsWebGPUPackage builds immutable pass, shader, and bind-group descriptors from ANLS data", () =>
{
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    sourcePath: "res:/graphics/effect.dx11/space/quadv5.sm_depth",
    metadata: {
      effectName: "quadv5"
    },
    analysis: {
      effectName: "quadv5",
      bodyIndex: 0,
      selectedOptions: [ { name: "QUALITY", value: "HIGH", source: "local" } ],
      passes: [ {
        techniqueName: "Main",
        passIndex: 0,
        renderStates: 12,
        states: [ { state: "CullMode", value: 2 } ]
      } ],
      stages: [ {
        key: "Main.pass0.vertex",
        techniqueName: "Main",
        passIndex: 0,
        stageName: "vertex",
        stageType: 0,
        pipelineInputs: [ { usage: "POSITION", registerIndex: 0 } ],
        bindings: [
          {
            kind: "constantBuffer",
            generatedSymbol: "cb0",
            registerIndex: 0,
            registerCount: 1,
            arrayCount: 1,
            metadataName: "$LocalConstants",
            carbon: {
              hasLocalConstants: true,
              constantValueSize: 64
            },
            annotations: []
          },
          {
            kind: "resource",
            generatedSymbol: "t0",
            registerIndex: 0,
            registerCount: 1,
            arrayCount: 1,
            metadataName: "AlbedoMap",
            carbon: {
              name: "AlbedoMap",
              type: 2,
              arrayElements: 1,
              isSRGB: true
            },
            annotations: []
          },
          {
            kind: "sampler",
            generatedSymbol: "s0",
            registerIndex: 0,
            registerCount: 1,
            arrayCount: 1,
            metadataName: "AlbedoSampler",
            carbon: {
              name: "AlbedoSampler"
            },
            annotations: []
          }
        ]
      }, {
        key: "Main.pass0.pixel",
        techniqueName: "Main",
        passIndex: 0,
        stageName: "pixel",
        stageType: 1,
        bindings: [
          {
            kind: "resource",
            generatedSymbol: "t0",
            registerIndex: 0,
            registerCount: 1,
            arrayCount: 1,
            metadataName: "AlbedoMap",
            carbon: {
              name: "AlbedoMap",
              type: 2,
              arrayElements: 1,
              isSRGB: true
            },
            annotations: []
          }
        ]
      } ]
    },
    stages: [ {
      key: "Main.pass0.vertex",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "vertex",
      stageType: 0,
      pipelineInputs: [ { usage: "POSITION", registerIndex: 0 } ],
      bindings: [
        {
          kind: "constantBuffer",
          generatedSymbol: "cb0",
          registerIndex: 0,
          registerCount: 1,
          arrayCount: 1,
          metadataName: "$LocalConstants",
          carbon: {
            hasLocalConstants: true,
            constantValueSize: 64
          },
          annotations: []
        },
        {
          kind: "resource",
          generatedSymbol: "t0",
          registerIndex: 0,
          registerCount: 1,
          arrayCount: 1,
          metadataName: "AlbedoMap",
          carbon: {
            name: "AlbedoMap",
            type: 2,
            arrayElements: 1,
            isSRGB: true
          },
          annotations: []
        },
        {
          kind: "sampler",
          generatedSymbol: "s0",
          registerIndex: 0,
          registerCount: 1,
          arrayCount: 1,
          metadataName: "AlbedoSampler",
          carbon: {
            name: "AlbedoSampler"
          },
          annotations: []
        }
      ]
    }, {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings: [
        {
          kind: "resource",
          generatedSymbol: "t0",
          registerIndex: 0,
          registerCount: 1,
          arrayCount: 1,
          metadataName: "AlbedoMap",
          carbon: {
            name: "AlbedoMap",
            type: 2,
            arrayElements: 1,
            isSRGB: true
          },
          annotations: []
        },
        {
          kind: "sampler",
          generatedSymbol: "s0",
          registerIndex: 0,
          registerCount: 1,
          arrayCount: 1,
          metadataName: "AlbedoSampler",
          carbon: {
            name: "AlbedoSampler"
          },
          annotations: []
        }
      ]
    } ],
    shaders: [ {
      key: "Main.pass0.vertex",
      source: "@vertex fn main() -> @builtin(position) vec4f { return vec4f(); }"
    }, {
      key: "Main.pass0.pixel",
      source: "@fragment fn main() -> @location(0) vec4f { return vec4f(1.0); }"
    } ]
  });

  assert.equal(pkg.format, "CEWGPU");
  assert.equal(pkg.shaderModules.length, 2);
  assert.equal(pkg.pipelines.length, 1);
  assert.equal(pkg.bindGroups.length, 1);
  assert(pkg.shaderModules[0] instanceof CjsWebGPUShaderModule);
  assert(pkg.bindGroups[0] instanceof CjsWebGPUBindGroup);

  const pipeline = pkg.GetPipeline("Main", 0);
  assert(pipeline);
  assert.equal(pipeline.HasCompleteWgsl(), true);
  assert.equal(pipeline.GetShaderModule("vertex").HasWgsl(), true);
  assert.equal(pipeline.bindGroups[0].bindings.length, 3);

  const cb0 = pipeline.bindGroups[0].GetBinding("constantBuffer:cb0:$LocalConstants:0");
  const t0 = pipeline.bindGroups[0].GetBinding("resource:t0:AlbedoMap:0");
  const s0 = pipeline.bindGroups[0].GetBinding("sampler:s0:AlbedoSampler:0");

  assert(cb0 instanceof CjsWebGPUBuffer);
  assert.equal(cb0.access, "uniform");
  assert(t0 instanceof CjsWebGPUTexture);
  assert.equal(t0.textureKind, "2d");
  assert.equal(t0.stages.length, 2);
  assert(s0 instanceof CjsWebGPUSampler);

  assert.throws(() =>
  {
    pkg.pipelines.push("nope");
  }, /read only|object is not extensible|Cannot add property/i);
});

test("binding keys preserve distinct D3D register spaces", () =>
{
  const bindings = [ 0, 2 ].map((registerSpace) => ({
    kind: "resource",
    generatedSymbol: "t0",
    registerIndex: 0,
    registerSpace,
    metadataName: "Texture0",
    carbon: { name: "Texture0", type: 2, arrayElements: 1 }
  }));
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    stages: [ {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings
    } ]
  });

  const merged = pkg.bindGroups[0].bindings;
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((entry) => entry.key), [
    "resource:t0:Texture0:0:space0",
    "resource:t0:Texture0:0:space2"
  ]);
});

test("CJS_WGSL_SET code records retain entry points and DXBC source maps", () =>
{
  const code = "@fragment fn translated() -> @location(0) vec4f { return vec4f(1); }";
  const sourceMap = [ { line: 1, instructionIndex: 4, dxbcOffset: 12 } ];
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    stages: [ {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1
    } ],
    shaders: [ {
      key: "Main.pass0.pixel",
      stageName: "pixel",
      entryPoint: "translated",
      code,
      sourceMap
    } ]
  });

  const module = pkg.shaderModules[0];
  assert.equal(module.wgsl, code);
  assert.equal(module.entryPoint, "translated");
  assert.deepEqual(module.sourceMap, sourceMap);
});

test("canonical WGSL layouts own numeric bind groups and survive missing ANLS metadata", () =>
{
  const canonicalBindings = [ {
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
  }, {
    resourceKind: "sampler",
    generatedSymbol: "s0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding: 2,
    visibility: [ "fragment" ],
    type: "sampler",
    sampler: { type: "filtering" }
  } ];
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    stages: [ {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings: [ {
        kind: "constantBuffer",
        generatedSymbol: "cb0",
        registerIndex: 0,
        registerSpace: 0,
        metadataName: "$LocalConstants",
        carbon: { constantValueSize: 48 }
      }, {
        kind: "resource",
        generatedSymbol: "t0",
        registerIndex: 0,
        registerSpace: 0,
        metadataName: "Texture0",
        carbon: { type: 2, arrayElements: 1 }
      } ]
    } ],
    layouts: [ {
      key: "Main.pass0",
      bindGroups: [ { group: 0, bindings: canonicalBindings } ]
    } ]
  });

  const group = pkg.pipelines[0].bindGroups[0];
  assert.equal(group.group, 0);
  assert.equal(group.bindings.length, 3);
  assert(group.GetBindingAt(0) instanceof CjsWebGPUBuffer);
  assert(group.GetBindingAt(1) instanceof CjsWebGPUTexture);
  assert(group.GetBindingAt(2) instanceof CjsWebGPUSampler);
  assert.equal(group.GetBindingAt(0).layout.buffer.minBindingSize, 48);
  assert.equal(group.GetBindingAt(0).metadataName, "$LocalConstants");
  assert.equal(group.GetBindingAt(2).sourceTruth, "wgsl-layout");
  assert.deepEqual(group.GetBindingAt(2).visibility, [ "fragment" ]);
  assert.deepEqual(group.GetBindingAt(2).stages, [ {
    key: "Main.pass0.pixel",
    stageName: "pixel",
    stageType: 1
  } ]);

  const collision = structuredClone(canonicalBindings);
  collision[2].binding = 1;
  assert.throws(() => CjsWebGPUPackage.from({
    stages: pkg.ToJSON().stages,
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: collision } ] } ]
  }), /duplicates group\/binding 0:1/i);
});

test("CjsWebGPUPackage.fromBytes accepts an injected reader", () =>
{
  const pkg = CjsWebGPUPackage.fromBytes(new Uint8Array([ 1, 2, 3 ]), {
    read(bytes)
    {
      assert.equal(bytes.length, 3);
      return {
        format: "CEWGPU",
        version: 1,
        stages: [],
        shaders: []
      };
    }
  });

  assert.equal(pkg.version, 1);
  assert.deepEqual(pkg.ToJSON().pipelines, []);
});

function copyblitDrawPipeline()
{
  const layoutBindings = [ {
    resourceKind: "uniform-buffer", generatedSymbol: "cb0", registerSpace: 0, registerIndex: 0,
    group: 0, binding: 0, visibility: [ "fragment" ], type: "array<vec4<f32>, 3>",
    buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 48 }
  }, {
    resourceKind: "sampled-resource", generatedSymbol: "t0", registerSpace: 0, registerIndex: 0,
    group: 0, binding: 1, visibility: [ "fragment" ], type: "texture_2d<f32>",
    texture: { sampleType: "float", viewDimension: "2d", multisampled: false }
  }, {
    resourceKind: "sampler", generatedSymbol: "s0", registerSpace: 0, registerIndex: 0,
    group: 0, binding: 2, visibility: [ "fragment" ], type: "sampler",
    sampler: { type: "filtering" }
  } ];
  const pkg = CjsWebGPUPackage.from({
    stages: [
      { key: "Main.pass0.vertex", techniqueName: "Main", passIndex: 0, stageName: "vertex", stageType: 0 },
      { key: "Main.pass0.pixel", techniqueName: "Main", passIndex: 0, stageName: "pixel", stageType: 1 }
    ],
    shaders: [
      { key: "Main.pass0.vertex", entryPoint: "vs", code: "@vertex fn vs() -> @builtin(position) vec4f { return vec4f(); }", sourceMap: [] },
      { key: "Main.pass0.pixel", entryPoint: "ps", code: "@fragment fn ps() -> @location(0) vec4f { return vec4f(1); }", sourceMap: [] }
    ],
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: layoutBindings } ] } ]
  });
  return pkg.GetPipeline("Main", 0).ToJSON();
}

test("package copyblit draw preserves canonical numeric layouts and rejects unsupported resources", () =>
{
  const pipeline = copyblitDrawPipeline();
  const descriptor = buildCopyblitDrawDescriptor(pipeline);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.deepEqual(descriptor.shaders.map((entry) => [ entry.stage, entry.entryPoint ]), [
    [ "vertex", "vs" ],
    [ "fragment", "ps" ]
  ]);
  assert.deepEqual(descriptor.bindGroups[0].bindings.map((entry) => [ entry.identity, entry.binding ]), [
    [ "uniform-buffer:0:0", 0 ],
    [ "sampled-resource:0:0", 1 ],
    [ "sampler:0:0", 2 ]
  ]);

  const translatedState = structuredClone(pipeline);
  translatedState.renderStates = 1;
  translatedState.states = [
    { state: 19, value: 2 }, { state: 20, value: 1 }, { state: 27, value: 1 }, { state: 171, value: 1 },
    { state: 206, value: 1 }, { state: 207, value: 2 }, { state: 208, value: 1 }, { state: 209, value: 1 }
  ];
  assert.deepEqual(buildCopyblitDrawDescriptor(translatedState).blend, {
    color: { operation: "add", srcFactor: "one", dstFactor: "zero" },
    alpha: { operation: "add", srcFactor: "one", dstFactor: "zero" }
  });
  translatedState.states[0].value = 5;
  assert.throws(() => buildCopyblitDrawDescriptor(translatedState), /unsupported render state 19:5/i);

  const missingSampler = structuredClone(pipeline);
  missingSampler.bindGroups[0].bindings.pop();
  assert.throws(() => buildCopyblitDrawDescriptor(missingSampler), /missing fixture identity sampler:0:0/i);

  const dynamicUniform = structuredClone(pipeline);
  dynamicUniform.bindGroups[0].bindings[0].dynamic = true;
  assert.throws(() => buildCopyblitDrawDescriptor(dynamicUniform), /cannot use dynamic offsets/i);
});
