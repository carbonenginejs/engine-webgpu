# WebGPU harness

Status: Experimental
Scope: `@carbonenginejs/engine-webgpu` browser harness
Audience: Maintainers and shader integrators
Summary: Explains how to run the standalone WebGPU probes and current CEWGPU render gates.

These commands are repository-maintainer checks and require a source checkout
with its development dependencies. The npm artifact ships this reference page,
but it does not ship the `scripts/` or `harness/` implementation.

The portable probe in the maintained plain-JavaScript harness launches a
headless Chromium page through Playwright. The page compiles WGSL, renders a full-screen triangle
into a 4x4 offscreen `rgba8unorm` texture, copies the result through a
256-byte-row-padded buffer, maps it, and verifies all pixels.

The portable probe does not use Deno, TypeScript, a canvas, Carbon assets,
network access, or another CarbonEngineJS package. The CEWGPU integration
commands documented below intentionally consume sibling CarbonEngineJS
packages.

Install the package development dependency and run the portable probe:

```powershell
npm.cmd install
npm.cmd run test:webgpu
```

The portable probe reports a clear skip when the browser exposes no adapter.
Run the required gate on a supported local or CI runner:

```powershell
npm.cmd run test:webgpu:required
```

The required command fails when WebGPU is unavailable. A portable-probe skip
does not close phase zero; at least one documented runner must pass the required
command. Ordinary `npm.cmd test` descriptor tests remain GPU-free.

The browser acquires, prepares, realizes, encodes, and submits through
`CjsWebGPUDevice`. The portable probe uploads its packed triangle and sampler
through an atomic `CreateResourceBundle(...)`. Its 1x1 pixel instead starts as
the canonical decoded RGBA record, passes through
`RealizeRgba8Texture(...)`, and enters a separate guarded adapter
slot before the draw samples the opaque texture handle. The resulting geometry
layout is used for pipeline creation.
Fixture creation and pixel expectations remain harness responsibilities, so
the reusable engine class does not acquire resource paths or infer format/
geometry policy.

The static and skinned QuadV5 modes additionally route each draw through the
internal `CjsWebGPUTrinityBatchDispatcher`. The fixture constructs the
duck-typed fields of a transient `Tr2RenderBatch` inside a finalized
ordinary-batch accumulator and a one-type batch-map shape. The caller selects
the opaque batch type's render pass; injected hooks resolve its material,
geometry source, and object data to the existing WebGPU resources and assert
that the immutable resolver context identifies that opaque type. Like
`Tr2MeshBase.CreateGeometryBatch`, the fixture leaves batch draw counts zero;
the geometry resolver supplies validated arguments from the realized
geometry. This tests
the engine crossing without importing `runtime-trinity`, loading a Trinity
graph, depending on grouped or indirect GDPR optimization, inferring pass
policy, or presenting the prototype as a public composition API.
The final draw is encoded through a one-pass caller-authored plan, which keeps
the MRT attachments and opaque selection explicit.

To compile a candidate module while preserving the existing render/readback
gate, pass WGSL text by file path:

```powershell
npm.cmd run test:webgpu:required -- --compile-wgsl .\artifacts\candidate.wgsl
```

The launcher serves only the candidate text to the browser. It does not import
or depend on a compiler package. Compilation diagnostics include severity,
line/column, byte offset/length, and message; validation remains inside the
same WebGPU error scope.

To build and render a generated copyblit pair with engine-owned geometry,
texture, and normalized/cached sampler plus a fixture-owned uniform resource,
pass both modules:

```powershell
npm.cmd run test:webgpu:required -- --draw-wgsl .\artifacts\vertex.wgsl .\artifacts\fragment.wgsl
```

This path creates the canonical group-0 `cb0`/`t0`/`s0` layout, renders the
generated pair into the same 4x4 target, and verifies the expected pixels. The
fixtures are intentionally self-contained; runtime-resource is not involved.

## Producing indexed CEWGPU inputs

For normal EVE corpus packages, do not add resource acquisition or batch
conversion to this harness. Build them through tools-core, then select the
qualified CEWGPU file named by its exact `outputPath` entry in
`build-report.json`:

From a tools-core checkout, run:

```powershell
npm.cmd run build:shader:webgpu -- --shader-target eve-webgpu --build latest --out .\artifacts
```

Use `--diagnostic` when the purpose is compiler-coverage inspection and
`--force --no-reuse` when an existing output must be transactionally rebuilt.
The JSONL log retains every per-source failure even though terminal progress is
throttled. The engine harness consumes selected output packages; it does not
import tools-core at runtime.

The specialized full-permutation matrix and paired DX11/DX12 QuadV5 commands
below remain explicit compiler/engine qualification. The registered
`eve-webgpu` target currently represents selected DX11 SM5.0 `.sm_hi` inputs,
so do not mislabel those broader experiments as tools-core corpus output.

