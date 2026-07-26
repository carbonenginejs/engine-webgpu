# Public API reference

Status: Experimental
Scope: `@carbonenginejs/engine-webgpu`
Audience: Users and renderer integrators
Summary: Lists the current public exports and their supported responsibilities.

## Package descriptors

- `CjsWebGPUPackage` consumes decoded CEWGPU data and exposes immutable package
  and pipeline records.
- `CjsWebGPUPipeline`, `CjsWebGPUShaderModule`, `CjsWebGPUBindGroup`,
  `CjsWebGPUResource`, `CjsWebGPUBuffer`, `CjsWebGPUTexture`, and
  `CjsWebGPUSampler` represent immutable normalized descriptors.

Use `CjsWebGPUPackage.from(packageJson)` for decoded plain data or
`CjsWebGPUPackage.fromBytes(bytes, { read, readOptions })` with an explicitly
injected reader function and optional reader options.

## Device boundary

`CjsWebGPUDevice.Request(...)` acquires or accepts a WebGPU adapter and device.
The device prepares CEWGPU pipelines, creates explicit geometry, RGBA8 2D
textures and samplers, builds binding sets, encodes draws, submits command
buffers, and manages device generations.

The resource helpers accept complete caller-owned data. They do not select
effects, resolve paths, infer vertex layouts, or create production uniform
values.

The source tree also contains an internal
`CjsWebGPUTrinityBatchDispatcher` conformance prototype. It is intentionally
not exported from the package root and is not part of the supported public API.
Its batch, accumulator, and batch-map paths keep material/resource resolution
and render-pass selection injected. Batch-map preparation supplies an
immutable `{ batchType }` context to each injected material, geometry, and
binding resolver. Accumulator preparation retains separate GDPR and ordinary
vectors, encoding GDPR first through the complete direct per-batch fallback.

`CjsWebGPUTrinityStepRecorder` is another internal conformance prototype. It
implements the duck-typed `Tr2RenderContext.SetStepExecutor(...)` callbacks,
preserves nested render-step intent order, and defers asynchronous WebGPU work
until after the synchronous render-job run.

## Space-object uniform serialization

- `EVE_SPACE_OBJECT_MAIN_BUFFER_SIZES` exposes the bounded struct sizes.
- `getEveSpaceObjectMainMaterialConstants(packageRecord)` returns detached
  reflected material constant descriptors.
- `buildEveSpaceObjectMainUniformData(packageRecord, values)` serializes
  complete caller-supplied material, per-frame, and per-object values into
  canonical binding identities.

Logical 4x4 matrix values use ordinary gl-matrix storage. The serializer
transposes each matrix once into Carbon cbuffer register-row order, including
each element of a matrix array. `customMaskMatrix` is copied unchanged because
the current Trinity custom-mask producer already supplies those slots in GPU
form. A `RawData.GetData()` payload is also already GPU-form and belongs on a
later raw upload path, not through this semantic serializer.

The serializer does not read SOF and does not supply production defaults.

## Effect paths

The package root exports `normalizeEffectPath`, `shaderModelSuffix`, and
`toCompiledEffectPath`. They are also available from
`@carbonenginejs/engine-webgpu/utils/effectPaths`.

## Example

This example requires browser WebGPU globals. Destroy the device boundary when
its native resources are no longer needed.

```js
import {
  CjsWebGPUDevice,
  CjsWebGPUPackage
} from "@carbonenginejs/engine-webgpu";

const pkg = CjsWebGPUPackage.from(packageJson);
const selectedPipeline = pkg.GetPipeline("Main", 0);
const webgpu = await CjsWebGPUDevice.Request({
  gpu: navigator.gpu,
  shaderStage: GPUShaderStage
});

try {
  const prepared = await webgpu.PreparePipeline(selectedPipeline, {
    warningsAsErrors: true
  });
} finally {
  webgpu.Destroy();
}
```

Pipeline state, resources, uniforms, draw encoding, and cleanup remain explicit
steps because the current package does not define a renderer composition
contract.
