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

The standalone harness qualifies synthetic static/skinned QuadV5, common
PPT-on skinned QuadHeatV5, the PPT-on skinned QuadHeatDetailV5 material-block
high-water and tied-largest active-binding contract, both independently
rendered static and common PPT-on skinned QuadGlassV5 Main passes, cold/hot
PPT-off static QuadHeatV5, independently rendered PPT-off static and PPT-on
skinned QuadSailsV5, PPT-on static and skinned QuadDetailV5, PPT-off skinned
QuadOilV5, non-bindless DecalV5/DecalCylindricV5/DecalHoleV5, kill-counter
DecalCounterV5, and two-texture DecalGlowV5/DecalGlowCylindricV5 draws through a provisional
Trinity-shaped batch dispatcher without loading SOF, a Trinity graph,
production defaults, or an EVE asset. The dispatcher imports no runtime
package and is not yet a public renderer-composition contract. HeatDetail is
covered for contract breadth rather than shader frequency; its three synthetic
cases isolate detail and heat changes while preserving coverage and MRT1.
The representative skinned Heat gate covers a shader correlated to 313 ship
areas across 205 hulls in EVE build 3444265. Its synthetic cold/hot cases
require a spatially varied red response, invariant coverage/MRT1, byte-exact
DX11/DX12 `rgba8unorm` readbacks after target quantization, and zero WGSL
warnings.
The skinned Glass gate covers a build-3444265 shader correlated to 57 ship
areas across 57 hulls. It requires both complementary Main passes, an observed
non-identity indexed bone transform, two PaintMask controls, byte-exact
DX11/DX12 MRT readbacks, and zero WGSL warnings.
The static Sails gate covers the SOF-authored PPT-off body-0 path correlated
to 77 opaque ship areas across 27 hulls. Its paired synthetic cases isolate a
controlled `SailsDetailData` response. The skinned Sails family audit covers
72 opaque ship areas across 33 hulls in that build; its separate synthetic
gate deliberately selects the PPT-on body-4 Main pass and observes indexed
non-identity skinning. Both gates exercise the provisional caller-owned
depth-write recipe and require byte-exact paired MRT readbacks with zero WGSL
warnings. The skinned family count does not claim that body 4 is the
representative SOF-authored default.
The build-3444265 QuadDetailV5 audit covers 587 opaque areas across 257 SOF
hull records.
The audit assigns 473 areas across 189 hull records (80.6% of the areas) to
the static logical path and 114 areas across 68 hull records to the skinned
logical path. The static gate targets the former with a 22-binding body-4 pair;
the separate skinned gate targets the latter with 23 bindings and observed
indexed non-identity skinning. Both reuse four synthetic cases that isolate
pattern projection, Detail1, and Detail2 with paired MRT parity and zero WGSL
warnings. Those totals measure the current pre-transform packages, where the
three Detail maps remain separate; the agreed 3-to-1 array transform and its
engine realization are not yet qualified here. A real pattern application on
ACA1 proves the skinned PPT-on logical
path, but most audited skinned records do not list a pattern, and SOF does not
identify packed versus unpacked containers or body indices. Neither command
loads SOF, an EVE asset, production defaults, runtime-trinity, or a Trinity
graph, and neither attaches or qualifies depth.
The build-3444265 QuadOilV5 audit finds 30 opaque areas across 25 hull records.
Restricting that evidence to live ship geometry leaves seven areas across
seven hulls: six skinned Sleeper hulls and one static hull. The skinned gate
selects their PPT-off body-0 profile with 18 bindings: five uniform buffers,
one vertex bone buffer, ten fragment textures, and two fragment samplers.
Its two synthetic draws differ only in a black versus chromatic
`OilFilmLookupMap`. All 635 covered pixels change across all three RGB
channels with 18 distinct quantized deltas, while MRT1 remains invariant and
both MRTs match byte-for-byte between DX11 and DX12 with zero WGSL warnings.
The command loads no SOF, production ship resource, runtime package, or
Trinity graph, and does not attach or qualify depth.

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
