import { buildCopyblitDrawDescriptor } from "/packageDraw.js";
import { createHarnessComputePipeline } from "/computePipeline.js";
import {
    DECALV5_CLEAR_TARGET,
    DECALV5_TARGET_HEIGHT,
    DECALV5_TARGET_WIDTH,
    DECALV5_VERTEX_BUFFER_LAYOUT,
    createDecalV5FixtureValues,
    getDecalV5ResourcePlan,
    validateDecalV5PackagePair
} from "/decalV5Fixture.js";
import {
    QUADV5_CLEAR_TARGETS,
    QUADV5_TARGET_HEIGHT,
    QUADV5_TARGET_WIDTH,
    QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT,
    QUADV5_VERTEX_BUFFER_LAYOUT,
    createQuadV5FixtureValues,
    createQuadV5MainBindingValues,
    getQuadV5ResourcePlan,
    validateQuadV5PackagePair
} from "/quadV5Fixture.js";
import { CjsWebGPUDevice } from "/CjsWebGPUDevice.js";
import { buildEveSpaceObjectMainUniformData } from "/spaceObjectMainBindings.js";
import { CjsWebGPUTrinityBatchDispatcher } from "/trinityBatchDispatcher.js";
import { CjsWebGPUTrinityPassEncoder } from "/trinityPassEncoder.js";

const WIDTH = QUADV5_TARGET_WIDTH;
const HEIGHT = QUADV5_TARGET_HEIGHT;
const BYTES_PER_PIXEL = 4;
const BYTES_PER_ROW = 256;
const TRINITY_BATCH_TYPE_OPAQUE = 0;
const TRINITY_BATCH_TYPE_DECAL = 1;
const EXPECTED_PIXEL = Object.freeze([ 255, 0, 0, 255 ]);
const CONFIG = await fetch("/config.json").then((response) => response.json());
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

