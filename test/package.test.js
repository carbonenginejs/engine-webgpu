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

test("compute-only packages retain canonical compute visibility and storage layouts", () =>
{
  const code = `
@group(0) @binding(0) var<storage, read_write> values: array<u32>;
@compute @workgroup_size(1)
fn main()
{
  values[0] = values[0] + 1u;
}`;
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    stages: [ {
      key: "Main.pass0.compute",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "compute",
      stageType: 2,
      bindings: [ {
        kind: "uav",
        generatedSymbol: "u0",
        registerIndex: 0,
        registerSpace: 0,
        metadataName: "Values"
      } ]
    } ],
    wgsl: {
      format: "CJS_WGSL_SET",
      formatVersion: 2,
      shaders: [ {
        key: "Main.pass0.compute",
        techniqueName: "Main",
        passIndex: 0,
        stageName: "compute",
        stage: "compute",
        stageType: 2,
        threadGroupSize: [ 1, 1, 1 ],
        entryPoint: "main",
        code,
        sourceMap: []
      } ],
      layouts: [ {
        key: "Main.pass0",
        techniqueName: "Main",
        passIndex: 0,
        bindGroups: [ {
          group: 0,
          bindings: [ {
            identity: "storage-resource:0:0",
            scopeIdentity: "storage-resource:0:0@compute",
            resourceKind: "storage-resource",
            generatedSymbol: "u0",
            registerSpace: 0,
            registerIndex: 0,
            group: 0,
            binding: 0,
            visibility: [ "compute" ],
            type: "array<u32>",
            buffer: { type: "storage", hasDynamicOffset: false, minBindingSize: 4 }
          } ]
        } ]
      } ]
    }
  });

  const pipeline = pkg.GetPipeline("Main", 0);
  assert.equal(pipeline.HasCompleteWgsl(), true);
  assert.equal(pipeline.shaderModules.length, 1);
  assert.equal(pipeline.GetShaderModule("compute").stageType, 2);
  assert.deepEqual(pipeline.GetShaderModule("compute").threadGroupSize, [ 1, 1, 1 ]);
  const binding = pipeline.bindGroups[0].GetBindingAt(0);
  assert(binding instanceof CjsWebGPUBuffer);
  assert.equal(binding.access, "readWrite");
  assert.equal(binding.scopeIdentity, "storage-resource:0:0@compute");
  assert.deepEqual(binding.visibility, [ "compute" ]);
  assert.deepEqual(binding.stages.map((entry) => entry.stageName), [ "compute" ]);
});

test("package shader matching rejects contradictory keyed stage provenance", () =>
{
  const value = {
    stages: [ {
      key: "Main.pass0.compute",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "compute",
      stageType: 2
    } ],
    shaders: [ {
      key: "Main.pass0.compute",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stage: "fragment",
      stageType: 1,
      code: "@fragment fn main() -> @location(0) vec4f { return vec4f(); }"
    } ]
  };
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /inconsistent WGSL provenance/u
  );

  value.shaders[0].stageName = "compute";
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /inconsistent WGSL stage fragment/u
  );

  value.shaders[0].stage = "compute";
  value.shaders[0].stageType = 2;
  value.shaders[0].threadGroupSize = [ 1, 1, 1 ];
  value.stages[0].threadGroupSize = { x: 1, y: 1, z: 1 };
  assert.deepEqual(
    CjsWebGPUPackage.from(value).GetShaderModule("Main.pass0.compute").threadGroupSize,
    [ 1, 1, 1 ]
  );

  value.stages[0].threadGroupSize = { x: 2, y: 1, z: 1 };
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /inconsistent threadGroupSize metadata/u
  );

  value.stages[0].stageName = "pixel";
  value.stages[0].stageType = 1;
  value.shaders[0].stageName = "pixel";
  value.shaders[0].stage = "fragment";
  value.shaders[0].stageType = 1;
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /cannot declare threadGroupSize/u
  );
});

test("render packages normalize only the inactive zero thread-group sentinel", () =>
{
  const value = {
    stages: [ {
      key: "Main.pass0.vertex",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "vertex",
      stageType: 0,
      threadGroupSize: { x: 0, y: 0, z: 0 }
    } ],
    shaders: [ {
      key: "Main.pass0.vertex",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "vertex",
      stage: "vertex",
      stageType: 0,
      threadGroupSize: { x: 0, y: 0, z: 0 },
      entryPoint: "main",
      code: "@vertex fn main() -> @builtin(position) vec4f { return vec4f(); }"
    } ]
  };
  assert.equal(
    CjsWebGPUPackage.from(value).GetShaderModule("Main.pass0.vertex").threadGroupSize,
    null
  );

  value.shaders[0].threadGroupSize = { x: 1, y: 1, z: 1 };
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /cannot declare threadGroupSize/u
  );

  value.shaders[0].threadGroupSize = { x: 0, y: 0, z: 0 };
  value.stages[0].threadGroupSize = { x: 1, y: 1, z: 1 };
  assert.throws(
    () => CjsWebGPUPackage.from(value),
    /cannot declare threadGroupSize/u
  );
});

