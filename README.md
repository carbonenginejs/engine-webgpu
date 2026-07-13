# @carbonenginejs/engine-webgpu

WebGPU backend support for CarbonEngineJS. This first implementation slice is
descriptor-only: it consumes `CEWGPU` package data, preserves Carbon-style
effect-path rewriting rules, and exposes immutable pipeline, bind-group, and
shader-module records without creating GPU objects.

Part of the CarbonEngineJS runtime/engine tier. Ports/adapts from CarbonEngine
(https://github.com/carbonengine, MIT); ccpwgl is consulted as a behavioral
reference donor where Carbon naming/routing behavior needs preservation.

## Status

Phase 1 engine slice is implemented:

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

Non-goals for this slice:

- no `GPUDevice`
- no shader-module creation
- no bind-group or pipeline realization
- no resource manager or render loop

This keeps WebGL untouched while giving future runtime work a stable package
consumer seam.

A separate maintained browser harness now proves that the local JavaScript
toolchain can acquire WebGPU, compile WGSL, render offscreen, copy to a padded
readback buffer, and validate pixels. It also renders the generated copyblit
vertex/fragment pair with fixture-owned cb0/t0/s0 resources. It does not yet
turn the descriptor classes into live device objects. See `WEBGPU-HARNESS.md`.

## Public API

```js
import {
  CjsWebGPUPackage,
  normalizeEffectPath,
  shaderModelSuffix,
  toCompiledEffectPath
} from "@carbonenginejs/engine-webgpu";

const pkg = CjsWebGPUPackage.from(packageJson);
const pipeline = pkg.GetPipeline("Main", 0);
const compiledPath = toCompiledEffectPath("res:/graphics/effect/space/quadv5.fx", {
  effectRoot: "/effect.webgpu/",
  quality: "high"
});
```

Exports:

- `CjsWebGPUPackage`
- `CjsWebGPUPipeline`
- `CjsWebGPUShaderModule`
- `CjsWebGPUBindGroup`
- `CjsWebGPUResource`
- `CjsWebGPUBuffer`
- `CjsWebGPUTexture`
- `CjsWebGPUSampler`
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