function ScopeFixtureBindingValues(pipeline, values, label)
{
    Assert(values instanceof Map, `${label} must be a Map`);
    const expected = new Map();
    const scopeCounts = new Map();
    for (const group of Array.isArray(pipeline?.bindGroups) ? pipeline.bindGroups : [])
    {
        for (const binding of Array.isArray(group?.bindings) ? group.bindings : [])
        {
            const identity = typeof binding.identity === "string" && binding.identity
                ? binding.identity
                : `${binding.resourceKind}:${binding.registerSpace}:${binding.registerIndex}`;
            const scopeIdentity = typeof binding.scopeIdentity === "string" && binding.scopeIdentity
                ? binding.scopeIdentity
                : identity;
            Assert(!expected.has(scopeIdentity), `${label} duplicates pipeline scope ${scopeIdentity}`);
            expected.set(scopeIdentity, identity);
            scopeCounts.set(identity, (scopeCounts.get(identity) || 0) + 1);
        }
    }

    const result = new Map();
    const consumed = new Set();
    for (const [ scopeIdentity, identity ] of expected)
    {
        let sourceIdentity = null;
        if (values.has(scopeIdentity))
        {
            sourceIdentity = scopeIdentity;
        }
        else if (values.has(identity))
        {
            Assert(
                scopeCounts.get(identity) === 1,
                `${label} base identity ${identity} is ambiguous across stage-scoped bindings`
            );
            sourceIdentity = identity;
        }
        if (sourceIdentity === null)
        {
            continue;
        }
        Assert(
            !consumed.has(sourceIdentity),
            `${label} base identity ${sourceIdentity} is ambiguous across stage-scoped bindings`
        );
        consumed.add(sourceIdentity);
        result.set(scopeIdentity, values.get(sourceIdentity));
    }
    for (const identity of values.keys())
    {
        Assert(consumed.has(identity), `${label} has unexpected identity ${identity}`);
    }
    return result;
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

function CreateAdapterResourceSlot(payload = null)
{
    const adapterResources = new Map();
    return {
        state: "loaded",
        IsCurrent()
        {
            return true;
        },
        GetPayload()
        {
            return payload;
        },
        MarkLoaded()
        {
            this.state = "loaded";
            return this;
        },
        MarkPreparing()
        {
            this.state = "preparing";
            return this;
        },
        MarkPrepared()
        {
            this.state = "prepared";
            return this;
        },
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
    const resource = CreateAdapterResourceSlot(payload);
    const bundle = await webgpu.RealizeResource(resource, payload);
    Assert(bundle, `${name} publication did not populate the WebGPU adapter slot`);
    return bundle;
}

async function PublishPreparedRgba8Texture(webgpu, payload, name, textureKey)
{
    const resource = CreateAdapterResourceSlot(payload);
    const bundle = await webgpu.RealizeRgba8Texture(resource, {
        textureKey,
        bundleLabel: `${name} resources`,
        adapterKey: "webgpu"
    });
    Assert(bundle, `${name} publication did not populate the WebGPU adapter slot`);
    return bundle;
}

async function PublishPreparedSampler(webgpu, payload, name, samplerKey)
{
    const resource = CreateAdapterResourceSlot(payload);
    const bundle = await webgpu.RealizeSampler(resource, {
        samplerKey,
        bundleLabel: `${name} resources`,
        adapterKey: "webgpu"
    });
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
        const fixtureResources = ScopeFixtureBindingValues(pipeline, new Map([
            [ "uniform-buffer:0:0", { buffer: uniformBuffer } ],
            [ "sampled-resource:0:0", sampledTexture ],
            [ "sampler:0:0", sampler ]
        ]), "generated copyblit resources");
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

async function CreateQuadV5GpuResources(webgpu, records)
{
    const values = createQuadV5FixtureValues(WIDTH, HEIGHT);
    const skinned = records[0]?.variant === "skinned";
    const geometrySource = Object.freeze({
        kind: "synthetic-quadv5",
        variant: skinned ? "skinned" : "static"
    });
    const texturePayloads = Object.fromEntries(values.textures
        .filter((entry) => entry.dimension === "2d")
        .map((entry) => [
        entry.name,
        {
                label: `QuadV5 ${entry.name}`,
                width: entry.width,
                height: entry.height,
                format: entry.format,
                bytesPerRow: entry.bytesPerRow,
                data: entry.data
            }
        ]));
    const samplers = Object.fromEntries(values.samplerNames.map((name) => [
        name,
        {
            label: `QuadV5 ${name}`,
            minFilter: "linear",
            magFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
            addressModeW: "clamp-to-edge",
            maxAnisotropy: name === "Sampler0" ? 16 : 1
        }
    ]));
    const device = webgpu.GetDevice();
    const bundle = await PublishPreparedResourceBundle(webgpu, {
        label: "QuadV5 resources",
        geometries: {
            main: {
                label: "QuadV5 harness-authored silhouette geometry",
                vertexBuffers: [
                    {
                        slot: 0,
                        data: values.vertices,
                        layout: QUADV5_VERTEX_BUFFER_LAYOUT
                    },
                    ...(skinned ? [ {
                        slot: 1,
                        data: values.boneIndices,
                        layout: QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT
                    } ] : [])
                ],
                indexBuffer: {
                    data: values.indices,
                    format: "uint16"
                }
            }
        },
        textures: texturePayloads,
        samplers
    }, "quadv5-resources");
    const cubeDefinition = values.textures.find((entry) => entry.dimension === "cube");
    let cubeTexture = null;
    let boneBuffer = null;
    try
    {
        Assert(cubeDefinition, "QuadV5 fixture requires an environment cube");
        cubeTexture = device.createTexture({
            label: "QuadV5 EveSpaceSceneEnvMap",
            size: {
                width: cubeDefinition.width,
                height: cubeDefinition.height,
                depthOrArrayLayers: cubeDefinition.depthOrArrayLayers
            },
            mipLevelCount: 1,
            sampleCount: 1,
            dimension: "2d",
            format: cubeDefinition.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        for (let face = 0; face < cubeDefinition.depthOrArrayLayers; face += 1)
        {
            device.queue.writeTexture(
                { texture: cubeTexture, origin: { x: 0, y: 0, z: face } },
                cubeDefinition.data.slice(face * 4, face * 4 + 4),
                { offset: 0, bytesPerRow: 4, rowsPerImage: 1 },
                { width: 1, height: 1, depthOrArrayLayers: 1 }
            );
        }
        const cubeView = cubeTexture.createView({
            label: "QuadV5 EveSpaceSceneEnvMap cube view",
            dimension: "cube"
        });
        if (skinned)
        {
            const boneTransform = new Float32Array([
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
                0.8660253882408142, 0, -0.5, 0.125,
                0, 1, 0, 0,
                0.5, 0, 0.8660253882408142, 0
            ]);
            boneBuffer = device.createBuffer({
                label: "QuadV5 indexed non-identity BoneTransforms",
                size: boneTransform.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            device.queue.writeBuffer(boneBuffer, 0, boneTransform);
        }
        const resourcesByBackend = new Map();
        for (const record of records)
        {
            const plan = getQuadV5ResourcePlan(record);
            const resources = new Map();
            for (const storage of plan.storage)
            {
                Assert(boneBuffer, `QuadV5 fixture is missing storage ${storage.name}`);
                resources.set(storage.scopeIdentity, {
                    buffer: boneBuffer,
                    offset: 0,
                    size: boneBuffer.size
                });
            }
            for (const texture of plan.textures)
            {
                const resource = texture.name === "EveSpaceSceneEnvMap"
                    ? cubeView
                    : bundle.textures[texture.name];
                Assert(resource, `QuadV5 fixture is missing texture ${texture.name}`);
                resources.set(texture.scopeIdentity, resource);
            }
            for (const sampler of plan.samplers)
            {
                const resource = bundle.samplers[sampler.name];
                Assert(resource, `QuadV5 fixture is missing sampler ${sampler.name}`);
                resources.set(sampler.scopeIdentity, resource);
            }
            resourcesByBackend.set(record.backend, resources);
        }
        return {
            bindingValues: createQuadV5MainBindingValues(WIDTH, HEIGHT),
            resourcesByBackend,
            geometry: bundle.geometries.main,
            geometrySource,
            bundle,
            destroy()
            {
                boneBuffer?.destroy();
                cubeTexture.destroy();
                bundle.Destroy();
            }
        };
    }
    catch (error)
    {
        boneBuffer?.destroy();
        cubeTexture?.destroy();
        bundle.Destroy();
        throw error;
    }
}

async function CreateDecalV5GpuResources(webgpu, records)
{
    Assert(
        DECALV5_TARGET_WIDTH === WIDTH && DECALV5_TARGET_HEIGHT === HEIGHT,
        "DecalV5 and harness target dimensions must match"
    );
    const values = createDecalV5FixtureValues(WIDTH, HEIGHT);
    const geometrySource = Object.freeze({ kind: "synthetic-decalv5" });
    const texturePayloads = Object.fromEntries(values.textures
        .filter((entry) => entry.dimension === "2d")
        .map((entry) => [
            entry.name,
            {
                label: `DecalV5 ${entry.name}`,
                width: entry.width,
                height: entry.height,
                format: entry.format,
                bytesPerRow: entry.bytesPerRow,
                data: entry.data
            }
        ]));
    const samplers = Object.fromEntries(values.samplerNames.map((name) => [
        name,
        {
            label: `DecalV5 ${name}`,
            minFilter: "linear",
            magFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: name === "Sampler0" ? "repeat" : "clamp-to-edge",
            addressModeV: name === "Sampler0" ? "repeat" : "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            maxAnisotropy: 16
        }
    ]));
    const device = webgpu.GetDevice();
    const bundle = await PublishPreparedResourceBundle(webgpu, {
        label: "DecalV5 resources",
        geometries: {
            main: {
                label: "DecalV5 harness-authored silhouette geometry",
                vertexBuffers: [ {
                    slot: 0,
                    data: values.vertices,
                    layout: DECALV5_VERTEX_BUFFER_LAYOUT
                } ],
                indexBuffer: {
                    data: values.indices,
                    format: "uint16"
                }
            }
        },
        textures: texturePayloads,
        samplers
    }, "decalv5-resources");
    const cubeDefinition = values.textures.find((entry) => entry.dimension === "cube");
    let cubeTexture = null;
    try
    {
        Assert(cubeDefinition, "DecalV5 fixture requires an environment cube");
        cubeTexture = device.createTexture({
            label: "DecalV5 EveSpaceSceneEnvMap",
            size: {
                width: cubeDefinition.width,
                height: cubeDefinition.height,
                depthOrArrayLayers: cubeDefinition.depthOrArrayLayers
            },
            mipLevelCount: 1,
            sampleCount: 1,
            dimension: "2d",
            format: cubeDefinition.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        for (let face = 0; face < cubeDefinition.depthOrArrayLayers; face += 1)
        {
            device.queue.writeTexture(
                { texture: cubeTexture, origin: { x: 0, y: 0, z: face } },
                cubeDefinition.data.slice(face * 4, face * 4 + 4),
                { offset: 0, bytesPerRow: 4, rowsPerImage: 1 },
                { width: 1, height: 1, depthOrArrayLayers: 1 }
            );
        }
        const cubeView = cubeTexture.createView({
            label: "DecalV5 EveSpaceSceneEnvMap cube view",
            dimension: "cube"
        });
        const resourcesByBackend = new Map();
        for (const record of records)
        {
            const plan = getDecalV5ResourcePlan(record);
            const resources = new Map();
            for (const texture of plan.textures)
            {
                const resource = texture.name === "EveSpaceSceneEnvMap"
                    ? cubeView
                    : bundle.textures[texture.name];
                Assert(resource, `DecalV5 fixture is missing texture ${texture.name}`);
                resources.set(texture.scopeIdentity, resource);
            }
            for (const sampler of plan.samplers)
            {
                const resource = bundle.samplers[sampler.name];
                Assert(resource, `DecalV5 fixture is missing sampler ${sampler.name}`);
                resources.set(sampler.scopeIdentity, resource);
            }
            resourcesByBackend.set(record.backend, resources);
        }
        return {
            uniformData: values.uniformData,
            resourcesByBackend,
            geometry: bundle.geometries.main,
            geometrySource,
            bundle,
            destroy()
            {
                cubeTexture.destroy();
                bundle.Destroy();
            }
        };
    }
    catch (error)
    {
        cubeTexture?.destroy();
        bundle.Destroy();
        throw error;
    }
}

function CreateQuadV5TrinityBatch(record, fixture)
{
    return Object.freeze({
        material: record,
        shader: record.pipeline,
        geometrySource: Object.freeze({
            geometry: fixture.geometrySource,
            meshIndex: 0,
            areaIndex: 0,
            count: 1,
            reversed: false
        }),
        objectData: fixture.bindingValues,
        topology: 4,
        indexCountPerInstance: 0,
        instanceCount: 0,
        startIndexLocation: 0,
        baseVertexLocation: 0,
        startInstanceLocation: 0,
        renderingMode: 0,
        pickingData: 0,
        groupCount: 1
    });
}

function CreateQuadV5TrinityAccumulator(record, fixture)
{
    const batches = Object.freeze([ CreateQuadV5TrinityBatch(record, fixture) ]);
    const gdprBatches = Object.freeze([]);
    return Object.freeze({
        GetGdprBatches: () => gdprBatches,
        GetBatches: () => batches,
        GetBatchCount: () => batches.length,
        IsChainedByEffect: () => true
    });
}

function CreateQuadV5TrinityBatchMap(record, fixture)
{
    const accumulator = CreateQuadV5TrinityAccumulator(record, fixture);
    const batchTypes = Object.freeze([ TRINITY_BATCH_TYPE_OPAQUE ]);
    return Object.freeze({
        GetBatchTypes: () => batchTypes,
        GetAccumulator: (value) => value === TRINITY_BATCH_TYPE_OPAQUE ? accumulator : null,
        GetBatchCount: () => accumulator.GetBatchCount()
    });
}

function CreateQuadV5TrinityDispatcher(webgpu, fixture)
{
    return new CjsWebGPUTrinityBatchDispatcher(webgpu, {
        ResolveMaterial(record, _batch, context)
        {
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_OPAQUE,
                "QuadV5 material resolved outside the opaque batch type"
            );
            return {
                pipeline: record.pipeline,
                prepareOptions: { warningsAsErrors: true },
                recipe: {
                    label: `QuadV5 ${record.label} Main.pass0`,
                    vertex: { buffers: fixture.geometry.vertexBufferLayouts },
                    fragment: {
                        targets: [ { format: "rgba8unorm" }, { format: "rgba8unorm" } ]
                    },
                    primitive: { cullMode: "none" }
                }
            };
        },
        ResolveGeometry(source, _batch, context)
        {
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_OPAQUE
                    &&
                source?.geometry === fixture.geometrySource
                    && source.meshIndex === 0
                    && source.areaIndex === 0
                    && source.count === 1
                    && source.reversed === false,
                "QuadV5 batch references an unknown geometry source"
            );
            return {
                geometry: fixture.geometry,
                indexed: true,
                draw: {
                    indexCount: fixture.geometry.indexCount,
                    instanceCount: 1,
                    firstIndex: 0,
                    baseVertex: 0,
                    firstInstance: 0
                }
            };
        },
        ResolveBindings(batch, _livePipeline, context)
        {
            const record = batch.material;
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_OPAQUE
                    && batch.objectData === fixture.bindingValues,
                `QuadV5 ${record.label} batch references unknown object data`
            );
            return {
                uniformData: ScopeFixtureBindingValues(
                    record.pipeline,
                    new Map(Object.entries(buildEveSpaceObjectMainUniformData(record, batch.objectData))),
                    `QuadV5 ${record.label} uniform data`
                ),
                resources: ScopeFixtureBindingValues(
                    record.pipeline,
                    fixture.resourcesByBackend.get(record.backend),
                    `QuadV5 ${record.label} resources`
                )
            };
        }
    });
}

function CreateDecalV5TrinityBatch(record, fixture)
{
    return Object.freeze({
        material: record,
        shader: record.pipeline,
        geometrySource: Object.freeze({
            geometry: fixture.geometrySource,
            meshIndex: 0,
            areaIndex: 0,
            count: 1,
            reversed: false
        }),
        objectData: fixture.uniformData,
        topology: 4,
        indexCountPerInstance: 0,
        instanceCount: 0,
        startIndexLocation: 0,
        baseVertexLocation: 0,
        startInstanceLocation: 0,
        renderingMode: 0,
        pickingData: 0,
        groupCount: 1
    });
}

function CreateDecalV5TrinityBatchMap(record, fixture)
{
    const batches = Object.freeze([ CreateDecalV5TrinityBatch(record, fixture) ]);
    const gdprBatches = Object.freeze([]);
    const accumulator = Object.freeze({
        GetGdprBatches: () => gdprBatches,
        GetBatches: () => batches,
        GetBatchCount: () => batches.length,
        IsChainedByEffect: () => true
    });
    const batchTypes = Object.freeze([ TRINITY_BATCH_TYPE_DECAL ]);
    return Object.freeze({
        GetBatchTypes: () => batchTypes,
        GetAccumulator: (value) => value === TRINITY_BATCH_TYPE_DECAL ? accumulator : null,
        GetBatchCount: () => accumulator.GetBatchCount()
    });
}

function CreateDecalV5TrinityDispatcher(webgpu, fixture)
{
    return new CjsWebGPUTrinityBatchDispatcher(webgpu, {
        ResolveMaterial(record, _batch, context)
        {
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_DECAL,
                "DecalV5 material resolved outside the decal batch type"
            );
            return {
                pipeline: record.pipeline,
                prepareOptions: { warningsAsErrors: true },
                recipe: {
                    label: `DecalV5 ${record.label} Main.pass0`,
                    vertex: { buffers: fixture.geometry.vertexBufferLayouts },
                    fragment: { targets: [ { format: "rgba8unorm" } ] },
                    primitive: { cullMode: "none" }
                }
            };
        },
        ResolveGeometry(source, _batch, context)
        {
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_DECAL
                    && source?.geometry === fixture.geometrySource
                    && source.meshIndex === 0
                    && source.areaIndex === 0
                    && source.count === 1
                    && source.reversed === false,
                "DecalV5 batch references an unknown geometry source"
            );
            return {
                geometry: fixture.geometry,
                indexed: true,
                draw: {
                    indexCount: fixture.geometry.indexCount,
                    instanceCount: 1,
                    firstIndex: 0,
                    baseVertex: 0,
                    firstInstance: 0
                }
            };
        },
        ResolveBindings(batch, _livePipeline, context)
        {
            const record = batch.material;
            Assert(
                context?.batchType === TRINITY_BATCH_TYPE_DECAL
                    && batch.objectData === fixture.uniformData,
                `DecalV5 ${record.label} batch references unknown object data`
            );
            return {
                uniformData: ScopeFixtureBindingValues(
                    record.pipeline,
                    new Map(Object.entries(fixture.uniformData)),
                    `DecalV5 ${record.label} uniform data`
                ),
                resources: ScopeFixtureBindingValues(
                    record.pipeline,
                    fixture.resourcesByBackend.get(record.backend),
                    `DecalV5 ${record.label} resources`
                )
            };
        }
    });
}

function PixelOffset(x, y)
{
    return y * BYTES_PER_ROW + x * BYTES_PER_PIXEL;
}

function PixelEquals(bytes, x, y, expected)
{
    const offset = PixelOffset(x, y);
    return expected.every((value, component) => bytes[offset + component] === value);
}

function PixelNeighborhoodHasDraw(bytes, x, y, clear, radius)
{
    for (let dy = -radius; dy <= radius; dy += 1)
    {
        for (let dx = -radius; dx <= radius; dx += 1)
        {
            const sampleX = x + dx;
            const sampleY = y + dy;
            if (sampleX >= 0 && sampleX < WIDTH && sampleY >= 0 && sampleY < HEIGHT
                && !PixelEquals(bytes, sampleX, sampleY, clear))
            {
                return true;
            }
        }
    }
    return false;
}

function AssertQuadV5Silhouette(bytes, targetIndex, label, variant)
{
    const clear = QUADV5_CLEAR_TARGETS[targetIndex];
    for (const [ x, y ] of [ [ 0, 0 ], [ WIDTH - 1, 0 ], [ 0, HEIGHT - 1 ], [ WIDTH - 1, HEIGHT - 1 ] ])
    {
        Assert(PixelEquals(bytes, x, y, clear), `${label} corner (${x}, ${y}) did not remain clear`);
    }
    const anchors = variant === "skinned"
        ? [
            [ "nose", 36, 10 ],
            [ "center", 35, 32 ]
        ]
        : [
            [ "nose", 32, 10 ],
            [ "center", 32, 32 ],
            [ "left wing", 13, 31 ],
            [ "right wing", 50, 31 ],
            [ "left tail", 24, 52 ],
            [ "right tail", 40, 52 ]
        ];
    for (const [ name, x, y ] of anchors)
    {
        const radius = variant === "skinned" ? 3 : 0;
        Assert(
            PixelNeighborhoodHasDraw(bytes, x, y, clear, radius),
            `${label} ${name} anchor neighborhood (${x}, ${y}) remained clear`
        );
    }
    let coverage = 0;
    let minimumX = WIDTH;
    let maximumX = -1;
    let minimumY = HEIGHT;
    let maximumY = -1;
    const rowCoverage = new Uint16Array(HEIGHT);
    const colors = new Set();
    for (let y = 0; y < HEIGHT; y += 1)
    {
        for (let x = 0; x < WIDTH; x += 1)
        {
            if (!PixelEquals(bytes, x, y, clear))
            {
                coverage += 1;
                minimumX = Math.min(minimumX, x);
                maximumX = Math.max(maximumX, x);
                minimumY = Math.min(minimumY, y);
                maximumY = Math.max(maximumY, y);
                rowCoverage[y] += 1;
                const offset = PixelOffset(x, y);
                colors.add(`${bytes[offset]},${bytes[offset + 1]},${bytes[offset + 2]},${bytes[offset + 3]}`);
            }
        }
    }
    const minimumCoverage = variant === "skinned" ? 500 : 700;
    Assert(coverage >= minimumCoverage && coverage <= 2000, `${label} has implausible ship coverage ${coverage}`);
    if (variant === "skinned")
    {
        Assert(
            minimumX >= 25 && maximumX >= 54,
            `${label} did not retain the indexed bone-transform bounds ${minimumX}..${maximumX}`
        );
    }
    else
    {
        Assert(
            minimumX <= 20 && maximumX >= 48,
            `${label} has implausible static bounds ${minimumX}..${maximumX}`
        );
    }
    Assert(
        rowCoverage[10] >= 2 && rowCoverage[10] <= 16,
        `${label} has an implausible nose width ${rowCoverage[10]}`
    );
    const minimumWingWidth = variant === "skinned" ? 20 : 34;
    Assert(
        rowCoverage[31] >= minimumWingWidth,
        `${label} has an implausible wing width ${rowCoverage[31]}`
    );
    const minimumTailWidth = variant === "skinned" ? 4 : 10;
    Assert(
        rowCoverage[52] >= minimumTailWidth && rowCoverage[52] <= 28,
        `${label} has an implausible tail width ${rowCoverage[52]}`
    );
    Assert(rowCoverage[31] >= rowCoverage[10] + 20, `${label} does not widen from nose to wings`);
    Assert(rowCoverage[31] >= rowCoverage[52] + 8, `${label} does not narrow from wings to tail`);
    if (targetIndex === 0)
    {
        Assert(colors.size >= 8, `${label} must contain varied shaded color rather than a constant fill`);
    }
    return {
        coverage,
        bounds: { minimumX, maximumX, minimumY, maximumY },
        rowCoverage: Array.from(rowCoverage),
        distinctColors: colors.size
    };
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

function AssertDecalV5Silhouette(bytes, label)
{
    for (const [ x, y ] of [ [ 0, 0 ], [ WIDTH - 1, 0 ], [ 0, HEIGHT - 1 ], [ WIDTH - 1, HEIGHT - 1 ] ])
    {
        Assert(
            PixelEquals(bytes, x, y, DECALV5_CLEAR_TARGET),
            `${label} corner (${x}, ${y}) did not remain clear`
        );
    }
    for (const [ name, x, y ] of [
        [ "nose", 32, 10 ],
        [ "center", 32, 32 ],
        [ "left wing", 13, 31 ],
        [ "right wing", 50, 31 ],
        [ "left tail", 24, 52 ],
        [ "right tail", 40, 52 ]
    ])
    {
        Assert(
            PixelNeighborhoodHasDraw(bytes, x, y, DECALV5_CLEAR_TARGET, 1),
            `${label} ${name} anchor neighborhood (${x}, ${y}) remained clear`
        );
    }
    let coverage = 0;
    let minimumX = WIDTH;
    let maximumX = -1;
    let minimumY = HEIGHT;
    let maximumY = -1;
    const colors = new Set();
    for (let y = 0; y < HEIGHT; y += 1)
    {
        for (let x = 0; x < WIDTH; x += 1)
        {
            if (!PixelEquals(bytes, x, y, DECALV5_CLEAR_TARGET))
            {
                coverage += 1;
                minimumX = Math.min(minimumX, x);
                maximumX = Math.max(maximumX, x);
                minimumY = Math.min(minimumY, y);
                maximumY = Math.max(maximumY, y);
                const offset = PixelOffset(x, y);
                colors.add(`${bytes[offset]},${bytes[offset + 1]},${bytes[offset + 2]},${bytes[offset + 3]}`);
            }
        }
    }
    Assert(coverage >= 700 && coverage <= 2000, `${label} has implausible decal coverage ${coverage}`);
    Assert(
        minimumX <= 20 && maximumX >= 48 && minimumY <= 12 && maximumY >= 50,
        `${label} has implausible decal bounds ${minimumX}..${maximumX}, ${minimumY}..${maximumY}`
    );
    Assert(colors.size >= 8, `${label} must contain varied decal shading rather than a constant fill`);
    return {
        coverage,
        bounds: { minimumX, maximumX, minimumY, maximumY },
        distinctColors: colors.size
    };
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
    const fixture = await CreateQuadV5GpuResources(webgpu, records);
    const dispatcher = CreateQuadV5TrinityDispatcher(webgpu, fixture);
    const passEncoder = new CjsWebGPUTrinityPassEncoder(dispatcher);
    const instances = [];
    let warningCount = 0;
    try
    {
        for (const record of records)
        {
            let preparedBatchMap = null;
            const targets = [];
            const readbacks = [];
            try
            {
                preparedBatchMap = await dispatcher.PrepareBatchMap(
                    CreateQuadV5TrinityBatchMap(record, fixture)
                );
                warningCount += preparedBatchMap.entries.reduce(
                    (mapTotal, entry) => mapTotal + entry.accumulator.batches.reduce(
                        (batchTotal, batch) => batchTotal
                            + batch.prepared.diagnostics.filter((item) => item.type === "warning").length,
                        0
                    ),
                    0
                );
                for (let targetIndex = 0; targetIndex < QUADV5_CLEAR_TARGETS.length; targetIndex += 1)
                {
                    targets.push(device.createTexture({
                        label: `QuadV5 ${record.label} MRT${targetIndex}`,
                        size: { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 },
                        format: "rgba8unorm",
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
                    }));
                }
                for (let targetIndex = 0; targetIndex < QUADV5_CLEAR_TARGETS.length; targetIndex += 1)
                {
                    readbacks.push(device.createBuffer({
                        label: `QuadV5 ${record.label} MRT${targetIndex} readback`,
                        size: BYTES_PER_ROW * HEIGHT,
                        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                    }));
                }
                instances.push({ record, preparedBatchMap, targets, readbacks, snapshots: [] });
            }
            catch (error)
            {
                if (preparedBatchMap) dispatcher.DestroyBatchMap(preparedBatchMap);
                for (const buffer of readbacks)
                {
                    buffer.destroy();
                }
                for (const texture of targets)
                {
                    texture.destroy();
                }
                throw error;
            }
        }

        const encoder = device.createCommandEncoder({ label: "QuadV5 DX11/DX12 comparison encoder" });
        for (const instance of instances)
        {
            passEncoder.Encode(encoder, [ {
                descriptor: {
                    label: `QuadV5 ${instance.record.label} Main.pass0`,
                    colorAttachments: instance.targets.map((texture, targetIndex) => ({
                        view: texture.createView(),
                        clearValue: {
                            r: QUADV5_CLEAR_TARGETS[targetIndex][0] / 255,
                            g: QUADV5_CLEAR_TARGETS[targetIndex][1] / 255,
                            b: QUADV5_CLEAR_TARGETS[targetIndex][2] / 255,
                            a: QUADV5_CLEAR_TARGETS[targetIndex][3] / 255
                        },
                        loadOp: "clear",
                        storeOp: "store"
                    }))
                },
                selections: [ {
                    preparedBatchMap: instance.preparedBatchMap,
                    batchType: TRINITY_BATCH_TYPE_OPAQUE
                } ]
            } ]);
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
            instance.statistics = instance.snapshots.map((bytes, targetIndex) =>
                AssertQuadV5Silhouette(
                    bytes,
                    targetIndex,
                    `${instance.record.label} MRT${targetIndex}`,
                    instance.record.variant
                ));
            Assert(
                instance.statistics[0].coverage === instance.statistics[1].coverage,
                `${instance.record.label} MRT coverage does not match`
            );
        }
        for (let targetIndex = 0; targetIndex < QUADV5_CLEAR_TARGETS.length; targetIndex += 1)
        {
            AssertExactTargetMatch(
                instances[0].snapshots[targetIndex],
                instances[1].snapshots[targetIndex],
                `DX11/DX12 QuadV5 MRT${targetIndex}`
            );
        }
        return {
            bodyIndex: 4,
            variant: records[0].variant ?? "static",
            labels: records.map((record) => `${record.backend}:${record.label}`),
            loadPath: records[0].loadPath,
            pixelCount: WIDTH * HEIGHT,
            targetCount: QUADV5_CLEAR_TARGETS.length,
            drawKind: records[0].variant === "skinned"
                ? "indexed skinned synthetic silhouette"
                : "indexed synthetic silhouette",
            indexCount: fixture.geometry.indexCount,
            warningCount,
            clearTargets: QUADV5_CLEAR_TARGETS,
            topLeftClearPixels: instances[0].snapshots.map((bytes) => Array.from(bytes.slice(0, 4))),
            statistics: instances[0].statistics,
            targetWidth: WIDTH,
            targetHeight: HEIGHT,
            targetPixels: instances[0].snapshots.map(GetActiveTargetPixels)
        };
    }
    finally
    {
        for (const instance of instances)
        {
            dispatcher.DestroyBatchMap(instance.preparedBatchMap);
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

async function RunDecalV5Comparison(webgpu)
{
    if (!CONFIG.drawDecalV5) return null;
    const response = await fetch("/draw-decalv5.json");
    Assert(response.ok, `Failed to load DecalV5 package records: HTTP ${response.status}`);
    const records = await response.json();
    Assert(Array.isArray(records) && records.length === 2, "DecalV5 comparison requires two package records");
    validateDecalV5PackagePair(records);

    const device = webgpu.GetDevice();
    const fixture = await CreateDecalV5GpuResources(webgpu, records);
    const dispatcher = CreateDecalV5TrinityDispatcher(webgpu, fixture);
    const passEncoder = new CjsWebGPUTrinityPassEncoder(dispatcher);
    const instances = [];
    let warningCount = 0;
    try
    {
        for (const record of records)
        {
            let preparedBatchMap = null;
            let target = null;
            let readback = null;
            try
            {
                preparedBatchMap = await dispatcher.PrepareBatchMap(
                    CreateDecalV5TrinityBatchMap(record, fixture)
                );
                warningCount += preparedBatchMap.entries.reduce(
                    (mapTotal, entry) => mapTotal + entry.accumulator.batches.reduce(
                        (batchTotal, batch) => batchTotal
                            + batch.prepared.diagnostics.filter((item) => item.type === "warning").length,
                        0
                    ),
                    0
                );
                target = device.createTexture({
                    label: `DecalV5 ${record.label} color target`,
                    size: { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 },
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
                });
                readback = device.createBuffer({
                    label: `DecalV5 ${record.label} readback`,
                    size: BYTES_PER_ROW * HEIGHT,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                });
                instances.push({
                    record,
                    preparedBatchMap,
                    target,
                    readback,
                    snapshot: null,
                    statistics: null
                });
            }
            catch (error)
            {
                if (preparedBatchMap) dispatcher.DestroyBatchMap(preparedBatchMap);
                readback?.destroy();
                target?.destroy();
                throw error;
            }
        }

        const encoder = device.createCommandEncoder({
            label: "DecalV5 DX11/DX12 comparison encoder"
        });
        for (const instance of instances)
        {
            passEncoder.Encode(encoder, [ {
                descriptor: {
                    label: `DecalV5 ${instance.record.label} Main.pass0`,
                    colorAttachments: [ {
                        view: instance.target.createView(),
                        clearValue: {
                            r: DECALV5_CLEAR_TARGET[0] / 255,
                            g: DECALV5_CLEAR_TARGET[1] / 255,
                            b: DECALV5_CLEAR_TARGET[2] / 255,
                            a: DECALV5_CLEAR_TARGET[3] / 255
                        },
                        loadOp: "clear",
                        storeOp: "store"
                    } ]
                },
                selections: [ {
                    preparedBatchMap: instance.preparedBatchMap,
                    batchType: TRINITY_BATCH_TYPE_DECAL
                } ]
            } ]);
            encoder.copyTextureToBuffer(
                { texture: instance.target },
                {
                    buffer: instance.readback,
                    bytesPerRow: BYTES_PER_ROW,
                    rowsPerImage: HEIGHT
                },
                { width: WIDTH, height: HEIGHT, depthOrArrayLayers: 1 }
            );
        }
        webgpu.Submit([ encoder.finish() ]);
        await device.queue.onSubmittedWorkDone();
        await Promise.all(instances.map((instance) =>
            instance.readback.mapAsync(GPUMapMode.READ)));

        for (const instance of instances)
        {
            instance.snapshot = new Uint8Array(instance.readback.getMappedRange()).slice();
            instance.statistics = AssertDecalV5Silhouette(
                instance.snapshot,
                `${instance.record.label} color target`
            );
        }
        AssertExactTargetMatch(
            instances[0].snapshot,
            instances[1].snapshot,
            "DX11/DX12 DecalV5 color target"
        );
        return {
            bodyIndex: 0,
            labels: records.map((record) => `${record.backend}:${record.label}`),
            loadPath: records[0].loadPath,
            pixelCount: WIDTH * HEIGHT,
            targetCount: 1,
            drawKind: "indexed synthetic decal silhouette",
            indexCount: fixture.geometry.indexCount,
            warningCount,
            clearTarget: DECALV5_CLEAR_TARGET,
            topLeftClearPixel: Array.from(instances[0].snapshot.slice(0, 4)),
            statistics: instances[0].statistics,
            targetWidth: WIDTH,
            targetHeight: HEIGHT,
            targetPixels: GetActiveTargetPixels(instances[0].snapshot)
        };
    }
    finally
    {
        for (const instance of instances)
        {
            dispatcher.DestroyBatchMap(instance.preparedBatchMap);
            if (instance.readback.mapState === "mapped") instance.readback.unmap();
            instance.readback.destroy();
            instance.target.destroy();
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
    let renderPipelineCount = 0;
    let computePipelineCount = 0;
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
        if (record.pipelineKind === "compute")
        {
            const prepared = await createHarnessComputePipeline(
                webgpu.GetDevice(),
                record.pipeline,
                GPUShaderStage
            );
            warningCount += prepared.warningCount;
            bindingCount += prepared.bindingCount;
            computePipelineCount += 1;
        }
        else
        {
            Assert(record.pipelineKind === "render", `Matrix pipeline ${record.id} has an invalid kind`);
            const prepared = await webgpu.PreparePipeline(record.pipeline, { warningsAsErrors: true });
            warningCount += prepared.diagnostics.filter((entry) => entry.type === "warning").length;
            bindingCount += record.pipeline.bindGroups.reduce(
                (count, group) => count + group.bindings.length,
                0
            );
            renderPipelineCount += 1;
        }
    }
    Assert(renderPipelineCount === matrix.uniqueRenderPipelines, "Matrix render-pipeline count does not reconcile");
    Assert(computePipelineCount === matrix.uniqueComputePipelines, "Matrix compute-pipeline count does not reconcile");
    return {
        label: CONFIG.prepareMatrixLabel,
        uniqueShaderModules: matrix.uniqueShaderModules,
        coveredShaderOccurrences: matrix.coveredShaderOccurrences,
        uniquePipelines: matrix.uniquePipelines,
        uniqueRenderPipelines: matrix.uniqueRenderPipelines,
        uniqueComputePipelines: matrix.uniqueComputePipelines,
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
    let decalV5Comparison = null;
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
        decalV5Comparison = await RunDecalV5Comparison(webgpu);
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
            resourcePublication: "explicit guarded renderer realization",
            rgba8TexturePreparation: phaseZeroDraw
                ? "canonical decoded RGBA8 -> texture bundle -> atomic adapter slot"
                : null,
            samplerPreparation: phaseZeroDraw
                ? "complete selected WebGPU state -> sampler bundle -> atomic adapter slot"
                : null,
            quadV5Comparison,
            decalV5Comparison
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