To prepare a real CEWGPU `Main.pass0` without pretending the package contains
vertex-buffer strides, render-target policy, or live resources:

```powershell
npm.cmd run test:webgpu:required -- --prepare-cewgpu .\artifacts\quadv5-main.cewgpu
```

To prepare every distinct pass-ready pipeline from a full permutation-matrix
report in one browser/device session:

```powershell
npm.cmd run test:webgpu:required -- --prepare-matrix .\artifacts\quadv5-all-permutations.json
```

The matrix report retains every permutation/pass occurrence. The harness first
compiles every distinct independently emitted shader module, then prepares each
exact pass-ready shader/layout variant once across both backend records.
Backend, source, variant, example, and occurrence provenance remains attached
to every deduplicated pipeline. Ready render variants must contain exactly one
vertex and one pixel stage. Ready compute variants must contain exactly one
compute stage, preserve the positive three-dimensional thread-group size, and
agree with the independently qualified stage. The browser creates a native
compute pipeline to validate the shader/layout interface but does not dispatch
it. It reports unique render and compute pipeline counts plus covered stage and
pass occurrences, and treats every WGSL warning or WebGPU validation error as a
failure. Unsupported matrix entries are qualification results rather than live
pipeline candidates and are not silently reclassified as prepared.

To perform the first actual QuadV5 draw, package the same explicitly selected
PPT-on `Main.pass0` body from DX11 and DX12, then pass both CEWGPU files:

```powershell
npm.cmd run test:webgpu:required -- --draw-quadv5 .\artifacts\quadv5-ppt-on-dx11.cewgpu .\artifacts\quadv5-ppt-on-dx12.cewgpu
```

Use the skinned family gate with the corresponding pair:

```powershell
npm.cmd run test:webgpu:required -- --draw-skinned-quadv5 .\artifacts\quadv5-skinned-dx11.cewgpu .\artifacts\quadv5-skinned-dx12.cewgpu
```

The first decal-family gate uses the explicitly selected non-bindless
`unpacked_decalv5` Main pass:

```powershell
npm.cmd run test:webgpu:required -- --draw-decalv5 .\artifacts\decalv5-dx11.cewgpu .\artifacts\decalv5-dx12.cewgpu
```

The kill-counter slice uses the separately qualified default
`unpacked_decalcounterv5` Main pass:

```powershell
npm.cmd run test:webgpu:required -- --draw-decalcounterv5 .\artifacts\decalcounterv5-dx11.cewgpu .\artifacts\decalcounterv5-dx12.cewgpu
```

The glow slice uses the separately qualified default `unpacked_decalglowv5`
Main pass:

```powershell
npm.cmd run test:webgpu:required -- --draw-decalglowv5 .\artifacts\decalglowv5-dx11.cewgpu .\artifacts\decalglowv5-dx12.cewgpu
```

Add `--capture-quadv5 .\artifacts\quadv5-ppt-on.png` to save a browser-rendered
PNG visualization of the DX11 package's two 64x64 active-pixel MRT readbacks
after the silhouette invariants and byte-exact DX11/DX12 checks pass. DX12 is not
pictured separately because it has already been required to match. This is a
diagnostic view of readback bytes, not another GPU render or a production scene
capture.

The launcher rejects identical or misordered inputs and any package that is not
body index `4` with the complete expected selection set, including
`SPACE_OBJECT_PPT_ENABLED=SOPPT_ENABLED`. Static packages carry seven
selections; skinned packages carry six because they do not expose the
instanced-attachment axis. The launcher reads each file directly, decodes it
with `CjsFormatWebgpu`, and constructs `CjsWebGPUPackage`. No runtime library,
resource manager, or Trinity contract participates in this gate.

