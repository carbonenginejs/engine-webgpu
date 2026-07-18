import { buildCopyblitDrawDescriptor } from "/packageDraw.js";
import {
    QUADV5_EXPECTED_TARGETS,
    QUADV5_VERTEX_BUFFER_LAYOUT,
    createQuadV5FixtureValues,
    createQuadV5MainBindingValues,
    validateQuadV5PackagePair
} from "/quadV5Fixture.js";
import { CjsWebGPUDevice } from "/CjsWebGPUDevice.js";
import {
    EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR,
    createEveSpaceObjectMainResourceBehavior
} from "/spaceObjectMainBehavior.js";

const WIDTH = 4;
const HEIGHT = 4;
const BYTES_PER_PIXEL = 4;
const BYTES_PER_ROW = 256;
const EXPECTED_PIXEL = Object.freeze([ 255, 0, 0, 255 ]);
const CONFIG = await fetch("/config.json").then((response) => response.json());
const RESOURCE_BEHAVIORS = new Map([ [
    EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR,
    createEveSpaceObjectMainResourceBehavior()
] ]);

const SOURCE = `
struct VertexOutput
{
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var sampledTexture: texture_2d<f32>;
@group(0) @binding(1) var sampledSampler: sampler;

@vertex
fn vertexMain(@location(0) position: vec2f, @location(1) uv: vec2f) -> VertexOutput
{
    var output: VertexOutput;
    output.position = vec4f(position, 0.0, 1.0);
    output.uv = uv;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f
{
    return textureSample(sampledTexture, sampledSampler, input.uv);
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

function CreateAdapterResourceSlot()
{
    const adapterResources = new Map();
    return {
        GetAdapterResource(key)
        {
            return adapterResources.get(key) ?? null;
        },
        SetAdapterResource(key, value)
        {
            adapterResources.set(key, value);
            return this;
        },
        DestroyAdapterResource(key)
        {
            const value = adapterResources.get(key);
            adapterResources.delete(key);
            value?.Destroy?.();
            return this;
        }
    };
}

async function PublishPreparedResourceBundle(webgpu, payload, name)
{
    const resource = CreateAdapterResourceSlot();
    const stage = webgpu.CreateResourcePrepareStage({
        name: `engine-webgpu-${name}`,
        adapterKey: "webgpu"
    });
    const retained = await stage.prepare(payload, { resource });
    Assert(retained === undefined, `${name} publication replaced its retained CPU payload`);
    const bundle = resource.GetAdapterResource("webgpu");
    Assert(bundle, `${name} publication did not populate the WebGPU adapter slot`);
    return bundle;
}

async function PublishPreparedRgba8Texture(webgpu, payload, name, textureKey)
{
    const resource = CreateAdapterResourceSlot();
    const pipeline = webgpu.CreateRgba8TexturePreparePipeline({
        textureKey,
        bundleLabel: `${name} resources`,
        mappingStageName: `engine-webgpu-${name}-map-rgba8`,
        publicationStageName: `engine-webgpu-${name}-publish`,
        adapterKey: "webgpu"
    });
    const mapped = pipeline.stages[0].prepare(payload, { resource });
    Assert(mapped !== payload, `${name} mapping did not produce a texture-bundle payload`);
    const retained = await pipeline.stages[1].prepare(mapped, { resource });
    Assert(retained === undefined, `${name} publication replaced its retained mapped payload`);
    const bundle = resource.GetAdapterResource("webgpu");
    Assert(bundle, `${name} publication did not populate the WebGPU adapter slot`);
    return bundle;
}

async function PublishPreparedSampler(webgpu, payload, name, samplerKey)
{
    const resource = CreateAdapterResourceSlot();
    const pipeline = webgpu.CreateSamplerPreparePipeline({
        samplerKey,
        bundleLabel: `${name} resources`,
        mappingStageName: `engine-webgpu-${name}-map-selected-sampler`,
        publicationStageName: `engine-webgpu-${name}-publish`,
        adapterKey: "webgpu"
    });
    const mapped = pipeline.stages[0].prepare(payload, { resource });
    Assert(mapped !== payload, `${name} mapping did not produce a sampler-bundle payload`);
    const retained = await pipeline.stages[1].prepare(mapped, { resource });
    Assert(retained === undefined, `${name} publication replaced its retained mapped payload`);
    const bundle = resource.GetAdapterResource("webgpu");
    Assert(bundle, `${name} publication did not populate the WebGPU adapter slot`);
    return bundle;
}

async function CreatePhaseZeroDraw(webgpu)
{
    const bundle = await PublishPreparedResourceBundle(webgpu, {
        label: "engine-webgpu phase-0 resources",
        geometries: {
            main: {
                label: "engine-webgpu phase-0 geometry",
                vertexBuffers: [ {
                    slot: 0,
                    data: new Float32Array([
                        -1, -1, 0, 1,
                         3, -1, 1, 1,
                        -1,  3, 0, 0
                    ]),
                    layout: {
                        arrayStride: 16,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x2" },
                            { shaderLocation: 1, offset: 8, format: "float32x2" }
                        ]
                    }
                } ]
            }
        }
    }, "phase-0-resources");
    let textureBundle = null;
    let samplerBundle = null;
    try
    {
        textureBundle = await PublishPreparedRgba8Texture(webgpu, {
            payloadType: "rgba",
            sourceFormat: "generated",
            width: 1,
            height: 1,
            pixelFormat: "rgba8unorm",
            data: new Uint8Array(EXPECTED_PIXEL),
            strideBytes: 4,
            origin: "top-left",
            colorSpace: "linear",
            alphaMode: "opaque",
            containerOnly: false,
            isDecoded: true
        }, "phase-0-texture", "sampled-resource:0:0");
        samplerBundle = await PublishPreparedSampler(webgpu, {
            payloadType: "webgpu-sampler",
            label: "engine-webgpu phase-0 sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            lodMinClamp: 0,
            lodMaxClamp: 32,
            maxAnisotropy: 1
        }, "phase-0-sampler", "sampler:0:0");
        const geometry = bundle.geometries.main;
        const texture = textureBundle.textures["sampled-resource:0:0"];
        const sampler = samplerBundle.samplers["sampler:0:0"];
        const pipeline = {
            key: "phase0.pass0",
            shaderModules: [
                { key: "phase0.pass0.vertex", stageName: "vertex", entryPoint: "vertexMain", wgsl: SOURCE },
                { key: "phase0.pass0.pixel", stageName: "pixel", entryPoint: "fragmentMain", wgsl: SOURCE }
            ],
            bindGroups: [ {
                group: 0,
                bindings: [
                    { sourceTruth: "wgsl-layout", resourceKind: "sampled-resource", registerSpace: 0, registerIndex: 0, group: 0, binding: 0, visibility: [ "fragment" ], dynamic: false, layout: { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } } },
                    { sourceTruth: "wgsl-layout", resourceKind: "sampler", registerSpace: 0, registerIndex: 0, group: 0, binding: 1, visibility: [ "fragment" ], dynamic: false, layout: { sampler: { type: "filtering" } } }
                ]
            } ]
        };
        const prepared = await webgpu.PreparePipeline(pipeline, { warningsAsErrors: true });
        const livePipeline = await webgpu.CreateRenderPipeline(prepared, {
            label: "engine-webgpu phase-0 pipeline",
            vertex: { buffers: geometry.vertexBufferLayouts },
            fragment: { targets: [ { format: "rgba8unorm" } ] },
            primitive: { topology: "triangle-list" }
        });
        return {
            bundle,
            textureBundle,
            samplerBundle,
            geometry,
            texture,
            sampler,
            draw: webgpu.CreateDraw(livePipeline, {
                geometry,
                resources: new Map([
                    [ "sampled-resource:0:0", texture ],
                    [ "sampler:0:0", sampler ]
                ]),
                draw: { vertexCount: 3 }
            })
        };
    }
    catch (error)
    {
        samplerBundle?.Destroy();
        textureBundle?.Destroy();
        bundle.Destroy();
        throw error;
    }
}

async function LoadDrawDescriptor()
{
    if (CONFIG.drawCewgpu)
    {
        const response = await fetch("/draw-package.json");
        Assert(response.ok, `Failed to load ${CONFIG.packageLabel}: HTTP ${response.status}`);
        const pipeline = await response.json();
        return { pipeline, fixture: buildCopyblitDrawDescriptor(pipeline) };
    }
    if (!CONFIG.drawWgsl) return null;
    const [ vertex, fragment ] = await Promise.all([
        fetch("/vertex.wgsl").then((response) => response.text()),
        fetch("/fragment.wgsl").then((response) => response.text())
    ]);
    const pipeline = {
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
    };
    return { pipeline, fixture: buildCopyblitDrawDescriptor(pipeline) };
}

async function CreateGeneratedDraw(webgpu)
{
    const loaded = await LoadDrawDescriptor();
    if (!loaded) return null;
    const { pipeline, fixture } = loaded;
    const device = webgpu.GetDevice();
    const vertices = new Float32Array([
        -1, -1, 0, 1, 0, 0,
        3, -1, 0, 1, 1, 0,
        -1, 3, 0, 1, 0, 1
    ]);
    const bundle = await PublishPreparedResourceBundle(webgpu, {
        label: "generated copyblit resources",
        geometries: {
            main: {
                label: "generated copyblit geometry",
                vertexBuffers: [ {
                    slot: 0,
                    data: vertices,
                    layout: {
                        arrayStride: 24,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x4" },
                            { shaderLocation: 1, offset: 16, format: "float32x2" }
                        ]
                    }
                } ]
            }
        },
        textures: {
            "sampled-resource:0:0": {
                label: "generated copyblit t0",
                width: 1,
                height: 1,
                format: "rgba8unorm",
                bytesPerRow: 4,
                data: new Uint8Array([ 128, 128, 0, 255 ])
            }
        },
        samplers: {
            "sampler:0:0": {
                label: "generated copyblit s0",
                minFilter: "linear",
                magFilter: "linear",
                mipmapFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge"
            }
        }
    }, "copyblit-resources");
    const geometry = bundle.geometries.main;
    const sampledTexture = bundle.textures["sampled-resource:0:0"];
    const sampler = bundle.samplers["sampler:0:0"];
    let uniformBuffer = null;
    try
    {
        const prepared = await webgpu.PreparePipeline(pipeline, { warningsAsErrors: true });
        const livePipeline = await webgpu.CreateRenderPipeline(prepared, {
            label: "generated copyblit pipeline",
            vertex: {
                buffers: geometry.vertexBufferLayouts
            },
            fragment: {
                targets: [ {
                    format: "rgba8unorm",
                    ...(fixture.blend ? { blend: fixture.blend } : {})
                } ]
            },
            primitive: { topology: "triangle-list" }
        });
        const constants = new Float32Array([
            0, 0, 1, 1,
            0, 0, 1, 1,
            1, -1, 1, 1
        ]);
        uniformBuffer = device.createBuffer({
            label: "generated copyblit cb0",
            size: constants.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(uniformBuffer, 0, constants);
        const fixtureResources = new Map([
            [ "uniform-buffer:0:0", { buffer: uniformBuffer } ],
            [ "sampled-resource:0:0", sampledTexture ],
            [ "sampler:0:0", sampler ]
        ]);
        const draw = webgpu.CreateDraw(livePipeline, {
            resources: fixtureResources,
            geometry,
            draw: { vertexCount: 3 }
        });
        return {
            draw,
            bundle,
            geometry,
            uniformBuffer,
            sampledTexture,
            sampler,
            expectedPixel: [ 128, 128, 255, 255 ],
            result: {
                vertexLabel: CONFIG.vertexLabel,
                fragmentLabel: CONFIG.fragmentLabel,
                packageLabel: CONFIG.packageLabel,
                warningCount: prepared.diagnostics.filter((entry) => entry.type === "warning").length
            }
        };
    }
    catch (error)
    {
        uniformBuffer?.destroy();
        bundle.Destroy();
        throw error;
    }
}

async function CreateQuadV5GpuResources(webgpu)
{
    const values = createQuadV5FixtureValues(WIDTH, HEIGHT);
    const texturePayloads = Object.fromEntries(values.textures.map((entry) => [
        entry.identity,
        {
                label: `QuadV5 ${entry.identity}`,
                width: 1,
                height: 1,
                format: entry.format,
                bytesPerRow: 4,
                data: entry.bytes
            }
    ]));
    const bundle = await PublishPreparedResourceBundle(webgpu, {
        label: "QuadV5 resources",
        geometries: {
            main: {
                label: "QuadV5 indexed quad geometry",
                vertexBuffers: [ {
                    slot: 0,
                    data: values.vertices,
                    layout: QUADV5_VERTEX_BUFFER_LAYOUT
                } ],
                indexBuffer: {
                    data: values.indices,
                    format: "uint16"
                }
            }
        },
        textures: texturePayloads,
        samplers: {
            "sampler:0:0": {
                label: "QuadV5 s0",
                minFilter: "linear",
                magFilter: "linear",
                mipmapFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                addressModeW: "clamp-to-edge"
            }
        }
    }, "quadv5-resources");
    const resources = new Map(Object.entries(bundle.textures));
    resources.set("sampler:0:0", bundle.samplers["sampler:0:0"]);
    return {
        bindingValues: createQuadV5MainBindingValues(WIDTH, HEIGHT),
        resources,
        geometry: bundle.geometries.main,
        bundle,
        destroy()
        {
            bundle.Destroy();
        }
    };
}

function AssertTargetPixels(bytes, expected, label, tolerance = 1)
{
    for (let y = 0; y < HEIGHT; y += 1)
    {
        const row = y * BYTES_PER_ROW;
        for (let x = 0; x < WIDTH; x += 1)
        {
            const offset = row + x * BYTES_PER_PIXEL;
            for (let component = 0; component < BYTES_PER_PIXEL; component += 1)
            {
                const delta = Math.abs(bytes[offset + component] - expected[component]);
                Assert(
                    delta <= tolerance,
                    `${label} pixel mismatch at (${x}, ${y}) component ${component}: ` +
                    `expected ${expected[component]} +/- ${tolerance}, received ${bytes[offset + component]}`
                );
            }
        }
    }
}

function AssertExactTargetMatch(left, right, label)
{
    for (let y = 0; y < HEIGHT; y += 1)
    {
        const row = y * BYTES_PER_ROW;
        for (let x = 0; x < WIDTH * BYTES_PER_PIXEL; x += 1)
        {
            Assert(
                left[row + x] === right[row + x],
                `${label} differs at row ${y}, active byte ${x}: ${left[row + x]} versus ${right[row + x]}`
            );
        }
    }
}

function GetActiveTargetPixels(bytes)
{
    const pixels = [];
    for (let y = 0; y < HEIGHT; y += 1)
    {
        const row = y * BYTES_PER_ROW;
        pixels.push(...bytes.slice(row, row + WIDTH * BYTES_PER_PIXEL));
    }
    return pixels;
}

async function RunQuadV5Comparison(webgpu)
{
    if (!CONFIG.drawQuadV5) return null;
    const response = await fetch("/draw-quadv5.json");
    Assert(response.ok, `Failed to load QuadV5 package records: HTTP ${response.status}`);
    const records = await response.json();
    Assert(Array.isArray(records) && records.length === 2, "QuadV5 comparison requires two package records");
    validateQuadV5PackagePair(records);

    const device = webgpu.GetDevice();
    const fixture = await CreateQuadV5GpuResources(webgpu);
    const instances = [];
    let warningCount = 0;
    try
    {
        for (const record of records)
        {
            const behavior = RESOURCE_BEHAVIORS.get(record.resourceBehavior);
            Assert(behavior, `Unknown QuadV5 resource behavior ${record.resourceBehavior || "<missing>"}`);
            const uniformData = behavior.BuildUniformData(record, fixture.bindingValues);
            const prepared = await webgpu.PreparePipeline(record.pipeline, { warningsAsErrors: true });
            warningCount += prepared.diagnostics.filter((entry) => entry.type === "warning").length;
            const livePipeline = await webgpu.CreateRenderPipeline(prepared, {
                label: `QuadV5 ${record.label} Main.pass0`,
                vertex: { buffers: fixture.geometry.vertexBufferLayouts },
                fragment: {
                    targets: [ { format: "rgba8unorm" }, { format: "rgba8unorm" } ]
                },
                primitive: { topology: "triangle-list", cullMode: "none" }
            });
            let bindingSet = null;
            try
            {
                bindingSet = webgpu.CreateBindingSet(livePipeline, {
                    uniformData,
                    resources: fixture.resources
                });
                const draw = webgpu.CreateDraw(livePipeline, {
                    bindingSet,
                    geometry: fixture.geometry,
                    draw: { indexCount: 6 }
                });
                const targets = QUADV5_EXPECTED_TARGETS.map((_, targetIndex) => device.createTexture({
                    label: `QuadV5 ${record.label} MRT${targetIndex}`,
                    size: { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 },
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
                }));
                const readbacks = QUADV5_EXPECTED_TARGETS.map((_, targetIndex) => device.createBuffer({
                    label: `QuadV5 ${record.label} MRT${targetIndex} readback`,
                    size: BYTES_PER_ROW * HEIGHT,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                }));
                instances.push({ record, draw, bindingSet, targets, readbacks, snapshots: [] });
            }
            catch (error)
            {
                bindingSet?.Destroy();
                throw error;
            }
        }

        const encoder = device.createCommandEncoder({ label: "QuadV5 DX11/DX12 comparison encoder" });
        for (const instance of instances)
        {
            const pass = encoder.beginRenderPass({
                label: `QuadV5 ${instance.record.label} Main.pass0`,
                colorAttachments: instance.targets.map((texture, targetIndex) => ({
                    view: texture.createView(),
                    clearValue: targetIndex === 0
                        ? { r: 0, g: 1, b: 0, a: 1 }
                        : { r: 1, g: 0, b: 1, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }))
            });
            webgpu.EncodeDraw(pass, instance.draw);
            pass.end();
            instance.targets.forEach((texture, targetIndex) =>
            {
                encoder.copyTextureToBuffer(
                    { texture },
                    {
                        buffer: instance.readbacks[targetIndex],
                        bytesPerRow: BYTES_PER_ROW,
                        rowsPerImage: HEIGHT
                    },
                    { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 }
                );
            });
        }
        webgpu.Submit([ encoder.finish() ]);
        await device.queue.onSubmittedWorkDone();
        await Promise.all(instances.flatMap((instance) => instance.readbacks.map(
            (buffer) => buffer.mapAsync(GPUMapMode.READ)
        )));

        for (const instance of instances)
        {
            instance.snapshots = instance.readbacks.map((buffer) =>
                new Uint8Array(buffer.getMappedRange()).slice());
            instance.snapshots.forEach((bytes, targetIndex) =>
                AssertTargetPixels(
                    bytes,
                    QUADV5_EXPECTED_TARGETS[targetIndex],
                    `${instance.record.label} MRT${targetIndex}`
                ));
        }
        for (let targetIndex = 0; targetIndex < QUADV5_EXPECTED_TARGETS.length; targetIndex += 1)
        {
            AssertExactTargetMatch(
                instances[0].snapshots[targetIndex],
                instances[1].snapshots[targetIndex],
                `DX11/DX12 QuadV5 MRT${targetIndex}`
            );
        }
        return {
            bodyIndex: 4,
            labels: records.map((record) => `${record.backend}:${record.label}`),
            loadPath: records[0].loadPath,
            pixelCount: WIDTH * HEIGHT,
            targetCount: QUADV5_EXPECTED_TARGETS.length,
            drawKind: "indexed",
            indexCount: 6,
            warningCount,
            expectedTargets: QUADV5_EXPECTED_TARGETS,
            observedTargets: instances[0].snapshots.map((bytes) => Array.from(bytes.slice(0, 4))),
            targetWidth: WIDTH,
            targetHeight: HEIGHT,
            targetPixels: instances[0].snapshots.map(GetActiveTargetPixels)
        };
    }
    finally
    {
        for (const instance of instances)
        {
            instance.bindingSet.Destroy();
            for (const buffer of instance.readbacks)
            {
                if (buffer.mapState === "mapped") buffer.unmap();
                buffer.destroy();
            }
            instance.targets.forEach((texture) => texture.destroy());
        }
        fixture.destroy();
    }
}

async function PreparePackage(webgpu)
{
    if (!CONFIG.prepareCewgpu) return null;
    const response = await fetch("/prepare-package.json");
    Assert(response.ok, `Failed to load ${CONFIG.preparePackageLabel}: HTTP ${response.status}`);
    const pipeline = await response.json();
    const prepared = await webgpu.PreparePipeline(pipeline, { warningsAsErrors: true });
    return {
        label: CONFIG.preparePackageLabel,
        bindingCount: pipeline.bindGroups.reduce((count, group) => count + group.bindings.length, 0),
        warningCount: prepared.diagnostics.filter((entry) => entry.type === "warning").length
    };
}

async function PrepareMatrix(webgpu)
{
    if (!CONFIG.prepareMatrix) return null;
    const response = await fetch("/prepare-matrix.json");
    Assert(response.ok, `Failed to load ${CONFIG.prepareMatrixLabel}: HTTP ${response.status}`);
    const matrix = await response.json();
    let warningCount = 0;
    let bindingCount = 0;
    for (const record of matrix.shaderModules)
    {
        const module = webgpu.GetDevice().createShaderModule({
            label: `matrix ${record.id}`,
            code: record.code
        });
        const info = await module.getCompilationInfo();
        const messages = info.messages.filter((entry) => entry.type === "error" || entry.type === "warning");
        Assert(
            messages.length === 0,
            `Matrix WGSL ${record.id} produced diagnostics:\n${messages.map((entry) => entry.message).join("\n")}`
        );
    }
    for (const record of matrix.pipelines)
    {
        const prepared = await webgpu.PreparePipeline(record.pipeline, { warningsAsErrors: true });
        warningCount += prepared.diagnostics.filter((entry) => entry.type === "warning").length;
        bindingCount += record.pipeline.bindGroups.reduce(
            (count, group) => count + group.bindings.length,
            0
        );
    }
    return {
        label: CONFIG.prepareMatrixLabel,
        uniqueShaderModules: matrix.uniqueShaderModules,
        coveredShaderOccurrences: matrix.coveredShaderOccurrences,
        uniquePipelines: matrix.uniquePipelines,
        coveredOccurrences: matrix.coveredOccurrences,
        bindingCount,
        warningCount
    };
}

async function RunHarness()
{
    if (!navigator.gpu)
    {
        return { status: "skipped", reason: "navigator.gpu is unavailable" };
    }

    let webgpu;
    try
    {
        webgpu = await CjsWebGPUDevice.Request({
            gpu: navigator.gpu,
            adapterOptions: { powerPreference: "low-power" },
            shaderStage: GPUShaderStage
        });
    }
    catch (error)
    {
        if (/requestAdapter returned null/.test(error?.message || ""))
        {
            return { status: "skipped", reason: "navigator.gpu.requestAdapter() returned null" };
        }
        throw error;
    }

    const adapter = webgpu.GetAdapter();
    const device = webgpu.GetDevice();
    let texture = null;
    let readback = null;
    let generatedDraw = null;
    let phaseZeroDraw = null;
    let quadV5Comparison = null;
    let errorScopeOpen = true;

    device.pushErrorScope("validation");
    try
    {
        const compiledCandidate = await CompileCandidate(device);
        const preparedPackage = await PreparePackage(webgpu);
        const preparedMatrix = await PrepareMatrix(webgpu);
        generatedDraw = await CreateGeneratedDraw(webgpu);
        phaseZeroDraw = generatedDraw ? null : await CreatePhaseZeroDraw(webgpu);
        quadV5Comparison = await RunQuadV5Comparison(webgpu);
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
        if (generatedDraw)
        {
            webgpu.EncodeDraw(pass, generatedDraw.draw);
        }
        else
        {
            webgpu.EncodeDraw(pass, phaseZeroDraw.draw);
        }
        pass.end();

        encoder.copyTextureToBuffer(
            { texture },
            { buffer: readback, bytesPerRow: BYTES_PER_ROW, rowsPerImage: HEIGHT },
            { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 }
        );
        webgpu.Submit([ encoder.finish() ]);
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
            preparedPackage,
            preparedMatrix,
            generatedDraw: generatedDraw?.result || null,
            geometryAdapter: "device-owned",
            textureAdapter: "device-owned uncompressed 2D",
            samplerAdapter: "device-owned",
            resourcePublication: "atomic prepare-stage adapter-slot",
            rgba8TexturePreparation: phaseZeroDraw
                ? "canonical decoded RGBA8 -> texture bundle -> atomic adapter slot"
                : null,
            samplerPreparation: phaseZeroDraw
                ? "complete selected WebGPU state -> sampler bundle -> atomic adapter slot"
                : null,
            quadV5Comparison
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
        generatedDraw?.uniformBuffer.destroy();
        generatedDraw?.bundle.Destroy();
        phaseZeroDraw?.samplerBundle.Destroy();
        phaseZeroDraw?.textureBundle.Destroy();
        phaseZeroDraw?.bundle.Destroy();
        webgpu.Destroy();
    }
}

globalThis.webgpuHarnessResult = RunHarness().catch((error) => ({
    status: "failed",
    error: error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error)
}));

const result = await globalThis.webgpuHarnessResult;
document.querySelector("#result").textContent = JSON.stringify(result, null, 2);
