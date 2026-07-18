import { cloneJson, deepFreeze } from "./freeze.js";
import { CjsWebGPUBindGroup } from "../CjsWebGPUBindGroup.js";
import { CjsWebGPUBuffer } from "../CjsWebGPUBuffer.js";
import { CjsWebGPUPipeline } from "../CjsWebGPUPipeline.js";
import { CjsWebGPUResource } from "../CjsWebGPUResource.js";
import { CjsWebGPUSampler } from "../CjsWebGPUSampler.js";
import { CjsWebGPUShaderModule } from "../CjsWebGPUShaderModule.js";
import { CjsWebGPUTexture } from "../CjsWebGPUTexture.js";

const TEXTURE_RESOURCE_TYPES = new Map([
  [ 1, "1d" ],
  [ 2, "2d" ],
  [ 3, "3d" ],
  [ 4, "cube" ],
  [ 5, "typeless" ],
  [ 10, "storageTexture" ]
]);

const BUFFER_RESOURCE_TYPES = new Map([
  [ 6, "buffer" ],
  [ 7, "structuredBuffer" ],
  [ 8, "tbuffer" ],
  [ 9, "byteAddressBuffer" ],
  [ 11, "rwStructuredBuffer" ],
  [ 12, "rwByteAddressBuffer" ],
  [ 13, "appendStructuredBuffer" ],
  [ 14, "consumeStructuredBuffer" ],
  [ 15, "rwStructuredBufferWithCounter" ]
]);

/**
 * Normalize a plain CEWGPU/analysis-shaped value to the package descriptor's
 * internal working shape.
 *
 * @param {object} value Package-like input.
 * @returns {object} Normalized plain data.
 */
export function normalizePackageShape(value)
{
  if (!value || typeof value !== "object")
  {
    throw new TypeError("CjsWebGPUPackage.from: package data must be an object");
  }

  const analysis = value.analysis && typeof value.analysis === "object" ? cloneJson(value.analysis) : null;
  const wgsl = value.wgsl && typeof value.wgsl === "object" ? cloneJson(value.wgsl) : null;
  const stages = Array.isArray(value.stages)
    ? cloneJson(value.stages)
    : Array.isArray(analysis?.stages)
      ? cloneJson(analysis.stages)
      : [];
  const shaders = Array.isArray(value.shaders)
    ? cloneJson(value.shaders)
    : Array.isArray(wgsl?.shaders)
      ? cloneJson(wgsl.shaders)
      : [];
  const layouts = Array.isArray(value.layouts)
    ? cloneJson(value.layouts)
    : Array.isArray(wgsl?.layouts)
      ? cloneJson(wgsl.layouts)
      : [];

  return {
    format: value.format || "CEWGPU",
    version: Number.isInteger(value.version) ? value.version : 1,
    sourcePath: typeof value.sourcePath === "string" ? value.sourcePath : "memory",
    info: cloneJson(value.info || {}),
    metadata: cloneJson(value.metadata || {}),
    analysis,
    wgsl,
    chunks: Array.isArray(value.chunks) ? cloneJson(value.chunks) : [],
    stages,
    shaders,
    layouts
  };
}

/**
 * Build immutable shader-module descriptors from normalized package data.
 *
 * @param {object} normalized Normalized package data.
 * @returns {CjsWebGPUShaderModule[]} Shader-module descriptors.
 */
export function buildShaderModules(normalized)
{
  return normalized.stages.map((stage) =>
  {
    const shader = matchShaderSource(stage, normalized.shaders);
    return new CjsWebGPUShaderModule({
      key: stage.key || buildStageKey(stage),
      techniqueName: stage.techniqueName || "",
      passIndex: Number.isInteger(stage.passIndex) ? stage.passIndex : 0,
      stageName: stage.stageName || "",
      stageType: Number.isInteger(stage.stageType) ? stage.stageType : null,
      pipelineInputs: cloneJson(stage.pipelineInputs || []),
      threadGroupSize: cloneJson(stage.threadGroupSize || null),
      bindings: cloneJson(stage.bindings || []),
      dxbc: cloneJson(stage.dxbc || null),
      dxbcError: cloneJson(stage.dxbcError || null),
      shaderBytecode: cloneJson(stage.shaderBytecode || null),
      wgsl: shader?.code || shader?.source || shader?.wgsl || null,
      entryPoint: shader?.entryPoint || "main",
      sourceMap: cloneJson(shader?.sourceMap || []),
      shaderRecord: shader ? cloneJson(shader) : null
    });
  });
}