The browser harness supplies an authored 13-vertex, 36-index silhouette, ten
generated 8x8 2D texture payloads, one generated six-face environment cube,
and three explicit filtering-sampler descriptors. Geometry, textures, and
material/per-frame/per-object values are synthetic harness inputs. The gate
does not read SOF, source per-object data from it, or infer production
defaults. The 2D textures, geometry, and samplers are atomically realized and
published as one device resource bundle. Its harness-local structural adapter
slot does not assert a `CjsResource` or runtime integration contract.
`CjsWebGPUDevice.CreateGeometry(...)`
owns the silhouette's native vertex/index buffers, exposes the exact frozen 64-byte
common vertex layout, validates draw capacity and device generation, and
releases all owned buffers idempotently. The skinned gate adds an 8-byte
`uint16x4` blend-index stream at location 1. Every vertex selects palette entry
1; entry 0 is deliberately zero while entry 1 applies a rigid 30-degree
rotation and translation. The readback must show the transformed silhouette
at variant-specific anchors and horizontal coverage bounds, so an
identity-only, hard-coded-zero, or wrong-stride skinning path cannot pass.
`CjsWebGPUDevice.CreateTexture(...)` snapshots and
uploads each `rgba8unorm`/`rgba8unorm-srgb` payload, exposes only a generation-
bound handle, unwraps its private view at the canonical texture binding, and
releases the native texture idempotently. The environment cube remains
harness-owned and is bound as a native cube view because the provisional
engine texture adapter is intentionally still limited to uncompressed 2D
views. Each sampler passes through
`RealizeSampler(...)`: its complete already-selected `webgpu-sampler` resource
payload is mapped into the exact bundle shape and published through a guarded
structural adapter slot. The operation then calls `CreateSampler(...)`, which
normalizes and caches the immutable
native sampler separately, returns a logical generation-bound handle, and
unwraps it only at a compatible sampler binding. `Sampler0` uses the static
linear/anisotropic state reflected by the DX11 package, including maximum
anisotropy 16; the two dynamic pattern samplers use explicit harness-authored
state. The bundle
owns all three handle categories, while binding sets own none of them.
For each pipeline, `CjsWebGPUDevice.CreateBindingSet(...)` validates canonical
identities, allocates/uploads five engine-owned uniform buffers, creates the
native bind group, and destroys only those owned buffers. Static
`Main.pass0` uses six active vertex attributes and 19 canonical bindings.
Skinned `Main.pass0` uses seven attributes and 20 bindings, including its
vertex-stage read-only bone-transform storage buffer.
DX11 and DX12 assign several material textures to different D3D registers, so
the gate maps their canonical identities through the independently reflected
Carbon resource names. Both pipelines render into two `rgba8unorm` targets,
check clear corners, silhouette anchors, bounded coverage, nose/wing/tail widths, and
varied MRT0 color, and then require
byte-exact DX11/DX12 equality across the active bytes of both MRTs. That
equality is measured after `rgba8unorm` target quantization; it is not a claim
of unquantized floating-point shader-semantic equivalence. Every WGSL warning
or WebGPU validation error fails the command.

The DecalV5 command independently requires canonical DX11/DX12
`unpacked_decalv5` provenance, body index `0`, all three default selections,
and a complete `Main.pass0` vertex/pixel pair. Bindless DX12 permutations are
not admitted because their sampled-resource array is outside the current WGSL
slice. The fixture supplies five active vertex attributes, four exact-size raw
GPU-register uniform buffers, one generated environment cube, eight generated
2D textures, and two explicit WebGPU samplers. `SSAOMap` receives a neutral
white texture; this gate implements no ambient-occlusion behavior. The decal
material textures shift by one register after `NormalMap` on DX12, so resources
are mapped through reflected Carbon names. The draw travels through numeric
decal batch type `1`, renders one `rgba8unorm` target, checks clear corners,
silhouette anchors, bounded coverage and varied shading, then requires
byte-exact DX11/DX12 equality after target quantization. These fixture bytes
are deliberately not presented as production per-frame/per-object defaults.

The DecalCounterV5 command applies the same canonical provenance, default
selection, complete-pass, batch-type, warning, validation, and exact
DX11/DX12 target checks to `unpacked_decalcounterv5`. Its smaller layout has
five uniform buffers, one `DecalTransparencyMap`, and one sampler. DX11 and
DX12 reflect the three local material values in different `cb0` orders, so
the gate packs `DecalTextureScaling`, `DecalIntensityData`, and
`DecalGlowColor` by reflected name. Without importing Trinity, the
harness-authored per-object bytes provide the complete six-matrix
`DecalVSPerObjectData` layout and the two-register active prefix of
`DecalPSPerObjectData`: `displayData` followed by `shipData`. It writes the
chosen three-digit ship kill count `731`—inside the shader's `0..999` display
domain—to `displayData.x`, visibility `1` to `displayData.y`, and explicit ship
data to the following register. The runtime transports this value as a
`uint32` and does not itself clamp that display domain. The result must retain
clear corners, produce bounded and varied counter coverage, and match
byte-for-byte across backends. These are conformance inputs, not production
defaults or a finalized RawData integration.

The DecalGlowV5 command applies the same canonical provenance, default
selection, complete-pass, batch-type, warning, validation, and exact
DX11/DX12 target checks to `unpacked_decalglowv5`. Its group-zero contract has
five uniform buffers, `DecalTransparencyMap`, `DecalGlowMap`, and two
samplers. The four local material values also move between DX11 and DX12
`cb0`, so `DecalTextureScaling`, `DecalTextureOffset`,
`DecalIntensityData`, and `DecalGlowColor` are packed by reflected name.
Harness-authored per-object bytes again provide the full six-matrix
`DecalVSPerObjectData` layout and only the shader-active, two-register
`DecalPSPerObjectData` prefix. Both `displayData.y` and `shipData.y` are set
to `1` for decal visibility and ship activation strength respectively; this
shader does not consume the kill-count lane.

