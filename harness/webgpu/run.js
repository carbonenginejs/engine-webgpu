import { buildCopyblitDrawDescriptor } from "/packageDraw.js";

const WIDTH = 4;
const HEIGHT = 4;
const BYTES_PER_PIXEL = 4;
const BYTES_PER_ROW = 256;
const EXPECTED_PIXEL = Object.freeze([ 255, 0, 0, 255 ]);
const CONFIG = await fetch("/config.json").then((response) => response.json());

const SOURCE = `
struct VertexOutput
{
    @builtin(position) position: vec4f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput
{
    var positions = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f(3.0, -1.0),
        vec2f(-1.0, 3.0)
    );
    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    return output;
}

@fragment
fn fragmentMain() -> @location(0) vec4f
{
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;

function Assert(condition, message)
{
    if (!condition)
    {
        throw new Error(message);
    }
}

function AssertPixels(bytes, expectedPixel = EXPECTED_PIXEL)
{
    for (let y = 0; y < HEIGHT; y += 1)
    {
        const row = y * BYTES_PER_ROW;
        for (let x = 0; x < WIDTH; x += 1)
        {
            const offset = row + x * BYTES_PER_PIXEL;
            for (let component = 0; component < BYTES_PER_PIXEL; component += 1)
            {
                Assert(
                    bytes[offset + component] === expectedPixel[component],
                    `Pixel mismatch at (${x}, ${y}) component ${component}: ` +
                    `expected ${expectedPixel[component]}, received ${bytes[offset + component]}`
                );
            }
        }
    }
}

function FormatCompilationMessage(message)
{
    const location = message.lineNum
        ? `${message.lineNum}:${message.linePos || 1}`
        : `offset ${message.offset || 0}`;
    return `${message.type} ${location} (${message.offset || 0}+${message.length || 0}): ${message.message}`;
}

async function CompileCandidate(device)
{
    if (!CONFIG.compileWgsl) return null;
    const response = await fetch("/candidate.wgsl");
    Assert(response.ok, `Failed to load candidate WGSL: HTTP ${response.status}`);
    const module = device.createShaderModule({ label: CONFIG.label, code: await response.text() });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((message) => message.type === "error");
    Assert(errors.length === 0, `Candidate WGSL ${CONFIG.label} failed:\n${info.messages.map(FormatCompilationMessage).join("\n")}`);
    return {
        label: CONFIG.label,
        warningCount: info.messages.filter((message) => message.type === "warning").length,
        messages: info.messages.map(FormatCompilationMessage)
    };
}

async function LoadModule(device, path, label)
{
    const response = await fetch(path);
    Assert(response.ok, `Failed to load ${label}: HTTP ${response.status}`);
    return CompileModule(device, await response.text(), label);
}

async function CompileModule(device, code, label)
{
    const module = device.createShaderModule({ label, code });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((message) => message.type === "error");
    Assert(errors.length === 0, `${label} failed:\n${info.messages.map(FormatCompilationMessage).join("\n")}`);
    return { module, warningCount: info.messages.filter((message) => message.type === "warning").length };
}

function VisibilityFlags(visibility)
{
    return visibility.reduce((flags, stage) => flags | ({
        vertex: GPUShaderStage.VERTEX,
        fragment: GPUShaderStage.FRAGMENT,
        compute: GPUShaderStage.COMPUTE
    }[stage] || 0), 0);
}

async function LoadDrawDescriptor()
{
    if (CONFIG.drawCewgpu)
    {
        const response = await fetch("/draw-package.json");
        Assert(response.ok, `Failed to load ${CONFIG.packageLabel}: HTTP ${response.status}`);
        return buildCopyblitDrawDescriptor(await response.json());
    }
    if (!CONFIG.drawWgsl) return null;
    const [ vertex, fragment ] = await Promise.all([
        fetch("/vertex.wgsl").then((response) => response.text()),
        fetch("/fragment.wgsl").then((response) => response.text())
    ]);
    return buildCopyblitDrawDescriptor({
        key: "fixture.pass0",
        techniqueName: "fixture",
        passIndex: 0,
        renderStates: 0,
        states: [],
        shaderModules: [
            { key: "fixture.pass0.vertex", stageName: "vertex", entryPoint: "main", wgsl: vertex },
            { key: "fixture.pass0.pixel", stageName: "pixel", entryPoint: "main", wgsl: fragment }
        ],
        bindGroups: [ {
            group: 0,
            bindings: [
                { sourceTruth: "wgsl-layout", resourceKind: "uniform-buffer", registerSpace: 0, registerIndex: 0, group: 0, binding: 0, visibility: [ "fragment" ], dynamic: false, layout: { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 48 } } },
                { sourceTruth: "wgsl-layout", resourceKind: "sampled-resource", registerSpace: 0, registerIndex: 0, group: 0, binding: 1, visibility: [ "fragment" ], dynamic: false, layout: { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } } },
                { sourceTruth: "wgsl-layout", resourceKind: "sampler", registerSpace: 0, registerIndex: 0, group: 0, binding: 2, visibility: [ "fragment" ], dynamic: false, layout: { sampler: { type: "filtering" } } }
            ]
        } ]
    });
}

async function CreateGeneratedDraw(device)
{
    const descriptor = await LoadDrawDescriptor();
    if (!descriptor) return null;
    device.pushErrorScope("validation");
    let validationScopeOpen = true;
    try
    {
        const vertexShader = descriptor.shaders.find((entry) => entry.stage === "vertex");
        const fragmentShader = descriptor.shaders.find((entry) => entry.stage === "fragment");
        const vertex = await CompileModule(device, vertexShader.code, vertexShader.key || CONFIG.vertexLabel);
        const fragment = await CompileModule(device, fragmentShader.code, fragmentShader.key || CONFIG.fragmentLabel);
        Assert(vertex.warningCount + fragment.warningCount === 0, "Generated WGSL must compile with zero warnings");
        const bindGroupLayouts = descriptor.bindGroups.map((group) => device.createBindGroupLayout({
            label: `${descriptor.key} group ${group.group} layout`,
            entries: group.bindings.map((entry) => ({
                binding: entry.binding,
                visibility: VisibilityFlags(entry.visibility),
                ...entry.layout
            }))
        }));
        const pipeline = await device.createRenderPipelineAsync({
            label: "generated copyblit pipeline",
            layout: device.createPipelineLayout({ bindGroupLayouts }),
            vertex: {
                module: vertex.module,
                entryPoint: vertexShader.entryPoint,
                buffers: [ {
                    arrayStride: 24,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x4" },
                        { shaderLocation: 1, offset: 16, format: "float32x2" }
                    ]
                } ]
            },
            fragment: {
                module: fragment.module,
                entryPoint: fragmentShader.entryPoint,
                targets: [ {
                    format: "rgba8unorm",
                    ...(descriptor.blend ? { blend: descriptor.blend } : {})
                } ]
            },
            primitive: { topology: "triangle-list" }
        });
        const vertices = new Float32Array([
        -1, -1, 0, 1, 0, 0,
        3, -1, 0, 1, 1, 0,
        -1, 3, 0, 1, 0, 1
    ]);
        const vertexBuffer = device.createBuffer({
        label: "generated copyblit vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
        device.queue.writeBuffer(vertexBuffer, 0, vertices);
        const constants = new Float32Array([
        0, 0, 1, 1,
        0, 0, 1, 1,
        1, -1, 1, 1
    ]);
        const uniformBuffer = device.createBuffer({
        label: "generated copyblit cb0",
        size: constants.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
        device.queue.writeBuffer(uniformBuffer, 0, constants);
        const sampledTexture = device.createTexture({
        label: "generated copyblit t0",
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
        device.queue.writeTexture(
        { texture: sampledTexture },
        new Uint8Array([ 128, 128, 0, 255 ]),
        { bytesPerRow: 4, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
    );
        const sampler = device.createSampler({
        label: "generated copyblit s0",
        minFilter: "linear",
        magFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
    });
        const fixtureResources = new Map([
        [ "uniform-buffer:0:0", { buffer: uniformBuffer } ],
        [ "sampled-resource:0:0", sampledTexture.createView() ],
        [ "sampler:0:0", sampler ]
    ]);
        const bindGroups = descriptor.bindGroups.map((group) => device.createBindGroup({
        label: `${descriptor.key} group ${group.group}`,
        layout: bindGroupLayouts[group.group],
        entries: group.bindings.map((entry) => ({
            binding: entry.binding,
            resource: fixtureResources.get(entry.identity)
        }))
    }));
        const validationError = await device.popErrorScope();
        validationScopeOpen = false;
        Assert(!validationError, `Generated package validation failed: ${validationError?.message || validationError}`);
        return {
            pipeline,
            vertexBuffer,
            uniformBuffer,
            sampledTexture,
            bindGroups,
            expectedPixel: [ 128, 128, 255, 255 ],
            result: {
                vertexLabel: CONFIG.vertexLabel,
                fragmentLabel: CONFIG.fragmentLabel,
                packageLabel: CONFIG.packageLabel,
                warningCount: vertex.warningCount + fragment.warningCount
            }
        };
    }
    finally
    {
        if (validationScopeOpen) await device.popErrorScope().catch(() => null);
    }
}

async function RunHarness()
{
    if (!navigator.gpu)
    {
        return { status: "skipped", reason: "navigator.gpu is unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter)
    {
        return { status: "skipped", reason: "navigator.gpu.requestAdapter() returned null" };
    }

    const device = await adapter.requestDevice();
    let texture = null;
    let readback = null;
    let generatedDraw = null;
    let errorScopeOpen = true;

    device.pushErrorScope("validation");
    try
    {
        const compiledCandidate = await CompileCandidate(device);
        generatedDraw = await CreateGeneratedDraw(device);
        const shaderModule = device.createShaderModule({
            label: "engine-webgpu phase-0 shader",
            code: SOURCE
        });
        const compilationInfo = await shaderModule.getCompilationInfo();
        const compilationErrors = compilationInfo.messages.filter((message) => message.type === "error");
        Assert(
            compilationErrors.length === 0,
            `WGSL compilation failed:\n${compilationErrors.map((message) => message.message).join("\n")}`
        );

        const pipeline = generatedDraw?.pipeline || device.createRenderPipeline({
            label: "engine-webgpu phase-0 pipeline",
            layout: "auto",
            vertex: { module: shaderModule, entryPoint: "vertexMain" },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [ { format: "rgba8unorm" } ]
            },
            primitive: { topology: "triangle-list" }
        });

        texture = device.createTexture({
            label: "engine-webgpu phase-0 offscreen target",
            size: { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 },
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });
        readback = device.createBuffer({
            label: "engine-webgpu phase-0 readback",
            size: BYTES_PER_ROW * HEIGHT,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const encoder = device.createCommandEncoder({ label: "engine-webgpu phase-0 encoder" });
        const pass = encoder.beginRenderPass({
            label: "engine-webgpu phase-0 render pass",
            colorAttachments: [ {
                view: texture.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store"
            } ]
        });
        pass.setPipeline(pipeline);
        if (generatedDraw)
        {
            pass.setVertexBuffer(0, generatedDraw.vertexBuffer);
            for (let group = 0; group < generatedDraw.bindGroups.length; group += 1)
            {
                pass.setBindGroup(group, generatedDraw.bindGroups[group]);
            }
        }
        pass.draw(3);
        pass.end();

        encoder.copyTextureToBuffer(
            { texture },
            { buffer: readback, bytesPerRow: BYTES_PER_ROW, rowsPerImage: HEIGHT },
            { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 }
        );
        device.queue.submit([ encoder.finish() ]);
        await device.queue.onSubmittedWorkDone();

        const validationError = await device.popErrorScope();
        errorScopeOpen = false;
        Assert(!validationError, `WebGPU validation failed: ${validationError?.message || validationError}`);

        await readback.mapAsync(GPUMapMode.READ);
        AssertPixels(new Uint8Array(readback.getMappedRange()), generatedDraw?.expectedPixel);
        readback.unmap();

        return {
            status: "passed",
            adapter: adapter.info?.device || adapter.info?.description || "available adapter",
            pixelCount: WIDTH * HEIGHT,
            compiledCandidate,
            generatedDraw: generatedDraw?.result || null
        };
    }
    finally
    {
        if (errorScopeOpen)
        {
            await device.popErrorScope().catch(() => null);
        }
        if (readback?.mapState === "mapped")
        {
            readback.unmap();
        }
        readback?.destroy();
        texture?.destroy();
        generatedDraw?.vertexBuffer.destroy();
        generatedDraw?.uniformBuffer.destroy();
        generatedDraw?.sampledTexture.destroy();
        device.destroy();
    }
}

globalThis.webgpuHarnessResult = RunHarness().catch((error) => ({
    status: "failed",
    error: error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error)
}));

const result = await globalThis.webgpuHarnessResult;
document.querySelector("#result").textContent = JSON.stringify(result, null, 2);
