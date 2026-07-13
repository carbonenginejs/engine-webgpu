import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

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
const HOST = "127.0.0.1";
const BROWSER_ARGS = Object.freeze([
    "--enable-unsafe-webgpu",
    "--use-webgpu-adapter=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-dawn-features=allow_unsafe_apis",
    "--use-gpu-in-tests",
    "--disable-gpu-sandbox"
]);

async function ReadPackageDraw()
{
    if (!DRAW_CEWGPU_PATH) return null;
    const [ { CjsFormatWebgpu }, { CjsWebGPUPackage }, { buildCopyblitDrawDescriptor } ] = await Promise.all([
        import("../../format-webgpu/src/index.js"),
        import("../src/index.js"),
        import("../src/core/packageDraw.js")
    ]);
    const pkg = CjsWebGPUPackage.fromBytes(await readFile(DRAW_CEWGPU_PATH), {
        read: CjsFormatWebgpu.read,
        readOptions: { source: DRAW_CEWGPU_PATH }
    });
    const pipeline = pkg.GetPipeline("Main", 0);
    if (!pipeline) throw new Error("CEWGPU package has no Main pass 0 pipeline");
    if (!pipeline.HasCompleteWgsl()) throw new Error("CEWGPU Main pass 0 does not have complete WGSL");
    const pipelineJson = pipeline.ToJSON();
    buildCopyblitDrawDescriptor(pipelineJson);
    return pipelineJson;
}

const PACKAGE_DRAW = await ReadPackageDraw();

const ASSETS = new Map([
    [ "/", { path: new URL("../harness/webgpu/index.html", import.meta.url), type: "text/html; charset=utf-8" } ],
    [ "/index.html", { path: new URL("../harness/webgpu/index.html", import.meta.url), type: "text/html; charset=utf-8" } ],
    [ "/run.js", { path: new URL("../harness/webgpu/run.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/packageDraw.js", { path: new URL("../src/core/packageDraw.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/freeze.js", { path: new URL("../src/core/freeze.js", import.meta.url), type: "text/javascript; charset=utf-8" } ],
    [ "/config.json", {
        body: JSON.stringify({
            compileWgsl: !!COMPILE_WGSL_PATH,
            label: COMPILE_WGSL_PATH ? basename(COMPILE_WGSL_PATH) : null,
            drawWgsl: !!DRAW_VERTEX_PATH,
            drawCewgpu: !!PACKAGE_DRAW,
            packageLabel: DRAW_CEWGPU_PATH ? basename(DRAW_CEWGPU_PATH) : null,
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

        console.log(`PASS engine-webgpu WebGPU harness: ${result.adapter}`);
        console.log(`Compiled WGSL and verified ${result.pixelCount} offscreen RGBA8 pixels.`);
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