/**
 * Build pass/pipeline descriptors from normalized package data and shader
 * modules.
 *
 * @param {object} normalized Normalized package data.
 * @param {CjsWebGPUShaderModule[]} shaderModules Shader modules.
 * @returns {{ pipelines: CjsWebGPUPipeline[], bindGroups: CjsWebGPUBindGroup[] }} Pipeline and bind-group descriptors.
 */
export function buildPipelines(normalized, shaderModules)
{
  const passMap = new Map();
  const passRecords = Array.isArray(normalized.analysis?.passes) ? normalized.analysis.passes : [];

  for (const pass of passRecords)
  {
    passMap.set(buildPassKey(pass), {
      techniqueName: pass.techniqueName || "",
      passIndex: Number.isInteger(pass.passIndex) ? pass.passIndex : 0,
      renderStates: Number.isInteger(pass.renderStates) ? pass.renderStates : 0,
      states: cloneJson(pass.states || []),
      stages: []
    });
  }

  for (const module of shaderModules)
  {
    const key = buildPassKey(module);
    if (!passMap.has(key))
    {
      passMap.set(key, {
        techniqueName: module.techniqueName,
        passIndex: module.passIndex,
        renderStates: 0,
        states: [],
        stages: []
      });
    }
    passMap.get(key).stages.push(module);
  }

  const bindGroups = [];
  const pipelines = [];

  for (const pass of passMap.values())
  {
    const canonicalLayout = normalized.layouts.find((entry) => entry?.key === buildPassKey(pass)) || null;
    const passBindGroups = canonicalLayout
      ? buildCanonicalBindGroups(pass, canonicalLayout)
      : [ new CjsWebGPUBindGroup({
        key: `${buildPassKey(pass)}.bindings`,
        techniqueName: pass.techniqueName,
        passIndex: pass.passIndex,
        bindings: mergeBindings(pass.stages)
      }) ];

    bindGroups.push(...passBindGroups);
    pipelines.push(new CjsWebGPUPipeline({
      key: buildPassKey(pass),
      techniqueName: pass.techniqueName,
      passIndex: pass.passIndex,
      renderStates: pass.renderStates,
      states: pass.states,
      shaderModules: pass.stages,
      bindGroups: passBindGroups
    }));
  }

  return { pipelines, bindGroups };
}

/**
 * Create the package descriptor JSON shape exposed by `ToJSON()`.
 *
 * @param {object} normalized Normalized package data.
 * @param {CjsWebGPUShaderModule[]} shaderModules Shader modules.
 * @param {CjsWebGPUPipeline[]} pipelines Pipelines.
 * @param {CjsWebGPUBindGroup[]} bindGroups Bind groups.
 * @returns {object} Plain JSON-compatible snapshot.
 */
export function buildPackageJson(normalized, shaderModules, pipelines, bindGroups)
{
  return deepFreeze({
    format: normalized.format,
    version: normalized.version,
    sourcePath: normalized.sourcePath,
    info: cloneJson(normalized.info),
    metadata: cloneJson(normalized.metadata),
    analysis: cloneJson(normalized.analysis),
    wgsl: cloneJson(normalized.wgsl),
    chunks: cloneJson(normalized.chunks),
    stages: shaderModules.map((entry) => entry.ToJSON()),
    shaders: cloneJson(normalized.shaders),
    layouts: cloneJson(normalized.layouts),
    pipelines: pipelines.map((entry) => entry.ToJSON()),
    bindGroups: bindGroups.map((entry) => entry.ToJSON())
  });
}

const RESOURCE_KIND_TO_CARBON = Object.freeze({
  "uniform-buffer": "constantBuffer",
  "sampled-resource": "resource",
  sampler: "sampler",
  "storage-resource": "uav"
});

function buildCanonicalBindGroups(pass, layout)
{
  const slots = new Set();
  const identities = new Map();
  return (layout.bindGroups || []).map((groupRecord) =>
  {
    if (!Number.isInteger(groupRecord.group)) throw new Error(`Canonical layout ${layout.key} has an invalid group`);
    const bindings = (groupRecord.bindings || []).map((binding) =>
    {
      if (!Number.isInteger(binding.binding) || binding.group !== groupRecord.group)
      {
        throw new Error(`Canonical layout ${layout.key} has an invalid binding slot`);
      }
      const slot = `${binding.group}:${binding.binding}`;
      if (slots.has(slot)) throw new Error(`Canonical layout ${layout.key} duplicates group/binding ${slot}`);
      slots.add(slot);
      const identity = canonicalIdentity(binding);
      const fingerprint = JSON.stringify({
        group: binding.group,
        binding: binding.binding,
        type: binding.type || null,
        buffer: binding.buffer || null,
        texture: binding.texture || null,
        sampler: binding.sampler || null
      });
      if (identities.has(identity) && identities.get(identity) !== fingerprint)
      {
        throw new Error(`Canonical layout ${layout.key} conflicts for ${identity}`);
      }
      identities.set(identity, fingerprint);
      return createCanonicalDescriptor(pass, binding);
    });
    return new CjsWebGPUBindGroup({
      key: `${buildPassKey(pass)}.group${groupRecord.group}`,
      techniqueName: pass.techniqueName,
      passIndex: pass.passIndex,
      group: groupRecord.group,
      bindings
    });
  });
}

