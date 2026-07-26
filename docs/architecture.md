# Architecture and boundaries

Status: Experimental
Scope: `@carbonenginejs/engine-webgpu`
Audience: Renderer and resource-system integrators
Summary: Defines what the WebGPU engine package owns and what callers must supply.

## Purpose

The package turns validated, already-selected CEWGPU descriptors and explicit
caller data into generation-bound WebGPU objects and encoded draws.

## Current ownership

`CjsWebGPUPackage` normalizes decoded package data into immutable shader,
pipeline, layout, and resource descriptors. `CjsWebGPUDevice` owns native
device interaction: shader preparation, pipeline creation, buffer and 2D
texture upload, sampler realization, binding sets, draw encoding, submission,
loss handling, and recreation.

Objects created by a device carry its generation. Recreation invalidates old
pipelines, geometry, textures, samplers, binding sets, and draws while allowing
their owned native resources to be destroyed safely.

## Caller boundary

The caller selects effect variants and supplies explicit render state, vertex
layouts, packed geometry, texture pixels, sampler descriptors, resource
bindings, and complete uniform values. The device does not infer those values
from shader names, SOF data, or scene objects.

Uniform packing is backend-specific. The bounded space-object Main serializer
owns WebGPU's Carbon cbuffer byte layout and performs the required logical
matrix-to-register-row encoding. The WebGPU device upload itself remains a
byte copy. An already encoded `RawData` payload must therefore not pass through
the semantic serializer or be transposed a second time.

## Per-object data boundary

The intended `RawDataStore` seam keeps WebGPU and WebGL packing independent.
Registration supplies logical field definitions and encoding kinds. Their
production catalog and final ownership are still pending. A WebGPU
`ResolveLayout(structName, definition)` packer will supply CPU-staging
float-lane offsets, padding, and the full struct stride; a WebGL packer may
resolve the same definition differently. `RawData.Set(...)` applies its
declared matrix or integer encoder into that resolved CPU staging layout, while
the engine owns GPU allocation, stage-slot binding, upload, and lifetime.
WebGPU ring offsets and their device alignment are a separate allocation
concern, not the `RawData` struct stride.

The current CEWGPU reflection cannot define a general packer by itself. Local
material `cb0` includes named constant offsets, but shared `cb1` through `cb4`
expose only register identity, visibility, and an active-prefix minimum binding
size. They do not include member names, member offsets, or the complete Carbon
struct stride. The bounded Main serializer therefore uses the reviewed Carbon
ABI. A later general packer needs the reviewed Trinity struct-definition
catalog or richer package reflection and must reject uncovered structs rather
than derive a stride from the WGSL minimum.

The current custom-mask producer is a deliberate exception at the value seam:
it already writes `customMaskMatrix` in transposed GPU form. A future RawData
bridge must copy those slots with `SetRaw(...)` or an equivalent direct-copy
encoding rather than applying `MATRIX` a second time.

CEWGPU bytes can be decoded by an injected reader. Offline corpus tooling can
produce packages for qualification, but it is not an engine dependency.

## Provisional Trinity batch boundary

The internal `CjsWebGPUTrinityBatchDispatcher` proves the first engine-facing
`Tr2RenderBatch` shape without importing `runtime-trinity`. It accepts the
transient batch's material, geometry source, object-data reference, D3D
topology, and draw arguments. Injected composition hooks resolve those CPU
references to an already-decoded pipeline recipe, WebGPU-owned geometry, and
complete binding values.

The dispatcher owns only the binding set it creates. Geometry, textures,
samplers, decoded packages, and logical values remain owned by their
resolvers. It maps indexed and non-indexed draw arguments, rejects unsupported
topologies and incompatible pipeline recipes, and rolls back its binding set
when draw creation fails.

It also snapshots the ordinary `GetBatches()` vector of a finalized
`TriRenderBatchAccumulator`-compatible object, preserves its order, and owns
the collected binding-set lifecycle as one unit. `GetGdprBatches()` must
currently be empty: grouped state sharing remains explicitly unsupported and
fails before any batch allocation.

This class is internal and is not exported from the package root. It is a
conformance prototype, not a frozen renderer API. The static and skinned
QuadV5 browser gates use its accumulator path, and actual `runtime-trinity`
`Tr2RenderBatch` and `TriRenderBatchAccumulator` instances pass the duck-typed
contract. A later render-step executor still needs to own frame/pass planning
and batch-map dispatch.

The contract consumes already-decoded pipeline data. Moving shader format
readers between format and resource packages therefore does not change this
boundary; only the injected reader or material resolver changes.

## Current non-goals

There is no dependency on `runtime-core`, `runtime-resource`, or
`runtime-trinity`. The package does not load GR2 or CMF geometry, resolve
resource paths, extract scene state, choose production material or per-object
values, translate complete Carbon render state, dispatch a Trinity batch map,
or schedule a render loop.

The public engine texture adapter currently uploads only explicit,
single-mip, uncompressed 2D RGBA8 data. The standalone harness may create
harness-owned native resources, such as a cube view, when a shader contract
requires a shape outside that provisional adapter.

## Related documentation

- [Public API reference](reference/api.md)
- [WebGPU harness](guides/webgpu-harness.md)
