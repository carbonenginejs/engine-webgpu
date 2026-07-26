import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { buildMatrixPipelines } from "../src/core/matrixPipelines.js";
import { validateQuadV5PackagePair } from "../harness/webgpu/quadV5Fixture.js";

import { chromium } from "playwright";

const REQUIRED = process.argv.includes("--required");
const COMPILE_WGSL_INDEX = process.argv.indexOf("--compile-wgsl");
if (COMPILE_WGSL_INDEX >= 0 && !process.argv[COMPILE_WGSL_INDEX + 1])
{
    throw new Error("--compile-wgsl requires a WGSL file path");
}
const COMPILE_WGSL_PATH = COMPILE_WGSL_INDEX >= 0 ? resolve(process.argv[COMPILE_WGSL_INDEX + 1]) : null;
const DRAW_WGSL_INDEX = process.argv.indexOf("--draw-wgsl");
if (DRAW_WGSL_INDEX >= 0 && (!process.argv[DRAW_WGSL_INDEX + 1] || !process.argv[DRAW_WGSL_INDEX + 2]))
{
    throw new Error("--draw-wgsl requires vertex and fragment WGSL file paths");
}
const DRAW_VERTEX_PATH = DRAW_WGSL_INDEX >= 0 ? resolve(process.argv[DRAW_WGSL_INDEX + 1]) : null;
const DRAW_FRAGMENT_PATH = DRAW_WGSL_INDEX >= 0 ? resolve(process.argv[DRAW_WGSL_INDEX + 2]) : null;
const DRAW_CEWGPU_INDEX = process.argv.indexOf("--draw-cewgpu");
if (DRAW_CEWGPU_INDEX >= 0 && !process.argv[DRAW_CEWGPU_INDEX + 1])
{
    throw new Error("--draw-cewgpu requires a CEWGPU file path");
}
if (DRAW_CEWGPU_INDEX >= 0 && DRAW_WGSL_INDEX >= 0)
{
    throw new Error("--draw-cewgpu and --draw-wgsl are mutually exclusive");
}
const DRAW_CEWGPU_PATH = DRAW_CEWGPU_INDEX >= 0 ? resolve(process.argv[DRAW_CEWGPU_INDEX + 1]) : null;
const DRAW_QUADV5_INDEX = process.argv.indexOf("--draw-quadv5");
if (DRAW_QUADV5_INDEX >= 0
  && (!process.argv[DRAW_QUADV5_INDEX + 1] || !process.argv[DRAW_QUADV5_INDEX + 2]
    || process.argv[DRAW_QUADV5_INDEX + 1].startsWith("--")
    || process.argv[DRAW_QUADV5_INDEX + 2].startsWith("--")))
{
    throw new Error("--draw-quadv5 requires DX11-derived and DX12-derived CEWGPU file paths");
}
const DRAW_QUADV5_PATHS = DRAW_QUADV5_INDEX >= 0
    ? [ resolve(process.argv[DRAW_QUADV5_INDEX + 1]), resolve(process.argv[DRAW_QUADV5_INDEX + 2]) ]
    : null;
const CAPTURE_QUADV5_INDEX = process.argv.indexOf("--capture-quadv5");
if (CAPTURE_QUADV5_INDEX >= 0
  && (!process.argv[CAPTURE_QUADV5_INDEX + 1] || process.argv[CAPTURE_QUADV5_INDEX + 1].startsWith("--")))
{
    throw new Error("--capture-quadv5 requires a PNG output path");
}
if (CAPTURE_QUADV5_INDEX >= 0 && DRAW_QUADV5_INDEX < 0)
{
    throw new Error("--capture-quadv5 requires --draw-quadv5");
}
const CAPTURE_QUADV5_PATH = CAPTURE_QUADV5_INDEX >= 0
    ? resolve(process.argv[CAPTURE_QUADV5_INDEX + 1])
    : null;