function canonicalIdentity(binding)
{
  if (!RESOURCE_KIND_TO_CARBON[binding.resourceKind]
    || !Number.isInteger(binding.registerIndex)
    || !Number.isInteger(binding.registerSpace))
  {
    throw new Error("Canonical layout binding has an invalid D3D identity");
  }
  return `${binding.resourceKind}:${binding.registerSpace}:${binding.registerIndex}`;
}

function createCanonicalDescriptor(pass, binding)
{
  const carbonKind = RESOURCE_KIND_TO_CARBON[binding.resourceKind];
  const candidates = pass.stages.flatMap((module) => module.bindings
    .filter((entry) => entry.kind === carbonKind
      && entry.registerIndex === binding.registerIndex
      && (Number.isInteger(entry.registerSpace) ? entry.registerSpace : 0) === binding.registerSpace)
    .map((entry) => ({ module, entry })));
  const metadata = candidates[0]?.entry || null;
  const visibility = Array.from(new Set(Array.isArray(binding.visibility)
    ? binding.visibility
    : binding.visibility ? [ binding.visibility ] : candidates.map(({ module }) => module.stageName))).sort();
  const bindingStages = candidates.length
    ? candidates.map(({ module }) => ({
      key: module.key,
      stageName: module.stageName,
      stageType: module.stageType
    }))
    : pass.stages
      .filter((module) => visibility.includes(module.stageName === "pixel" ? "fragment" : module.stageName))
      .map((module) => ({
        key: module.key,
        stageName: module.stageName,
        stageType: module.stageType
      }));
  const base = {
    key: `group${binding.group}:binding${binding.binding}`,
    name: metadata?.metadataName || binding.generatedSymbol || "",
    techniqueName: pass.techniqueName,
    passIndex: pass.passIndex,
    stageName: candidates[0]?.module.stageName || "",
    stageType: candidates[0]?.module.stageType ?? null,
    generatedSymbol: binding.generatedSymbol || "",
    bindingKind: carbonKind,
    resourceKind: binding.resourceKind,
    registerIndex: binding.registerIndex,
    registerSpace: binding.registerSpace,
    registerCount: 1,
    arrayCount: 1,
    dynamic: false,
    heapView: Boolean(metadata?.heapView),
    metadataName: metadata?.metadataName || null,
    carbon: cloneJson(metadata?.carbon || null),
    annotations: cloneJson(metadata?.annotations || []),
    sourceTruth: "wgsl-layout",
    stages: uniqueStages(bindingStages),
    group: binding.group,
    binding: binding.binding,
    visibility,
    layout: {
      type: binding.type || null,
      buffer: cloneJson(binding.buffer || null),
      texture: cloneJson(binding.texture || null),
      sampler: cloneJson(binding.sampler || null)
    }
  };
  if (binding.resourceKind === "uniform-buffer")
  {
    return new CjsWebGPUBuffer({ ...base, access: "uniform", bufferKind: "constantBuffer" });
  }
  if (binding.resourceKind === "sampled-resource")
  {
    return new CjsWebGPUTexture({
      ...base,
      access: "sampled",
      textureKind: binding.texture?.viewDimension || "2d",
      arrayElements: 1,
      isSRGB: Boolean(metadata?.carbon?.isSRGB)
    });
  }
  if (binding.resourceKind === "sampler")
  {
    return new CjsWebGPUSampler({ ...base, access: "sampling" });
  }
  return new CjsWebGPUResource({ ...base, access: "readWrite" });
}

function mergeBindings(shaderModules)
{
  const merged = new Map();

  for (const module of shaderModules)
  {
    for (const binding of module.bindings)
    {
      const descriptor = createBindingDescriptor(module, binding);
      if (!merged.has(descriptor.key))
      {
        merged.set(descriptor.key, descriptor);
        continue;
      }

      merged.set(descriptor.key, mergeDescriptorStages(merged.get(descriptor.key), descriptor));
    }
  }

  return Array.from(merged.values());
}

