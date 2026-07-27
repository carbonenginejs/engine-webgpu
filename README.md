# @carbonenginejs/engine-webgpu

`@carbonenginejs/engine-webgpu` consumes already-selected CEWGPU package data
and realizes explicit WebGPU pipeline, resource, binding, and draw requests.

Use this experimental package when the caller already owns effect selection,
packed geometry, texture pixels, sampler state, uniform values, and render
policy. It owns WebGPU objects and uploads without depending on runtime-core,
runtime-resource, or runtime-trinity.

## Install

Registry publication is not current. Install dependencies from a source
checkout:

```sh
git clone https://github.com/carbonenginejs/engine-webgpu.git
cd engine-webgpu
npm install
```

## Quick start

In a browser with WebGPU, prepare an already-decoded CEWGPU package and its
selected pipeline:

```js
import {
  CjsWebGPUDevice,
  CjsWebGPUPackage
} from "@carbonenginejs/engine-webgpu";

const pkg = CjsWebGPUPackage.from(packageData);
const pipeline = pkg.GetPipeline("Main", 0);
const webgpu = await CjsWebGPUDevice.Request({
  gpu: navigator.gpu,
  shaderStage: GPUShaderStage
});
try {
  const prepared = await webgpu.PreparePipeline(pipeline, {
    warningsAsErrors: true
  });
} finally {
  webgpu.Destroy();
}
```

Pipeline state, packed resources, binding values, draw encoding, and cleanup
remain explicit caller inputs. The bounded Eve space-object Main serializer
transposes logical matrices once into Carbon cbuffer register-row order while
copying already GPU-form custom-mask slots unchanged.

The standalone harness qualifies synthetic static/skinned QuadV5, both
independently rendered QuadGlassV5 Main passes, non-bindless
DecalV5/DecalCylindricV5/DecalHoleV5, kill-counter DecalCounterV5, and
two-texture DecalGlowV5/DecalGlowCylindricV5 draws through a provisional
Trinity-shaped batch dispatcher without loading SOF, a Trinity graph,
production defaults, or an EVE asset. The dispatcher imports no runtime
package and is not yet a public renderer-composition contract.

## Documentation

- [Package documentation](docs/README.md)
- [Architecture and boundaries](docs/architecture.md)
- [Public API reference](docs/reference/api.md)
- [WebGPU harness](docs/guides/webgpu-harness.md)
- [Class-purpose catalog](docs/reference/classes/README.md)

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE). CarbonEngine and Fenris
Creations (CCP Games) are named for interoperability and provenance context.
This project contains CarbonEngineJS original code unless `NOTICE` states
otherwise and is not affiliated with or endorsed by CCP Games.