if (DRAW_QUADV5_INDEX >= 0 && (DRAW_CEWGPU_INDEX >= 0 || DRAW_WGSL_INDEX >= 0))
{
    throw new Error("--draw-quadv5 cannot be combined with another draw input");
}
const PREPARE_CEWGPU_INDEX = process.argv.indexOf("--prepare-cewgpu");
if (PREPARE_CEWGPU_INDEX >= 0 && !process.argv[PREPARE_CEWGPU_INDEX + 1])
{
    throw new Error("--prepare-cewgpu requires a CEWGPU file path");
}
if (PREPARE_CEWGPU_INDEX >= 0 && (DRAW_CEWGPU_INDEX >= 0 || DRAW_WGSL_INDEX >= 0 || DRAW_QUADV5_INDEX >= 0))
{
    throw new Error("--prepare-cewgpu cannot be combined with a draw input");
}
const PREPARE_CEWGPU_PATH = PREPARE_CEWGPU_INDEX >= 0 ? resolve(process.argv[PREPARE_CEWGPU_INDEX + 1]) : null;
const PREPARE_MATRIX_INDEX = process.argv.indexOf("--prepare-matrix");
if (PREPARE_MATRIX_INDEX >= 0 && !process.argv[PREPARE_MATRIX_INDEX + 1])
{
    throw new Error("--prepare-matrix requires a CJS_WEBGPU_EFFECT_MATRIX JSON file path");
}
if (PREPARE_MATRIX_INDEX >= 0
  && (PREPARE_CEWGPU_INDEX >= 0 || DRAW_CEWGPU_INDEX >= 0 || DRAW_WGSL_INDEX >= 0 || DRAW_QUADV5_INDEX >= 0))
{
    throw new Error("--prepare-matrix cannot be combined with another package or draw input");
}
const PREPARE_MATRIX_PATH = PREPARE_MATRIX_INDEX >= 0 ? resolve(process.argv[PREPARE_MATRIX_INDEX + 1]) : null;
const HOST = "127.0.0.1";
const BROWSER_ARGS = Object.freeze([
    "--enable-unsafe-webgpu",
    "--use-webgpu-adapter=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-dawn-features=allow_unsafe_apis",
    "--use-gpu-in-tests",
    "--disable-gpu-sandbox"
]);

async function ReadPackagePipeline(path)
{
    const [ { CjsFormatWebgpu }, { CjsWebGPUPackage }, { buildCopyblitDrawDescriptor } ] = await Promise.all([
        import("../../format-webgpu/src/index.js"),
        import("../src/index.js"),
        import("../src/core/packageDraw.js")
    ]);
    const pkg = CjsWebGPUPackage.fromBytes(await readFile(path), {
        read: CjsFormatWebgpu.read,
        readOptions: { source: path }
    });
    const pipeline = pkg.GetPipeline("Main", 0);
    if (!pipeline) throw new Error("CEWGPU package has no Main pass 0 pipeline");
    if (!pipeline.HasCompleteWgsl()) throw new Error("CEWGPU Main pass 0 does not have complete WGSL");
    return { pipeline: pipeline.ToJSON(), validateCopyblit: buildCopyblitDrawDescriptor };
}

async function ReadQuadV5Packages(paths)
{
    const comparablePath = (value) => process.platform === "win32" ? value.toLowerCase() : value;
    if (comparablePath(paths[0]) === comparablePath(paths[1]))
    {
        throw new Error("--draw-quadv5 requires distinct DX11 and DX12 package files");
    }
    const [
        { CjsFormatWebgpu },
        { CjsWebGPUPackage }
    ] = await Promise.all([
        import("../../format-webgpu/src/index.js"),
        import("../src/index.js")
    ]);
    const requests = [ "dx11", "dx12" ].map((backend, index) => ({
        backend,
        filePath: paths[index],
        resourcePath: `res:/webgpu-harness/quadv5/${backend}.cewgpu`
    }));

    const records = [];
    for (const request of requests)
    {
        const pkg = CjsWebGPUPackage.fromBytes(await readFile(request.filePath), {
            read: CjsFormatWebgpu.read,
            readOptions: { source: request.filePath }
        });
        if (!(pkg instanceof CjsWebGPUPackage))
        {
            throw new Error(`${request.filePath} did not prepare as CjsWebGPUPackage`);
        }
        const pipeline = pkg.GetPipeline("Main", 0);
        if (!pipeline || !pipeline.HasCompleteWgsl())
        {
            throw new Error(`${request.filePath} has no complete Main.pass0 pipeline`);
        }
        const record = {
            backend: request.backend,
            label: basename(request.filePath),
            filePath: request.filePath,
            resourcePath: request.resourcePath,
            loadPath: "readFile -> CjsFormatWebgpu -> CjsWebGPUPackage",
            analysis: pkg.analysis,
            metadata: pkg.metadata,
            pipeline: pipeline.ToJSON()
        };
        records.push(record);
    }
    validateQuadV5PackagePair(records);
    return records;
}