function mergeDescriptorStages(current, next)
{
  const stages = uniqueStages([
    ...(Array.isArray(current.stages) ? current.stages : []),
    ...(Array.isArray(next.stages) ? next.stages : [])
  ]);

  const base = current.ToJSON();
  base.stages = stages;
  return recreateDescriptor(current, base);
}

function recreateDescriptor(current, value)
{
  if (current instanceof CjsWebGPUBuffer) return new CjsWebGPUBuffer(value);
  if (current instanceof CjsWebGPUTexture) return new CjsWebGPUTexture(value);
  if (current instanceof CjsWebGPUSampler) return new CjsWebGPUSampler(value);
  return new CjsWebGPUResource(value);
}

function createBindingDescriptor(module, binding)
{
  const base = {
    key: buildBindingKey(binding),
    name: binding.metadataName || binding.generatedSymbol || "",
    techniqueName: module.techniqueName,
    passIndex: module.passIndex,
    stageName: module.stageName,
    stageType: module.stageType,
    generatedSymbol: binding.generatedSymbol || "",
    bindingKind: binding.kind || "resource",
    registerIndex: Number.isInteger(binding.registerIndex) ? binding.registerIndex : 0,
    registerSpace: Number.isInteger(binding.registerSpace) ? binding.registerSpace : null,
    registerCount: Number.isInteger(binding.registerCount) ? binding.registerCount : 1,
    arrayCount: Number.isInteger(binding.arrayCount) ? binding.arrayCount : 1,
    dynamic: Boolean(binding.dynamic),
    heapView: Boolean(binding.heapView),
    metadataName: binding.metadataName || null,
    carbon: cloneJson(binding.carbon || null),
    annotations: cloneJson(binding.annotations || []),
    sourceTruth: binding.sourceTruth || "unknown",
    stages: uniqueStages([ {
      key: module.key,
      stageName: module.stageName,
      stageType: module.stageType
    } ])
  };

  if (binding.kind === "constantBuffer")
  {
    return new CjsWebGPUBuffer({
      ...base,
      access: "uniform",
      bufferKind: "constantBuffer"
    });
  }

  if (binding.kind === "sampler")
  {
    return new CjsWebGPUSampler({
      ...base,
      access: "sampling"
    });
  }

  const carbonType = binding.carbon?.type;
  if (TEXTURE_RESOURCE_TYPES.has(carbonType))
  {
    return new CjsWebGPUTexture({
      ...base,
      access: binding.kind === "uav" ? "readWrite" : "sampled",
      textureKind: TEXTURE_RESOURCE_TYPES.get(carbonType),
      arrayElements: Number.isInteger(binding.carbon?.arrayElements) ? binding.carbon.arrayElements : 1,
      isSRGB: Boolean(binding.carbon?.isSRGB)
    });
  }

  if (BUFFER_RESOURCE_TYPES.has(carbonType))
  {
    return new CjsWebGPUBuffer({
      ...base,
      access: binding.kind === "uav" ? "readWrite" : "readOnly",
      bufferKind: BUFFER_RESOURCE_TYPES.get(carbonType)
    });
  }

  return new CjsWebGPUResource({
    ...base,
    access: binding.kind === "uav" ? "readWrite" : "readOnly"
  });
}

function matchShaderSource(stage, shaders)
{
  return shaders.find((shader) =>
    shader?.key === stage.key ||
    (
      shader?.techniqueName === stage.techniqueName &&
      shader?.passIndex === stage.passIndex &&
      shader?.stageName === stage.stageName
    )
  ) || null;
}

function uniqueStages(stages)
{
  const seen = new Set();
  const out = [];

  for (const stage of stages)
  {
    const key = `${stage.stageName}:${stage.stageType}:${stage.key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cloneJson(stage));
  }

  return deepFreeze(out);
}

function buildStageKey(stage)
{
  return `${stage.techniqueName || "Main"}.pass${Number.isInteger(stage.passIndex) ? stage.passIndex : 0}.${stage.stageName || "unknown"}`;
}

function buildPassKey(pass)
{
  return `${pass.techniqueName || "Main"}.pass${Number.isInteger(pass.passIndex) ? pass.passIndex : 0}`;
}

function buildBindingKey(binding)
{
  const parts = [
    binding.kind || "resource",
    binding.generatedSymbol || "",
    binding.metadataName || "",
    Number.isInteger(binding.registerIndex) ? binding.registerIndex : 0
  ];
  if (Number.isInteger(binding.registerSpace)) parts.push(`space${binding.registerSpace}`);
  return parts.join(":");
}