The browser renders three cases per backend: both patterned textures, a white
transparency control, and a white glow control. Each case must preserve the
same bounded silhouette and match byte-for-byte between DX11 and DX12. Both
white controls must also change at least half the active pixels with a
substantial average RGB delta, proving independently that both texture
samples affect the result. DX11 sampler `s0` uses zero-border addressing,
which WebGPU cannot express. This fixture deliberately adapts it to
clamp-to-edge and authors a zero red-channel outer texel ring on the
single-mip transparency texture, matching the zero border in the only channel
this shader reads. This is a controlled fixture adaptation, not validation of
general D3D border-address behavior. The values, textures, and sampler
adaptation are conformance inputs, not production defaults, final blend/pass
policy, or a finalized RawData integration.

The QuadV5 path supplies semantic material, per-frame, and per-object values
rather than hand-addressed constant-buffer rows. It calls
`buildEveSpaceObjectMainUniformData(...)` directly; that serializer reflects
this package's stage-local
material `cb0`, then packs Carbon's full `PerFrameVSData` (736 bytes),
`PerFramePSData` (1888 bytes), `EveSpaceObjectVSData` (464 bytes), and
`EveSpaceObjectPSData` (464 bytes). The static high-quality package's WGSL
minimum binding sizes are 384, 512, 352, 416, and 432 bytes; the skinned
package raises the fourth minimum to 432 bytes. WebGPU permits the full Carbon
payloads because each is at least its canonical minimum. This proves the first
bounded Carbon ABI serializer and engine-owned uniform upload path without
asserting a library policy contract. The harness uses deterministic fixture
values for every reflected material constant and bounded struct field, and the
renderer must still supply authoritative production values. Its matrices use
logical gl-matrix storage and are transposed once into the row-oriented cbuffer
register bytes consumed by WGSL. The skinned bone table separately exercises
the shader's already-packed `Float4x3` storage-buffer contract. The GPU geometry
adapter deliberately begins after mesh packing and semantic-to-location
mapping; it is not a `TriGeometryRes` loader or CMF conversion stage. The
bounded decoded-RGBA8 texture payloads and complete selected WebGPU sampler
descriptors are explicit harness inputs that the device realizes and the
shader samples. Feeding texture bytes from actual
reader/CjsResource requests, GR2-to-CMF geometry preparation, authoritative
sampler override selection/Carbon conversion, application registration,
broader texture formats, a uniform scheduler, render-state translation, and
full production resource lifetime remain outstanding. The final engine
publication stage itself is implemented and exercised.

The `--prepare-cewgpu` and `--prepare-matrix` modes read through
`format-webgpu` and `CjsWebGPUPackage`, compile WGSL, create the canonical
bind-group/pipeline layouts, and require zero warnings. Those preparation-only
modes deliberately stop before render-pipeline creation and drawing. The
matrix mode additionally creates validation-only native compute pipelines
through a harness-private helper served to the probe page; it performs no
dispatch and does not widen the render-only public `CjsWebGPUDevice` API.
Unlike the ship-family draw flags, preparation requires no geometry or live
resource fixtures.

The QuadV5 and DecalV5 commands are direct format/engine integration gates.
They do not load `runtime-core`, `runtime-resource`, or `runtime-trinity`.

To exercise the real package boundary, pass a CEWGPU package containing the
generated `Main.pass0.vertex` and `Main.pass0.pixel` shaders plus its canonical
WGSL layout:

```powershell
npm.cmd run test:webgpu:required -- --draw-cewgpu .\artifacts\copyblit.cewgpu
```

The Node launcher reads the package through `format-webgpu` and
`CjsWebGPUPackage`, then serves only the validated pipeline descriptor. The
`CjsWebGPUDevice` creates explicit bind-group and pipeline layouts from numeric
groups, bindings, visibility, and nested buffer/texture/sampler layouts.
Fixture resources are selected by canonical scope identity. Version-2
unshared bindings use `@vertex`, `@fragment`, or `@compute` keys even when the
tuple occurs in only one stage; a bare base key is reserved for a confirmed
shared multi-stage binding. Version-1 and unversioned layouts may still
normalize a missing scope to the base D3D key. Descriptor slots are never
hardcoded or renumbered. This bounded gate rejects missing WGSL, unsupported
render states/resources, dynamic offsets, layout holes, and non-canonical
binding provenance before GPU submission.

The real copyblit pass's replacement blend state is translated exactly to
WebGPU (`one`/`zero`, `add` for color and alpha). Other render-state
combinations remain an explicit pre-submit failure.

The launcher prefers an installed Chrome channel and falls back to Playwright's
bundled Chromium. Set `CJS_WEBGPU_BROWSER_CHANNEL` to a Playwright channel name
when a runner needs an explicit browser choice.