const PACKAGE_DRAW_RECORD = DRAW_CEWGPU_PATH ? await ReadPackagePipeline(DRAW_CEWGPU_PATH) : null;
if (PACKAGE_DRAW_RECORD) PACKAGE_DRAW_RECORD.validateCopyblit(PACKAGE_DRAW_RECORD.pipeline);
const PACKAGE_DRAW = PACKAGE_DRAW_RECORD?.pipeline || null;
const PACKAGE_PREPARE = PREPARE_CEWGPU_PATH ? (await ReadPackagePipeline(PREPARE_CEWGPU_PATH)).pipeline : null;
const MATRIX_PREPARE = PREPARE_MATRIX_PATH
    ? buildMatrixPipelines(JSON.parse(await readFile(PREPARE_MATRIX_PATH, "utf8")))
    : null;
const QUADV5_DRAW = DRAW_QUADV5_PATHS ? await ReadQuadV5Packages(DRAW_QUADV5_PATHS) : null;

const ASSETS = new Map([
    [ "/", { path: new URL("../harness/webgpu/index.html", import.meta.url), type: "text/html; charset=utf-8" } ],
    [ "/index.html", { path: new URL("../harness/webgpu/index.html", import.meta.url), type: "text/html; charset=utf-8" } ],
    [ "/run.js", { path: new URL("../harness/webgpu/run.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/computePipeline.js", { path: new URL("../harness/webgpu/computePipeline.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/CjsWebGPUDevice.js", { path: new URL("../src/CjsWebGPUDevice.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/packageDraw.js", { path: new URL("../src/core/packageDraw.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/spaceObjectMainBindings.js", { path: new URL("../src/core/spaceObjectMainBindings.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/quadV5Fixture.js", { path: new URL("../harness/webgpu/quadV5Fixture.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/freeze.js", { path: new URL("../src/core/freeze.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/config.json", {
        body: JSON.stringify({
            compileWgsl: !!COMPILE_WGSL_PATH,
            label: COMPILE_WGSL_PATH ? basename(COMPILE_WGSL_PATH) : null,
            drawWgsl: !!DRAW_VERTEX_PATH,
            drawCewgpu: !!PACKAGE_DRAW,
            drawQuadV5: !!QUADV5_DRAW,
            prepareCewgpu: !!PACKAGE_PREPARE,
            prepareMatrix: !!MATRIX_PREPARE,
            packageLabel: DRAW_CEWGPU_PATH ? basename(DRAW_CEWGPU_PATH) : null,
            quadV5Labels: DRAW_QUADV5_PATHS?.map((path) => basename(path)) || [],
            preparePackageLabel: PREPARE_CEWGPU_PATH ? basename(PREPARE_CEWGPU_PATH) : null,
            prepareMatrixLabel: PREPARE_MATRIX_PATH ? basename(PREPARE_MATRIX_PATH) : null,
            vertexLabel: DRAW_VERTEX_PATH ? basename(DRAW_VERTEX_PATH) : null,
            fragmentLabel: DRAW_FRAGMENT_PATH ? basename(DRAW_FRAGMENT_PATH) : null
        }),
        type: "application/json; charset=utf-8"
    } ]
]);
if (COMPILE_WGSL_PATH)
{
    ASSETS.set("/candidate.wgsl", { path: COMPILE_WGSL_PATH, type: "text/plain; charset=utf-8" });
}
if (DRAW_VERTEX_PATH)
{
    ASSETS.set("/vertex.wgsl", { path: DRAW_VERTEX_PATH, type: "text/plain; charset=utf-8" });
    ASSETS.set("/fragment.wgsl", { path: DRAW_FRAGMENT_PATH, type: "text/plain; charset=utf-8" });
}
if (PACKAGE_DRAW)
{
    ASSETS.set("/draw-package.json", {
        body: JSON.stringify(PACKAGE_DRAW),
        type: "application/json; charset=utf-8"
    });
}
if (PACKAGE_PREPARE)
{
    ASSETS.set("/prepare-package.json", {
        body: JSON.stringify(PACKAGE_PREPARE),
        type: "application/json; charset=utf-8"
    });
}
if (MATRIX_PREPARE)
{
    ASSETS.set("/prepare-matrix.json", {
        body: JSON.stringify(MATRIX_PREPARE),
        type: "application/json; charset=utf-8"
    });
}
if (QUADV5_DRAW)
{
    ASSETS.set("/draw-quadv5.json", {
        body: JSON.stringify(QUADV5_DRAW),
        type: "application/json; charset=utf-8"
    });
}

function Listen(server)
{
    return new Promise((resolve, reject) =>
    {
        server.once("error", reject);
        server.listen(0, HOST, () => resolve(server.address()));
    });
}

function Close(server)
{
    return new Promise((resolve, reject) =>
    {
        server.close((error) => error ? reject(error) : resolve());
    });
}

function CreateHarnessServer()
{
    return createServer(async (request, response) =>
    {
        try
        {
            const pathname = new URL(request.url || "/", `http://${HOST}`).pathname;
            const asset = ASSETS.get(pathname);
            if (!asset)
            {
                response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
                response.end("Not found");
                return;
            }

            response.writeHead(200, {
                "cache-control": "no-store",
                "content-type": asset.type
            });
            response.end(asset.body ?? await readFile(asset.path));
        }
        catch (error)
        {
            response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
            response.end(error instanceof Error ? error.stack : String(error));
        }
    });
}

async function LaunchBrowser()
{
    const requestedChannel = process.env.CJS_WEBGPU_BROWSER_CHANNEL;
    const channels = requestedChannel ? [ requestedChannel ] : [ "chrome", null ];
    const failures = [];

    for (const channel of channels)
    {
        try
        {
            return await chromium.launch({
                ...(channel ? { channel } : {}),
                headless: true,
                args: BROWSER_ARGS
            });
        }
        catch (error)
        {
            failures.push(`${channel || "playwright-chromium"}: ${error instanceof Error ? error.message : error}`);
        }
    }

    throw new Error(`No Chromium browser could be launched:\n${failures.join("\n")}`);
}

async function CaptureQuadV5(page, comparison, outputPath)
{
    if (!Array.isArray(comparison?.targetPixels) || comparison.targetPixels.length !== 2)
    {
        throw new Error("QuadV5 capture requires two target readbacks");
    }
    await page.setViewportSize({ width: 1080, height: 700 });
    await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
body { margin: 0; padding: 42px; color: #e8eefc; background: #090d16;
  font: 16px/1.45 Inter, "Segoe UI", sans-serif; }
h1 { margin: 0 0 6px; font-size: 34px; letter-spacing: -0.02em; }
.subtitle { color: #9eabc5; margin-bottom: 30px; }
.targets { display: flex; gap: 28px; }
.card { flex: 1; padding: 20px; border: 1px solid #273149; border-radius: 16px;
  background: linear-gradient(145deg, #141b2b, #0d121e); box-shadow: 0 16px 45px #0008; }
.card h2 { margin: 0 0 4px; font-size: 20px; }
.rgba { color: #9eabc5; font-family: Consolas, monospace; margin-bottom: 14px; }
.pixels { position: relative; width: 100%; aspect-ratio: 1; border: 1px solid #42506e;
  border-radius: 8px; overflow: hidden; background: #000; }
canvas { width: 100%; height: 100%; image-rendering: pixelated; }
.grid { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, #fff2 1px, transparent 1px),
    linear-gradient(#fff2 1px, transparent 1px); background-size: 25% 25%; }
.footer { margin-top: 24px; color: #7f8ba5; }
</style></head><body>
<h1>QuadV5 PPT-on · body 4</h1>
<div class="subtitle">Actual WebGPU readback - DX11 and DX12 RGBA8 bytes matched after target quantization</div>
<div class="targets">
  <section class="card"><h2>MRT 0 · color</h2><div class="rgba" id="rgba0"></div>
    <div class="pixels"><canvas id="target0"></canvas><div class="grid"></div></div></section>
  <section class="card"><h2>MRT 1 · auxiliary</h2><div class="rgba" id="rgba1"></div>
    <div class="pixels"><canvas id="target1"></canvas><div class="grid"></div></div></section>
</div>
<div class="footer" id="footer"></div>
</body></html>`);
    await page.evaluate((value) =>
    {
        for (let targetIndex = 0; targetIndex < value.targetPixels.length; targetIndex += 1)
        {
            const bytes = value.targetPixels[targetIndex];
            const canvas = document.getElementById(`target${targetIndex}`);
            canvas.width = value.targetWidth;
            canvas.height = value.targetHeight;
            canvas.getContext("2d").putImageData(new ImageData(
                new Uint8ClampedArray(bytes), value.targetWidth, value.targetHeight
            ), 0, 0);
            document.getElementById(`rgba${targetIndex}`).textContent =
                `RGBA8 [${bytes.slice(0, 4).join(", ")}] · ${value.targetWidth}×${value.targetHeight}`;
        }
        document.getElementById("footer").textContent =
            `${value.labels.join("  ↔  ")} · indexed quad · 6 indices · zero WGSL warnings`;
    }, comparison);
    await page.screenshot({ path: outputPath, type: "png", fullPage: true });
}

async function Main()
{
    const server = CreateHarnessServer();
    let browser = null;
    try
    {
        const address = await Listen(server);
        browser = await LaunchBrowser();
        const page = await browser.newPage();
        page.on("pageerror", (error) => console.error(`browser page error: ${error.message}`));
        page.on("requestfailed", (request) => console.error(`browser request failed: ${request.url()} ${request.failure()?.errorText || "unknown"}`));
        page.on("console", (message) =>
        {
            if (message.type() === "error")
            {
                console.error(`browser: ${message.text()}`);
            }
        });
        await page.goto(`http://${HOST}:${address.port}/`, { waitUntil: "load" });
        const result = await page.evaluate(() => globalThis.webgpuHarnessResult);

        if (result.status === "skipped")
        {
            const message = `SKIP engine-webgpu WebGPU harness: ${result.reason}`;
            if (REQUIRED)
            {
                throw new Error(`${message}\nA supported browser GPU adapter is required by this command.`);
            }
            console.log(message);
            console.log("Run `npm.cmd run test:webgpu:required` on a supported runner to enforce the GPU gate.");
            return;
        }
        if (result.status !== "passed")
        {
            throw new Error(`WebGPU harness failed: ${result.error || "unknown browser failure"}`);
        }
        if (CAPTURE_QUADV5_PATH)
        {
            await CaptureQuadV5(page, result.quadV5Comparison, CAPTURE_QUADV5_PATH);
            console.log(`Captured QuadV5 MRT readbacks to ${CAPTURE_QUADV5_PATH}`);
        }

        console.log(`PASS engine-webgpu WebGPU harness: ${result.adapter}`);
        console.log(`Compiled WGSL and verified ${result.pixelCount} offscreen RGBA8 pixels.`);
        if (result.geometryAdapter)
        {
            console.log(`Uploaded and drew ${result.geometryAdapter} geometry.`);
        }
        if (result.textureAdapter)
        {
            console.log(`Uploaded, bound, and sampled ${result.textureAdapter} texture resources.`);
        }
        if (result.samplerAdapter)
        {
            console.log(`Normalized, cached, and bound ${result.samplerAdapter} sampler resources.`);
        }
        if (result.resourcePublication)
        {
            console.log(`Published prepared resource bundles through the ${result.resourcePublication} seam.`);
        }
        if (result.compiledCandidate)
        {
            console.log(`Compiled candidate WGSL ${result.compiledCandidate.label} with ${result.compiledCandidate.warningCount} warnings.`);
        }
        if (result.generatedDraw)
        {
            const label = result.generatedDraw.packageLabel
                || `${result.generatedDraw.vertexLabel} + ${result.generatedDraw.fragmentLabel}`;
            console.log(`Rendered generated pair ${label} with 0 validation errors.`);
        }
        if (result.quadV5Comparison)
        {
            console.log(
                `Rendered PPT-on QuadV5 body ${result.quadV5Comparison.bodyIndex} from ` +
                `${result.quadV5Comparison.labels.join(" and ")} from direct CEWGPU reads; ` +
                `${result.quadV5Comparison.pixelCount} pixels matched exactly across both MRTs and backends ` +
                `with 0 WGSL warnings.`
            );
        }
        if (result.preparedPackage)
        {
            console.log(`Prepared CEWGPU package ${result.preparedPackage.label} with ${result.preparedPackage.bindingCount} canonical bindings and 0 WGSL warnings.`);
        }
        if (result.preparedMatrix)
        {
            console.log(
                `Compiled ${result.preparedMatrix.uniqueShaderModules} unique emitted modules and prepared ` +
                `${result.preparedMatrix.uniquePipelines} unique pipelines ` +
                `(${result.preparedMatrix.uniqueRenderPipelines} render, ` +
                `${result.preparedMatrix.uniqueComputePipelines} compute) from ${result.preparedMatrix.label}, ` +
                `covering ${result.preparedMatrix.coveredShaderOccurrences} emitted stage occurrences and ` +
                `${result.preparedMatrix.coveredOccurrences} ready permutation/pass occurrences with 0 WGSL warnings.`
            );
        }
    }
    finally
    {
        await browser?.close();
        await Close(server).catch(() => undefined);
    }
}

Main().catch((error) =>
{
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
});
