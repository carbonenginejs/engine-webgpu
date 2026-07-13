# WebGPU Harness

The phase-zero harness is plain JavaScript. Node launches a headless Chromium
page through Playwright; the page compiles WGSL, renders a full-screen triangle
into a 4x4 offscreen `rgba8unorm` texture, copies the result through a
256-byte-row-padded buffer, maps it, and verifies all pixels.

It does not use Deno, TypeScript, a canvas, Carbon assets, network access, or
another CarbonEngineJS package.

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

To compile a candidate module while preserving the existing render/readback
gate, pass WGSL text by file path:

```powershell
npm.cmd run test:webgpu:required -- --compile-wgsl E:\path\candidate.wgsl
```

The launcher serves only the candidate text to the browser. It does not import
or depend on a compiler package. Compilation diagnostics include severity,
line/column, byte offset/length, and message; validation remains inside the
same WebGPU error scope.

To build and render a generated copyblit pair with fixture-owned vertex,
uniform, texture, and sampler resources, pass both modules:

```powershell
npm.cmd run test:webgpu:required -- --draw-wgsl E:\path\vertex.wgsl E:\path\fragment.wgsl
```

This path creates the canonical group-0 `cb0`/`t0`/`s0` layout, renders the
generated pair into the same 4x4 target, and verifies the expected pixels. The
fixtures are intentionally self-contained; runtime-resource is not involved.

To exercise the real package boundary, pass a CEWGPU package containing the
generated `Main.pass0.vertex` and `Main.pass0.pixel` shaders plus its canonical
WGSL layout:

```powershell
npm.cmd run test:webgpu:required -- --draw-cewgpu E:\path\copyblit.cewgpu
```

The Node launcher reads the package through `format-webgpu` and
`CjsWebGPUPackage`, then serves only the validated pipeline descriptor. The
browser creates explicit bind-group and pipeline layouts from its numeric
groups, bindings, visibility, and nested buffer/texture/sampler layouts.
Fixture resources are selected by D3D identity (`cb0`, `t0`, and `s0` in
register space 0); descriptor slots are never hardcoded or renumbered. This
bounded gate rejects missing WGSL, unsupported render states/resources,
dynamic offsets, layout holes, and non-canonical binding provenance before GPU
submission.

The real copyblit pass's replacement blend state is translated exactly to
WebGPU (`one`/`zero`, `add` for color and alpha). Other render-state
combinations remain an explicit pre-submit failure.

The launcher prefers an installed Chrome channel and falls back to Playwright's
bundled Chromium. Set `CJS_WEBGPU_BROWSER_CHANNEL` to a Playwright channel name
when a runner needs an explicit browser choice.
