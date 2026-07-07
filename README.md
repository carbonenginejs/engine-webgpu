# @carbonenginejs/engine-webgpu

WebGPU backend: CjsWebGPUDevice (ICjsDevice) + GPU resource adapters keyed off the faithful Tr2*Res + pipeline/bindgroup build from .cewgpu + render loop. Runs headless (Deno) and in-browser.

Part of the CarbonEngineJS runtime/engine tier (Deno + TypeScript, WebGPU-first).
Ports/adapts from CarbonEngine (https://github.com/carbonengine, MIT); ccpwgl consulted as a reference donor.

## Status

Scaffold only — no implementation yet. Layout: src/ (source; index.ts barrel) and test/ (sibling).

## Provenance

CarbonEngine and Fenris Creations (CCP Games) are named for interoperability and provenance context.
This package's runtime code is CarbonEngineJS original work that ports or adapts CarbonEngine class
structure and behavior, verified against the CarbonEngine C++ source, and mines the ccpwgl WebGL port
as a reference donor. Not affiliated with or endorsed by CCP Games.
