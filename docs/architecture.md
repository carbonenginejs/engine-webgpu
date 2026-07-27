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

Mesh batches may carry only a `geometrySource` area range and leave their draw
arguments zero. `ResolveGeometry` may therefore return a complete indexed or
non-indexed `draw` override derived from CPU geometry facts and the engine's
realized buffer packing. Producers with explicit draw arguments continue to
use the batch fields. The dispatcher validates either path before draw
creation.

It also snapshots both vectors of a finalized
`TriRenderBatchAccumulator`-compatible object, preserves their internal order,
encodes GDPR before ordinary batches, and owns the collected binding-set
lifecycle as one unit. GDPR entries currently use the same complete direct
per-batch path as ordinary entries. This matches Carbon's non-indirect fallback
semantics while deliberately giving up grouped state sharing and indirect-draw
optimization.

At the next level it snapshots `TriRenderBatchMap` batch types in insertion
order and prepares each accumulator. Batch-type meaning and render
pass selection remain outside the dispatcher: `EncodeBatchType(...)` requires
the caller to supply the compatible pass for the requested type. This avoids
turning opaque, decal, transparent, or depth policy into shared device code.
Every injected material, geometry, and binding resolver receives the same
immutable preparation context. The batch-map path supplies its numeric
`batchType`, allowing application composition to select the matching effect
technique without the dispatcher importing or interpreting `TriBatchType`.

This class is internal and is not exported from the package root. It is a
conformance prototype, not a frozen renderer API. The static/skinned QuadV5,
common PPT-on skinned QuadHeatV5, PPT-on skinned QuadHeatDetailV5 material-block
high-water gate, independently gated static and common PPT-on skinned
QuadGlassV5 Main passes, cold/hot PPT-off
static QuadHeatV5, independently gated PPT-off static and PPT-on skinned
QuadSailsV5, non-bindless
DecalV5/DecalCylindricV5/DecalHoleV5, kill-counter DecalCounterV5,
DecalGlowV5, and DecalGlowCylindricV5 browser gates use its one-type batch-map
path, with the glass fixture keeping complementary pass selection explicit,
the heat fixtures keeping their caller-owned raster recipes and semantic cases
explicit, and the decal fixtures proving that numeric batch type `1` stays
caller-selected. HeatDetail is a tied-largest active-binding contract, not a
common-frequency shader gate: cold/detail-neutral, cold/detail-active, and
hot/detail-active cases isolate its detail and heat response while holding
coverage and MRT1 invariant.
The build-3444265 common skinned-heat evidence (313 ship areas across 205
hulls) remains a synthetic 21-binding cold/hot conformance gate: it uses the
internal dispatcher shape but imports neither runtime-trinity nor a Trinity
graph. The duck-typed boundary is shaped for future
`runtime-trinity` `Tr2RenderBatch`,
`TriRenderBatchAccumulator`, and `TriRenderBatchMap` instances, but this
package does not yet run an integration gate against them. A later
render-step executor still needs to own frame/pass planning and select the
pass for each batch type.

The build-3444265 common skinned-Glass evidence (57 ship areas across 57
hulls) is likewise synthetic and library-free. Its body-4 PPT-on gate adds an
indexed `BoneTransforms` storage buffer to the two complementary Main-pass
draws and observes non-identity transformed bounds. All current probes still
use numeric opaque batch type `0`; the three audited transparent SOF uses do
not yet qualify production transparent classification or scheduling.

The build-3444265 SOF audit correlates the static Sails family to 77 opaque
ship areas across 27 hulls and the skinned-Sails logical family to 72 opaque
areas across 33 hulls. Both browser gates are synthetic and library-free. The
static gate exercises the SOF-authored PPT-off body-0 Main pass; the separate
skinned gate deliberately selects PPT-on body 4 and adds indexed non-identity
skinning. Both exercise the sparse 464-byte material buffer through
`SailsDetailData` and the shader's depth-write render state through a
caller-owned `depth24plus` recipe. The skinned frequency count applies to the
logical family, not specifically to the PPT-on body, and the recipe remains
provisional until the WebGL/WebGPU renderer rules are designed. These gates
do not load SOF, runtime-trinity, a Trinity graph, production textures, or
authoritative per-object defaults.

The internal `CjsWebGPUTrinityStepRecorder` proves the synchronous
`Tr2RenderContext.SetStepExecutor(...)` seam separately. It delegates the
step's begin, execute, and end hooks back to the GPU-free context, consumes
`TakeIntents()` exactly once, and records immutable segments in observable
order. Nested jobs are re-entrant: a child step flushes any parent intents
emitted before the child, then the parent resumes after the child. WebGPU
pipeline preparation, pass creation, encoding, and submission remain a later
asynchronous phase; none run inside Trinity's synchronous `Run(...)`.

The internal `CjsWebGPUTrinityPassEncoder` proves the synchronous encoding end
of that split. A caller supplies an existing command encoder plus ordered
render-pass descriptors and prepared batch-map selections. Multiple batch
types may share one pass, and separately prepared maps may be selected when a
different technique is required. Optional synchronous pass configuration can
set viewport or other dynamic state. The encoder ends every pass it begins but
does not own attachments, finish command buffers, submit work, or assign EVE
meaning to a batch type.

The contract consumes already-decoded pipeline data. Moving shader format
readers between format and resource packages therefore does not change this
boundary; only the injected reader or material resolver changes.

## Current non-goals

There is no dependency on `runtime-core`, `runtime-resource`, or
`runtime-trinity`. The package does not load GR2 or CMF geometry, resolve
resource paths, extract scene state, choose production material or per-object
values, translate complete Carbon render state, infer batch-type pass policy,
realize render-job intents, or schedule a render loop.

The public engine texture adapter currently uploads only explicit,
single-mip, uncompressed 2D RGBA8 data. The standalone harness may create
harness-owned native resources, such as cube and 2D-array views, when a shader
contract requires a shape outside that provisional adapter.

## Related documentation

- [Public API reference](reference/api.md)
- [WebGPU harness](guides/webgpu-harness.md)