test("structured WGSL package input accepts only set versions 1 and 2", () =>
{
  for (const formatVersion of [ 1, 2 ])
  {
    const pkg = CjsWebGPUPackage.from({
      wgsl: { format: "CJS_WGSL_SET", formatVersion, shaders: [], layouts: [] }
    });
    assert.equal(pkg.wgsl.formatVersion, formatVersion);
  }
  assert.throws(() => CjsWebGPUPackage.from({
    wgsl: { format: "CJS_WGSL_SET", formatVersion: 3, shaders: [], layouts: [] }
  }), /CJS_WGSL_SET version 1 or 2/u);
  const version2Binding = {
    identity: "sampler:0:0",
    scopeIdentity: "sampler:0:0@fragment",
    resourceKind: "sampler",
    generatedSymbol: "s0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding: 0,
    visibility: [ "fragment" ],
    type: "sampler",
    sampler: { type: "filtering" }
  };
  const version2Package = (binding) => ({
    wgsl: { format: "CJS_WGSL_SET", formatVersion: 2, shaders: [], layouts: [ {
      key: "Main.pass0",
      bindGroups: [ { group: 0, bindings: [ binding ] } ]
    } ] },
    stages: [ {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings: []
    } ]
  });
  assert.throws(() => CjsWebGPUPackage.from(version2Package({
    ...version2Binding,
    scopeIdentity: ""
  })), /invalid scope identity/u);
  const missingIdentity = { ...version2Binding };
  delete missingIdentity.identity;
  assert.throws(() => CjsWebGPUPackage.from(version2Package(missingIdentity)), /requires an explicit D3D identity/u);
  const missingScope = { ...version2Binding };
  delete missingScope.scopeIdentity;
  assert.throws(() => CjsWebGPUPackage.from(version2Package(missingScope)), /requires an explicit scope identity/u);
  assert.throws(() => CjsWebGPUPackage.from(version2Package({
    ...version2Binding,
    scopeIdentity: "sampler:0:0"
  })), /does not cover multiple stages/u);
  const shared = CjsWebGPUPackage.from(version2Package({
    ...version2Binding,
    scopeIdentity: "sampler:0:0",
    visibility: [ "vertex", "fragment" ]
  }));
  assert.equal(shared.pipelines[0].bindGroups[0].bindings[0].scopeIdentity, "sampler:0:0");

  const authoritative = version2Package(version2Binding);
  authoritative.layouts = [ {
    key: "Main.pass0",
    bindGroups: [ { group: 0, bindings: [ { ...version2Binding, scopeIdentity: "" } ] } ]
  } ];
  assert.equal(
    CjsWebGPUPackage.from(authoritative).pipelines[0].bindGroups[0].bindings[0].scopeIdentity,
    "sampler:0:0@fragment"
  );

  const malformedNestedLayouts = version2Package(version2Binding);
  malformedNestedLayouts.wgsl.layouts = { invalid: true };
  malformedNestedLayouts.layouts = authoritative.wgsl.layouts;
  assert.throws(
    () => CjsWebGPUPackage.from(malformedNestedLayouts),
    /structured wgsl shaders and layouts must be arrays when provided/u
  );

  const malformedNestedShaders = version2Package(version2Binding);
  malformedNestedShaders.wgsl.shaders = { invalid: true };
  malformedNestedShaders.shaders = [];
  assert.throws(
    () => CjsWebGPUPackage.from(malformedNestedShaders),
    /structured wgsl shaders and layouts must be arrays when provided/u
  );

  const legacyBinding = { ...version2Binding };
  delete legacyBinding.identity;
  delete legacyBinding.scopeIdentity;
  const legacy = version2Package(legacyBinding);
  legacy.wgsl.formatVersion = 1;
  assert.equal(CjsWebGPUPackage.from(legacy).pipelines[0].bindGroups[0].bindings[0].scopeIdentity, "sampler:0:0");
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

test("canonical WGSL layouts preserve stage-scoped structured and texture t0 resources", () =>
{
  const stages = [ {
    key: "Main.pass0.vertex",
    techniqueName: "Main",
    passIndex: 0,
    stageName: "vertex",
    stageType: 0,
    bindings: [ {
      kind: "resource",
      generatedSymbol: "t0",
      registerIndex: 0,
      registerSpace: 0,
      metadataName: "SkinningData",
      carbon: { type: 7, arrayElements: 1 }
    } ]
  }, {
    key: "Main.pass0.pixel",
    techniqueName: "Main",
    passIndex: 0,
    stageName: "pixel",
    stageType: 1,
    bindings: [ {
      kind: "resource",
      generatedSymbol: "t0",
      registerIndex: 0,
      registerSpace: 0,
      metadataName: "AlbedoMap",
      carbon: { type: 2, arrayElements: 1, isSRGB: true }
    } ]
  } ];
  const bindings = [ {
    identity: "sampled-resource:0:0",
    scopeIdentity: "sampled-resource:0:0@vertex",
    resourceKind: "sampled-resource",
    generatedSymbol: "t0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding: 0,
    visibility: [ "vertex" ],
    type: "array<u32>",
    structureStride: 48,
    buffer: { type: "read-only-storage", hasDynamicOffset: false, minBindingSize: 48 }
  }, {
    identity: "sampled-resource:0:0",
    scopeIdentity: "sampled-resource:0:0@fragment",
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
  const pkg = CjsWebGPUPackage.from({
    format: "CEWGPU",
    version: 1,
    stages,
    layouts: [ {
      key: "Main.pass0",
      bindGroups: [ { group: 0, bindings } ]
    } ]
  });
  const group = pkg.pipelines[0].bindGroups[0];
  const structured = group.GetBindingAt(0);
  const texture = group.GetBindingAt(1);

  assert(structured instanceof CjsWebGPUBuffer);
  assert.equal(structured.access, "readOnly");
  assert.equal(structured.bufferKind, "structuredBuffer");
  assert.equal(structured.identity, "sampled-resource:0:0");
  assert.equal(structured.scopeIdentity, "sampled-resource:0:0@vertex");
  assert.equal(structured.structureStride, 48);
  assert.equal(structured.metadataName, "SkinningData");
  assert.deepEqual(structured.stages.map((entry) => entry.stageName), [ "vertex" ]);
  assert(texture instanceof CjsWebGPUTexture);
  assert.equal(texture.scopeIdentity, "sampled-resource:0:0@fragment");
  assert.equal(texture.metadataName, "AlbedoMap");
  assert.deepEqual(texture.stages.map((entry) => entry.stageName), [ "pixel" ]);
  assert.deepEqual(pkg.ToJSON().pipelines[0].bindGroups[0].bindings.map((entry) => entry.scopeIdentity), [
    "sampled-resource:0:0@vertex",
    "sampled-resource:0:0@fragment"
  ]);

  const inconsistent = structuredClone(bindings);
  inconsistent[0].identity = "sampled-resource:0:9";
  assert.throws(() => CjsWebGPUPackage.from({
    stages,
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: inconsistent } ] } ]
  }), /inconsistent D3D identity/u);

  const malformedScope = structuredClone(bindings);
  malformedScope[0].scopeIdentity = "sampled-resource:0:0@fragment";
  assert.throws(() => CjsWebGPUPackage.from({
    stages,
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: malformedScope } ] } ]
  }), /invalid scope identity/u);

  const mixedForms = structuredClone(bindings);
  mixedForms[0].scopeIdentity = "sampled-resource:0:0";
  mixedForms[0].visibility = [ "vertex", "fragment" ];
  assert.throws(() => CjsWebGPUPackage.from({
    stages,
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: mixedForms } ] } ]
  }), /mixes shared and stage-scoped forms/u);
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

