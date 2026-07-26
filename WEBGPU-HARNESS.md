# WebGPU Harness

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

To compile a candidate module while preserving the existing render/readback
gate, pass WGSL text by file path:

```powershell
npm.cmd run test:webgpu:required -- --compile-wgsl E:\path\candidate.wgsl
```

The launcher serves only the candidate text to the browser. It does not import
or depend on a compiler package. Compilation diagnostics include severity,
line/column, byte offset/length, and message; validation remains inside the
same WebGPU error scope.

To build and render a generated copyblit pair with engine-owned geometry,
texture, and normalized/cached sampler plus a fixture-owned uniform resource,
pass both modules:

```powershell
npm.cmd run test:webgpu:required -- --draw-wgsl E:\path\vertex.wgsl E:\path\fragment.wgsl
```

This path creates the canonical group-0 `cb0`/`t0`/`s0` layout, renders the
generated pair into the same 4x4 target, and verifies the expected pixels. The
fixtures are intentionally self-contained; runtime-resource is not involved.

## Producing indexed CEWGPU inputs

For normal EVE corpus packages, do not add resource acquisition or batch
conversion to this harness. Build them through tools-core, then select the
qualified CEWGPU file named by its exact `outputPath` entry in
`build-report.json`:

```powershell
cd E:\carbonenginejs-org\tools-core
npm.cmd run build:shader:webgpu -- --shader-target eve-webgpu --build latest --out <output>
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
npm.cmd run test:webgpu:required -- --prepare-cewgpu E:\path\quadv5-main.cewgpu
```

To prepare every distinct pass-ready pipeline from a full permutation-matrix
report in one browser/device session:

```powershell
npm.cmd run test:webgpu:required -- --prepare-matrix E:\path\quadv5-all-permutations.json
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
npm.cmd run test:webgpu:required -- --draw-quadv5 E:\path\quadv5-ppt-on-dx11.cewgpu E:\path\quadv5-ppt-on-dx12.cewgpu
```

Add `--capture-quadv5 E:\path\quadv5-ppt-on.png` to save a browser-rendered
PNG visualization of the DX11 package's two 4x4 active-pixel MRT readbacks
after the expected-pixel and byte-exact DX11/DX12 checks pass. DX12 is not
pictured separately because it has already been required to match. This is a
diagnostic view of readback bytes, not another GPU render or a production scene
capture.

The launcher rejects identical or misordered inputs and any package that is not
body index `4` with all seven expected selections, including
`SPACE_OBJECT_PPT_ENABLED=SOPPT_ENABLED`. It reads each file directly, decodes
it with `CjsFormatWebgpu`, and constructs `CjsWebGPUPackage`. No runtime
library, resource manager, or Trinity contract participates in this gate.

The browser harness supplies one packed indexed quad, three 1x1 CPU texture
payloads, and one explicit filtering-sampler descriptor. Those prepared plain
inputs are atomically realized and published as one device resource bundle;
the structural harness slot exercises the same `GetAdapterResource` /
`SetAdapterResource` / `DestroyAdapterResource` contract expected from
CjsResource without importing its implementation into the browser probe.
`CjsWebGPUDevice.CreateGeometry(...)`
owns the quad's native vertex/index buffers, exposes the exact frozen 40-byte
vertex layout, validates draw capacity and device generation, and releases
both buffers idempotently. `CjsWebGPUDevice.CreateTexture(...)` snapshots and
uploads each `rgba8unorm`/`rgba8unorm-srgb` payload, exposes only a generation-
bound handle, unwraps its private view at the canonical texture binding, and
releases the native texture idempotently. The phase-zero sampler passes through
`RealizeSampler(...)`: its complete already-selected `webgpu-sampler` resource
payload is mapped into the exact bundle shape and published through a guarded
structural adapter slot. The operation then calls `CreateSampler(...)`, which
normalizes and caches the immutable
native sampler separately, returns a logical generation-bound handle, and
unwraps it only at a compatible sampler binding. The bundle
owns all three handle categories, while binding sets own none of them.
For each pipeline, `CjsWebGPUDevice.CreateBindingSet(...)` validates canonical
identities, allocates/uploads five engine-owned uniform buffers, creates the
native bind group, and destroys only those owned buffers. The two `Main.pass0`
pipelines use the same four active vertex attributes, render into two
`rgba8unorm` targets, check expected non-clear pixels, and then require
byte-exact DX11/DX12 equality across the active bytes of both MRTs. That
equality is measured after `rgba8unorm` target quantization; it is not a claim
of unquantized floating-point shader-semantic equivalence. Every WGSL warning
or WebGPU validation error fails the command.

The harness now supplies semantic material, per-frame, and per-object values
rather than hand-addressed constant-buffer rows. It calls
`buildEveSpaceObjectMainUniformData(...)` directly; that serializer reflects
this package's stage-local
material `cb0`, then packs Carbon's full `PerFrameVSData` (736 bytes),
`PerFramePSData` (1888 bytes), `EveSpaceObjectVSData` (464 bytes), and
`EveSpaceObjectPSData` (464 bytes). The package's WGSL minimum binding sizes
remain 160, 656, 352, 128, and 208 bytes; WebGPU permits the full Carbon
payloads because each is at least its canonical minimum. This proves the first
bounded Carbon ABI serializer and engine-owned uniform upload path without
asserting a library policy contract. The harness uses deterministic fixture
values, and the renderer must still supply complete per-frame values. The GPU geometry
adapter deliberately begins after mesh packing and semantic-to-location
mapping; it is not a `TriGeometryRes` loader or CMF conversion stage. The
bounded decoded-RGBA8-to-texture mapping and complete selected-sampler mapping
each have ready-to-register two-stage pipelines and are sampled by phase zero
through separate adapter slots. Feeding the texture path from an actual
reader/CjsResource request, geometry packing, authoritative sampler override
selection/Carbon conversion, application registration, broader texture
formats, a uniform scheduler, render-state translation, and full production
resource lifetime remain outstanding. The final engine publication stage
itself is implemented and exercised.

The `--prepare-cewgpu` and `--prepare-matrix` modes read through
`format-webgpu` and `CjsWebGPUPackage`, compile WGSL, create the canonical
bind-group/pipeline layouts, and require zero warnings. Those preparation-only
modes deliberately stop before render-pipeline creation and drawing. The
matrix mode additionally creates validation-only native compute pipelines
through a harness-private helper served to the probe page; it performs no
dispatch and does not widen the render-only public `CjsWebGPUDevice` API.
Unlike `--draw-quadv5`, preparation requires no geometry or live resource
fixtures.

The QuadV5 command is a direct format/engine integration gate. It does not load
`runtime-core`, `runtime-resource`, or `runtime-trinity`.

To exercise the real package boundary, pass a CEWGPU package containing the
generated `Main.pass0.vertex` and `Main.pass0.pixel` shaders plus its canonical
WGSL layout:

```powershell
npm.cmd run test:webgpu:required -- --draw-cewgpu E:\path\copyblit.cewgpu
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
