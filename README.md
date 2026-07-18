# @carbonenginejs/engine-webgpu

WebGPU backend support for CarbonEngineJS. It consumes `CEWGPU` package data,
preserves Carbon-style effect-path rewriting rules, exposes immutable package
descriptors, and now owns the first live WebGPU preparation/pipeline/draw seam.

Part of the CarbonEngineJS runtime/engine tier. Ports/adapts from CarbonEngine
(https://github.com/carbonengine, MIT); ccpwgl is consulted as a behavioral
reference donor where Carbon naming/routing behavior needs preservation.

`CjsWebGPUDevice` is the live WebGPU owner. It is not a `TriDevice` subclass
and is not a second name for a future `CjsWebGPU` composition facade. One
`CjsLibrary` selects one renderer session; if WebGL and WebGPU are both needed,
the application creates two independently configured library instances. A
future WebGPU render-step executor will be installed behind a renderer-supplied
engine-agnostic `Tr2RenderContext` and delegate native realization to this
device.

## Status

The current engine slice implements:

- `CjsWebGPUPackage.from(...)` builds immutable descriptor records from plain
  `format-webgpu` output
- `CjsWebGPUPackage.fromBytes(...)` accepts an injected reader such as
  `CjsFormatWebgpu.read`
- optional `CJS_WGSL_SET.layouts` records own numeric bind groups and exact
  WebGPU buffer/texture/sampler layouts; ANLS metadata is reconciled by D3D
  resource class, register space, and register index
- translated `code`, entry points, and DXBC source maps survive on immutable
  shader-module descriptors; ANLS-only packages retain their legacy fallback
- Carbon-style effect path helpers keep authored `.fx` names and rewrite only
  the `/effect/` root plus the compiled `.sm_*` suffix
- `CjsWebGPUDevice` requests an explicitly configured adapter/device, prepares
  WGSL modules and canonical layouts, realizes an explicit caller-supplied
  render-pipeline recipe, resolves live resources by D3D identity, and encodes
  indexed or non-indexed draws
- `CjsWebGPUDevice.CreateGeometry(...)` uploads explicit packed CPU vertex and
  optional index payloads into opaque, generation-bound device geometry; it
  exposes frozen caller-provided vertex layouts without defining another
  `TriGeometryRes`
- `CjsWebGPUDevice.CreateTexture(...)` uploads explicit full-row CPU pixels as
  single-mip `rgba8unorm` or `rgba8unorm-srgb` 2D textures, returning an
  opaque generation-bound handle that binding sets and direct draws unwrap
- `CjsWebGPUDevice.CreateSampler(...)` normalizes explicit WebGPU sampler
  state, caches equivalent native samplers per device generation, and returns
  independently releasable opaque handles
- `CjsWebGPUDevice.CreateSamplerPrepareStage(...)` maps one complete,
  already-selected `webgpu-sampler` record into an exact sampler-bundle
  descriptor; `CreateSamplerPreparePipeline(...)` orders that mapper before
  the atomic publisher
- `CjsWebGPUDevice.CreateResourceBundle(...)` atomically realizes keyed plain
  geometry/texture/sampler payloads, rolls back every fulfilled child when any
  sibling fails, and returns one opaque owner for the completed collection
- `CjsWebGPUDevice.CreateResourcePrepareStage(...)` creates a final
  CjsResMan-compatible prepare stage that retains the CPU payload and swaps a
  complete bundle into one guarded adapter-resource slot
- `CjsWebGPUDevice.CreateRgba8TexturePrepareStage(...)` strictly maps one
  canonical decoded RGBA8 payload into an exact texture-bundle descriptor;
  `CreateRgba8TexturePreparePipeline(...)` orders that mapper before the
  atomic publisher as a ready-to-register two-stage pipeline
- `createWebGPURgba8TextureResourceBehavior(...)` supplies the corresponding
  fail-closed CjsLibrary recipe; the application injects its path matcher and
  optional fallback rewrite while the behavior requires registered WebGPU
  support for automatic selection
- opaque device-owned binding sets validate canonical CPU uniform payloads,
  allocate/upload their uniform buffers, reuse native bind groups across draws,
  support validated updates, and clean partial buffers when synchronous native
  calls throw
- `buildEveSpaceObjectMainUniformData(...)` serializes the proven Carbon
  space-scene/space-object `Main.pass0` structs and package-reflected stage-local
  material `cb0` into canonical binding identities
- `createEveSpaceObjectMainResourceBehavior(...)` supplies a structural,
  capability-gated CjsLibrary request recipe plus the live `BuildUniformData`
  method without importing runtime-core
- the behavior's `GetMaterialConstants(package)` returns detached reflected
  constants suitable for `runtime-trinity` effect-value extraction
- device generations reject stale pipelines, geometry, textures, samplers,
  binding sets, and draws after loss or explicit recreation; stale bundles
  remain destroyable so their old-generation children can be reclaimed
- binding sets retain but never own opaque texture/sampler handles, while legacy raw
  buffers/textures/samplers remain caller-owned

Non-goals for this slice:

- no format/capability selection inside the resource manager
- no inferred vertex stride/offsets or guessed translation of incomplete
  Carbon render-state records
- no compressed, mipped, array, cube, storage, or render-target texture upload
  policy yet
- no Carbon/D3D numeric sampler-state conversion or implicit texture/sampler
  pairing inside the device adapter
- no reader-fed production CjsResMan geometry/texture/sampler pipeline is
  registered yet; the bounded RGBA8 pipeline definition is ready for
  registration, while an actual reader-to-real-resource request remains open
- no per-frame scene extractor, uniform scheduler/ring, draw-area adapter, or
  render loop yet

`CjsLibrary` (or a direct caller) remains responsible for selecting the format
and supplying the exact WebGPU pipeline recipe. `CjsWebGPUDevice` realizes
that request; it does not choose an effect variant or resource path.
`runtime-trinity` now exposes GPU-free helpers for reflected `Tr2Effect`
constant values and the trustworthy object/shared portion of the space-object
Main structs. The renderer still supplies complete per-frame values and
explicit `shipData`.

A separate maintained browser harness now proves that the local JavaScript
toolchain can acquire WebGPU, compile WGSL, render offscreen, copy to a padded
readback buffer, and validate pixels. The phase-zero sampled pixel now enters
as canonical decoded RGBA8, passes through the mapper and its separate atomic
adapter slot, and is sampled from the published opaque texture handle. The
harness also renders the generated copyblit
vertex/fragment pair with engine-owned t0/s0 handles realized from fixture
pixel/sampler state plus a fixture cb0 buffer through `CjsWebGPUDevice`. Its
packed geometry, decoded pixels, and selected sampler state enter one atomic
prepare-stage adapter slot before the draw consumes the resulting bundle. It
also prepares the real QuadV5
DX11/DX12 `Main.pass0`
modules and nine-binding canonical layout without inventing geometry or
resource data. The PPT-on body-4 gate goes further: it loads matching DX11-
and DX12-derived CEWGPU packages through `CjsLibrary` and `CjsResMan`, uploads
the indexed quad, all three fixture pixels, and the selected sampler through
the same resource-bundle publication seam, then asks one binding set per
pipeline to realize the five
uniform buffers. The
CPU values are semantic plain objects; the reusable Carbon serializer produces
reflected `cb0` and full-size `cb1`-`cb4` payloads. Both MRT pipelines must
retain byte-exact readback parity after `rgba8unorm` target quantization. An
optional `--capture-quadv5` diagnostic visualizes the validated DX11 4x4 MRT
bytes after DX12 parity succeeds; it is not a separate render path. See
`WEBGPU-HARNESS.md`.

## Public API

```js
import {
  CjsWebGPUDevice,
  CjsWebGPUPackage,
  EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR,
  WEBGPU_RGBA8_TEXTURE_PREPARE_PIPELINE,
  WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR,
  buildEveSpaceObjectMainUniformData,
  createEveSpaceObjectMainResourceBehavior,
  createWebGPURgba8TextureResourceBehavior,
  getEveSpaceObjectMainMaterialConstants,
  normalizeEffectPath,
  shaderModelSuffix,
  toCompiledEffectPath
} from "@carbonenginejs/engine-webgpu";

const pkg = CjsWebGPUPackage.from(packageJson);
const pipeline = pkg.GetPipeline("Main", 0);
const webgpu = await CjsWebGPUDevice.Request({
  gpu: navigator.gpu,
  adapterOptions,
  deviceDescriptor,
  shaderStage: GPUShaderStage
});
const gpuResources = await webgpu.CreateResourceBundle({
  label: "ship resources",
  geometries: {
    main: {
      vertexBuffers: [ {
        slot: 0,
        data: packedVertices,
        layout: explicitVertexLayout
      } ],
      indexBuffer: { data: packedIndices, format: "uint16" }
    }
  },
  textures: {
    "sampled-resource:0:0": {
      width,
      height,
      format: "rgba8unorm-srgb",
      bytesPerRow,
      data: packedPixels
    }
  },
  samplers: {
    "sampler:0:0": {
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear"
    }
  }
});
const geometry = gpuResources.geometries.main;
const texture = gpuResources.textures["sampled-resource:0:0"];
const sampler = gpuResources.samplers["sampler:0:0"];
const prepared = await webgpu.PreparePipeline(pipeline);
const livePipeline = await webgpu.CreateRenderPipeline(prepared, {
  vertex: { buffers: geometry.vertexBufferLayouts },
  fragment: { targets: [ { format: "rgba8unorm" } ] },
  primitive: { topology: "triangle-list" }
});
const uniformData = buildEveSpaceObjectMainUniformData(packageRecord, {
  material,
  perFrameVS,
  perFramePS,
  perObjectVS,
  perObjectPS
});
const bindingSet = webgpu.CreateBindingSet(livePipeline, {
  uniformData,
  resources: new Map([
    [ "sampled-resource:0:0", texture ],
    [ "sampler:0:0", sampler ]
  ])
});
const draw = webgpu.CreateDraw(livePipeline, {
  bindingSet,
  geometry,
  draw: { indexCount }
});
const compiledPath = toCompiledEffectPath("res:/graphics/effect/space/quadv5.fx", {
  effectRoot: "/effect.webgpu/",
  quality: "high"
});
```

`await CreateGeometry(...)` consumes an explicit plain payload that a prepared
`TriGeometryRes`, CMF preparation stage, test fixture, or direct caller can
produce. Each vertex buffer must provide `slot`, binary `data`, and a complete
`layout` with a positive `arrayStride`, optional `stepMode`, and attributes.
Zero-stride/empty WebGPU layouts are outside this packed Carbon subset. An
optional index buffer provides binary `data` plus `uint16` or `uint32` format.
Binary input is snapshotted before asynchronous validation/upload. The method
validates payload structure, upload sizes, slot/location uniqueness,
supported `GPUVertexFormat` size/alignment, advertised device limits,
canonical layout identity, draw capacities, ownership, and device generation.
Native WebGPU pipeline validation retains feature-gated format availability
and shader-location compatibility. Upload publication waits for serialized
validation and out-of-memory scopes. It never derives a layout from
CEWGPU/ANLS or effect semantics. Call `geometry.Destroy()` when the adapter
resource is discarded.

`await CreateTexture(...)` consumes a separate explicit plain payload with
`width`, `height`, `format`, `bytesPerRow`, and binary `data`. The current
bounded contract accepts only `rgba8unorm` and `rgba8unorm-srgb`, requires a
complete row for every image row (`data.byteLength === bytesPerRow * height`),
and requires `bytesPerRow` to contain `width * 4` active bytes and align to a
four-byte texel. Input bytes are snapshotted before queued upload. Allocation
is always one 2D layer, mip, and sample with `TEXTURE_BINDING | COPY_DST`; the
same-format view is private to the handle. No resource path, sampler, color-
space conversion, mip policy, or CEWGPU/ANLS inference occurs here. Call
`texture.Destroy()` when the adapter resource is discarded.

The exported `CjsWebGPUTexture` class describes a reflected package binding.
It is distinct from the opaque live handle returned by `CreateTexture(...)`;
the handle is intentionally not a second public texture DTO.

`await CreateSampler(...)` accepts the WebGPU address U/V/W modes, mag/min/
mipmap filters, float32 LOD clamps, optional comparison function, and integer
anisotropy. Missing fields normalize to WebGPU defaults. Equivalent behavioral
state shares one native `GPUSampler` within the current device generation;
labels do not split the cache, while each call returns a distinct logical
handle. The native object's diagnostic label therefore comes from the first
request that materializes a cache entry. Binding compatibility follows WebGPU
exactly: a `filtering` layout
accepts any non-comparison sampler, `non-filtering` additionally requires all
three filters to be `nearest`, and `comparison` requires `compare`. Calling
`sampler.Destroy()` releases only that logical handle because WebGPU samplers
have no native destroy operation; the native cache lasts for the device
generation. No texture pairing, resource path, Carbon/D3D enum conversion, or
capability selection occurs here.

The exported `CjsWebGPUSampler` class remains a reflected package-binding
descriptor. It is distinct from the opaque live handle returned by
`CreateSampler(...)`; no parallel live-resource DTO was added.

`CreateSamplerPrepareStage({ name, samplerKey, bundleLabel })` is the strict
pre-upload boundary for already-selected sampler state. Its input must carry
`payloadType: "webgpu-sampler"` and explicitly provide address U/V/W, mag/min/
mipmap filters, LOD min/max, and anisotropy. Optional `label` and `compare` are
accepted. The stage rejects missing fields, unknown keys, raw numeric Carbon/
D3D enums, and invalid effective WebGPU combinations. It strips only the
payload discriminator, preserves the caller's `samplerKey`, canonicalizes
through the same sampler validator used by `CreateSampler(...)`, and performs
no GPU calls.

`CreateSamplerPreparePipeline(...)` returns frozen
`{ stages: [mappingStage, publicationStage] }`. The mapping stage returns the
exact sampler-bundle descriptor and the publisher returns `undefined`, keeping
that GPU-recreatable mapped payload. Sampler override precedence, Carbon/D3D
conversion, texture pairing, path policy, and capability selection remain
upstream responsibilities.

`await CreateResourceBundle(...)` accepts only keyed plain records whose child
values already satisfy the explicit `CreateGeometry`, `CreateTexture`, or
`CreateSampler` contracts. It starts every child request before awaiting the
serialized validation queue, waits for all of them to settle, and publishes no
handle unless the whole collection succeeds in one device generation. On
failure it destroys fulfilled geometry, texture, and logical sampler handles
in reverse order. The frozen bundle owns its children and exposes one
idempotent `Destroy()`; it does not own pipelines, binding sets, or draws.
Caller keys are preserved verbatim, and the device does not infer CEWGPU
identities, paths, format conversion, packing, texture/sampler pairing, or
override policy.

`CreateRgba8TexturePrepareStage({ name, textureKey, bundleLabel })` consumes
the exact canonical decoded-raster keys: `payloadType: "rgba"`, non-empty
`sourceFormat`, positive `width`/`height`, `pixelFormat: "rgba8unorm"`,
`Uint8Array data`, `strideBytes`, top-left `origin`, `colorSpace: "srgb" |
"linear"`, and `alphaMode: "straight" | "opaque"`, plus required
`containerOnly: false` and `isDecoded: true`.
Optional `rgbaDecodeSupported` must be true. Rows must contain `width * 4`
active bytes, align to four bytes, and total exactly `strideBytes * height`.
Color space selects `rgba8unorm-srgb` for sRGB or `rgba8unorm` for linear;
the stage does not decode, convert, flip, repack, or copy the bytes.
Unsupported float, premultiplied, unknown-color-space, mip, array, cube, or
compressed payloads fail rather than losing information. The explicit
`textureKey` is preserved verbatim; it is not inferred from an effect binding.
`CreateTexture(...)` remains the upload snapshot boundary.

`CreateRgba8TexturePreparePipeline(...)` returns the frozen structural shape
`{ stages: [mappingStage, publicationStage] }`. Stage 1 returns the mapped
bundle descriptor, and Stage 2 returns `undefined`, so CjsResMan retains the
GPU-recreatable mapped CPU payload after publication.

`CreateResourcePrepareStage({ name, adapterKey })` returns a frozen structural
stage with the ResMan `prepare(value, context)` signature. The final stage
builds a bundle, synchronously installs it through
`context.resource.SetAdapterResource(adapterKey, bundle)`, verifies the slot,
and can restore/remove a failed commit through `GetAdapterResource` and
`DestroyAdapterResource`, then destroys the displaced bundle. Returning
`undefined` deliberately keeps
the prepared CPU payload as the resource value for recreation. CjsLibrary (or
a direct request) still chooses which named pipeline contains this stage; any
reader, geometry packer, raster conversion, sampler-state selection, or
capability fallback must run earlier and remains outside CjsResMan policy.
The default `adapterKey: "webgpu"` is appropriate for the ordinary one-backend-
per-library model. Applications deliberately sharing resources or a resource
manager across renderer sessions must assign one distinct stable key per
logical device, such as `engine-webgpu:primary`; the stage refuses to replace
a bundle owned by another device. Do not include the device generation in the
key because recreation replaces the same logical session slot.

```js
// Application-owned/injected. It must emit the exact canonical RGBA record
// accepted above; wiring such a real reader is still the open production gate.
const canonicalRgbaFormat = applicationFormats.png;
const rgba8Pipeline = webgpu.CreateRgba8TexturePreparePipeline({
  textureKey: "main",
  bundleLabel: "decoded albedo",
  mappingStageName: "map-decoded-albedo",
  publicationStageName: "publish-webgpu-albedo",
  adapterKey: "engine-webgpu:primary"
});
const rgba8Behavior = createWebGPURgba8TextureResourceBehavior({
  format: canonicalRgbaFormat,
  matchPath: ({ path }) => /\.png(?:[?#].*)?$/iu.test(path)
});

library.Register({
  capabilities: { webgpu: true },
  behaviors: {
    [WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR]: {
      behavior: rgba8Behavior,
      default: true,
      priority: 50
    }
  },
  resMan: {
    formats: [canonicalRgbaFormat],
    preparePipelines: {
      [WEBGPU_RGBA8_TEXTURE_PREPARE_PIPELINE]: rgba8Pipeline
    }
  }
});

const textureResource = await library.FetchResource("res:/texture/albedo.png");
const texture = textureResource
  .GetAdapterResource("engine-webgpu:primary")
  .textures.main;
```

The injected matcher prevents this behavior from claiming every image path.
An optional synchronous `resolvePath` can combine a configured fallback such
as DDS-to-PNG rewriting with this presentation recipe because CjsLibrary
selects one behavior, not a behavior chain. Explicit `behavior: "name"`
selection remains the caller's intentional force override; `behavior: false`
opts out. Caller request options still win and must keep `emit` and
`preparePipeline` coherent. Sampler selection and mapping `textures.main` to a
shader binding remain renderer/policy work outside this texture resource.

An application preset can register the resource recipe once and let ordinary
CEWGPU requests use it by default:

```js
const mainBehavior = createEveSpaceObjectMainResourceBehavior({
  format: CjsFormatWebgpu
});

library.Register({
  capabilities: { webgpu: true },
  behaviors: {
    [EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR]: {
      behavior: mainBehavior,
      default: true,
      priority: 100
    }
  },
  resMan: {
    formats: [CjsFormatWebgpu],
    preparePipelines: {
      webgpu_package: { stages: webgpuPackageStages }
    }
  }
});

const pkg = await library.FetchObject("res:/effect/ship.cewgpu", {
  formatOptions: { source: sourcePath }
});
const material = extractTr2EffectConstantValues(
  meshArea.effect,
  mainBehavior.GetMaterialConstants(pkg)
);
const uniformData = mainBehavior.BuildUniformData(pkg, {
  ...currentValues,
  material
});
```

The behavior is synchronous request policy only. `CjsResMan` sees its
`requirement`, `format`, `emit`, and `preparePipeline` recipe; it never sees or
invokes `BuildUniformData`, because material/frame/object values change after
the package has been loaded and cached.

Exports:

- `CjsWebGPUDevice`
- `CjsWebGPUPackage`
- `CjsWebGPUPipeline`
- `CjsWebGPUShaderModule`
- `CjsWebGPUBindGroup`
- `CjsWebGPUResource`
- `CjsWebGPUBuffer`
- `CjsWebGPUTexture`
- `CjsWebGPUSampler`
- `EVE_SPACE_OBJECT_MAIN_BUFFER_SIZES`
- `EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR`
- `WEBGPU_RGBA8_TEXTURE_PREPARE_PIPELINE`
- `WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR`
- `buildEveSpaceObjectMainUniformData(...)`
- `createEveSpaceObjectMainResourceBehavior(...)`
- `createWebGPURgba8TextureResourceBehavior(...)`
- `getEveSpaceObjectMainMaterialConstants(...)`
- `normalizeEffectPath(...)`
- `shaderModelSuffix(...)`
- `toCompiledEffectPath(...)`

## Checks

```sh
npm test
npm run lint
npm run test:webgpu
npm run test:webgpu:required
```

## Provenance

CarbonEngine and Fenris Creations (CCP Games) are named for interoperability
and provenance context. This package's runtime code is CarbonEngineJS original
work that adapts package consumption and path-routing behavior verified against
CarbonEngine source and the local ccpwgl reference runtime. Not affiliated
with or endorsed by CCP Games.