test("read-write storage UAV bindings build readWrite buffers", () => {
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
        kind: "resource",
        generatedSymbol: "u1",
        registerIndex: 1,
        registerSpace: 0,
        metadataName: "OccluderCounters"
      } ]
    } ],
    layouts: [ {
      key: "Main.pass0",
      bindGroups: [ { group: 0, bindings: [ {
        identity: "storage-resource:0:1",
        scopeIdentity: "storage-resource:0:1@fragment",
        resourceKind: "storage-resource",
        generatedSymbol: "u1",
        registerSpace: 0,
        registerIndex: 1,
        group: 0,
        binding: 0,
        visibility: [ "fragment" ],
        type: "array<atomic<u32>>",
        buffer: { type: "storage", hasDynamicOffset: false, minBindingSize: 4 }
      } ] } ]
    } ]
  });
  const uav = pkg.pipelines[0].bindGroups[0].GetBindingAt(0);
  assert(uav instanceof CjsWebGPUBuffer);
  assert.equal(uav.access, "readWrite");
  assert.equal(uav.bufferKind, "rwBuffer");
  assert.equal(uav.scopeIdentity, "storage-resource:0:1@fragment");
  assert.deepEqual(uav.layout.buffer, { type: "storage", hasDynamicOffset: false, minBindingSize: 4 });
});
