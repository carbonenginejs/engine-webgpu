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

const WGSL_SET_VERSIONS = new Set([ 1, 2, 3 ]);

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
  if (wgsl && (wgsl.format !== "CJS_WGSL_SET" || !WGSL_SET_VERSIONS.has(wgsl.formatVersion)))
  {
    throw new Error("CjsWebGPUPackage.from: wgsl must be a CJS_WGSL_SET version 1, 2 or 3 document");
  }
  if (wgsl && ((wgsl.shaders !== undefined && !Array.isArray(wgsl.shaders))
    || (wgsl.layouts !== undefined && !Array.isArray(wgsl.layouts))))
  {
    throw new Error("CjsWebGPUPackage.from: structured wgsl shaders and layouts must be arrays when provided");
  }
  if (wgsl) assertRealizableWgslSet(wgsl);
  const stages = Array.isArray(value.stages)
    ? cloneJson(value.stages)
    : Array.isArray(analysis?.stages)
      ? cloneJson(analysis.stages)
      : [];
  const shaders = wgsl
    ? cloneJson(wgsl.shaders || [])
    : Array.isArray(value.shaders)
      ? cloneJson(value.shaders)
      : [];
  const layouts = wgsl
    ? cloneJson(wgsl.layouts || [])
    : Array.isArray(value.layouts)
      ? cloneJson(value.layouts)
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
 * Reject a CJS_WGSL_SET document that declares resource transforms.
 *
 * The engine cannot realize a resource transform: the producer removes a
 * transform's non-zero-layer inputs from the physical layout, so the array
 * binding cannot be fed binding-by-binding. The discriminator is the feature,
 * never the document version - transforms are an optional payload, not a
 * schema version - and never `viewDimension`, because a source-declared
 * `texture_2d_array` keeps all of its bindings and needs no new machinery.
 *
 * @param {object} wgsl Cloned CJS_WGSL_SET document.
 * @returns {void}
 */
function assertRealizableWgslSet(wgsl)
{
  if (Array.isArray(wgsl.resourceTransforms) && wgsl.resourceTransforms.length)
  {
    throw new Error("CjsWebGPUPackage.from: wgsl resource transforms are not supported by this engine");
  }
  for (const layout of Array.isArray(wgsl.layouts) ? wgsl.layouts : [])
  {
    for (const groupRecord of Array.isArray(layout?.bindGroups) ? layout.bindGroups : [])
    {
      for (const binding of Array.isArray(groupRecord?.bindings) ? groupRecord.bindings : [])
      {
        if (binding && (binding.transformId !== undefined && binding.transformId !== null))
        {
          throw new Error(`CjsWebGPUPackage.from: transformed binding ${binding.group}:${binding.binding}`
            + " is not supported by this engine");
        }
        if (binding && (binding.arrayLayerCount !== undefined && binding.arrayLayerCount !== null))
        {
          throw new Error(`CjsWebGPUPackage.from: transformed binding ${binding.group}:${binding.binding}`
            + " is not supported by this engine");
        }
      }
    }
  }
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
    const threadGroupSize = resolveThreadGroupSize(stage, shader);
    return new CjsWebGPUShaderModule({
      key: stage.key || buildStageKey(stage),
      techniqueName: stage.techniqueName || "",
      passIndex: Number.isInteger(stage.passIndex) ? stage.passIndex : 0,
      stageName: stage.stageName || "",
      stageType: Number.isInteger(stage.stageType) ? stage.stageType : null,
      pipelineInputs: cloneJson(stage.pipelineInputs || []),
      threadGroupSize: cloneJson(threadGroupSize),
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
      ? buildCanonicalBindGroups(pass, canonicalLayout, normalized.wgsl?.formatVersion ?? null)
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

const CANONICAL_STAGE_ORDER = Object.freeze([ "vertex", "fragment", "compute" ]);
const CANONICAL_STAGE_TYPES = Object.freeze({
  vertex: 0,
  fragment: 1,
  compute: 2
});

function validatedThreadGroupSize(value, label)
{
  const normalized = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [ value.x, value.y, value.z ]
      : null;
  if (!normalized || normalized.length !== 3
    || normalized.some((entry) => !Number.isSafeInteger(entry) || entry < 1))
  {
    throw new Error(`${label} requires a positive three-dimensional threadGroupSize`);
  }
  return [ ...normalized ];
}

function isInactiveThreadGroupSize(value)
{
  const normalized = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [ value.x, value.y, value.z ]
      : null;
  return normalized?.length === 3 && normalized.every((entry) => entry === 0);
}

function resolveThreadGroupSize(stage, shader)
{
  const canonicalStage = normalizeCanonicalStage(stage.stageName);
  const analysisSize = stage.threadGroupSize ?? null;
  const shaderSize = shader?.threadGroupSize ?? null;
  if (canonicalStage !== "compute")
  {
    if ((analysisSize !== null && !isInactiveThreadGroupSize(analysisSize))
      || (shaderSize !== null && !isInactiveThreadGroupSize(shaderSize)))
    {
      throw new Error(`Shader stage ${stage.key || buildStageKey(stage)} cannot declare threadGroupSize`);
    }
    return null;
  }
  const validatedAnalysis = analysisSize === null
    ? null
    : validatedThreadGroupSize(analysisSize, `Compute stage ${stage.key || buildStageKey(stage)}`);
  const validatedShader = shaderSize === null
    ? null
    : validatedThreadGroupSize(shaderSize, `Compute shader ${stage.key || buildStageKey(stage)}`);
  if (shader && !validatedShader)
  {
    throw new Error(`Compute shader ${stage.key || buildStageKey(stage)} requires threadGroupSize metadata`);
  }
  if (validatedAnalysis && validatedShader
    && validatedAnalysis.some((entry, index) => entry !== validatedShader[index]))
  {
    throw new Error(`Compute stage ${stage.key || buildStageKey(stage)} has inconsistent threadGroupSize metadata`);
  }
  return validatedShader || validatedAnalysis;
}

function normalizeCanonicalStage(value)
{
  if (value === "pixel" || value === "fragment") return "fragment";
  if (value === "vertex") return "vertex";
  if (value === "compute") return "compute";
  return "";
}

function canonicalVisibility(value)
{
  const values = Array.isArray(value) ? value : value ? [ value ] : [];
  const visibility = Array.from(new Set(values.map(normalizeCanonicalStage)));
  if (visibility.some((stage) => !stage)) throw new Error("Canonical layout binding has invalid visibility");
  return visibility.sort((left, right) =>
    CANONICAL_STAGE_ORDER.indexOf(left) - CANONICAL_STAGE_ORDER.indexOf(right));
}

function buildCanonicalBindGroups(pass, layout, formatVersion)
{
  const slots = new Set();
  const identities = new Map();
  const baseScopes = new Map();
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
      const identity = canonicalIdentity(binding, formatVersion);
      const scopeIdentity = canonicalScopeIdentity(binding, formatVersion);
      const visibility = canonicalVisibility(binding.visibility);
      if (formatVersion >= 2 && scopeIdentity === identity && visibility.length < 2)
      {
        throw new Error(`Canonical layout ${layout.key} shared identity ${identity} does not cover multiple stages`);
      }
      if (!baseScopes.has(identity)) baseScopes.set(identity, new Set());
      const scopes = baseScopes.get(identity);
      if ((scopeIdentity === identity && Array.from(scopes).some((scope) => scope !== identity))
        || (scopeIdentity !== identity && scopes.has(identity)))
      {
        throw new Error(`Canonical layout ${layout.key} mixes shared and stage-scoped forms for ${identity}`);
      }
      scopes.add(scopeIdentity);
      const fingerprint = JSON.stringify({
        identity,
        scopeIdentity,
        group: binding.group,
        binding: binding.binding,
        type: binding.type || null,
        buffer: binding.buffer || null,
        texture: binding.texture || null,
        sampler: binding.sampler || null
      });
      if (identities.has(scopeIdentity) && identities.get(scopeIdentity) !== fingerprint)
      {
        throw new Error(`Canonical layout ${layout.key} conflicts for ${scopeIdentity}`);
      }
      identities.set(scopeIdentity, fingerprint);
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

function canonicalIdentity(binding, formatVersion = null)
{
  if (!RESOURCE_KIND_TO_CARBON[binding.resourceKind]
    || !Number.isInteger(binding.registerIndex)
    || !Number.isInteger(binding.registerSpace))
  {
    throw new Error("Canonical layout binding has an invalid D3D identity");
  }
  const identity = `${binding.resourceKind}:${binding.registerSpace}:${binding.registerIndex}`;
  if (formatVersion >= 2 && binding.identity === undefined)
  {
    throw new Error(`Canonical layout version ${formatVersion} binding ${identity} requires an explicit D3D identity`);
  }
  if (binding.identity !== undefined && binding.identity !== identity)
  {
    throw new Error(`Canonical layout binding has inconsistent D3D identity ${binding.identity}`);
  }
  return identity;
}

function canonicalScopeIdentity(binding, formatVersion = null)
{
  const identity = canonicalIdentity(binding, formatVersion);
  if (formatVersion >= 2 && binding.scopeIdentity === undefined)
  {
    throw new Error(`Canonical layout version ${formatVersion} binding ${identity} requires an explicit scope identity`);
  }
  if (binding.scopeIdentity !== undefined
    && (typeof binding.scopeIdentity !== "string" || !binding.scopeIdentity))
  {
    throw new Error(`Canonical layout binding has invalid scope identity ${binding.scopeIdentity || "<empty>"}`);
  }
  const scopeIdentity = binding.scopeIdentity === undefined ? identity : binding.scopeIdentity;
  const visibility = canonicalVisibility(binding.visibility);
  if (typeof scopeIdentity !== "string"
    || (scopeIdentity !== identity
      && (visibility.length !== 1 || scopeIdentity !== `${identity}@${visibility[0]}`)))
  {
    throw new Error(`Canonical layout binding has invalid scope identity ${scopeIdentity || "<empty>"}`);
  }
  return scopeIdentity;
}

function createCanonicalDescriptor(pass, binding)
{
  const carbonKind = RESOURCE_KIND_TO_CARBON[binding.resourceKind];
  const allCandidates = pass.stages.flatMap((module) => module.bindings
    .filter((entry) => entry.kind === carbonKind
      && entry.registerIndex === binding.registerIndex
      && (Number.isInteger(entry.registerSpace) ? entry.registerSpace : 0) === binding.registerSpace)
    .map((entry) => ({ module, entry })));
  const declaredVisibility = canonicalVisibility(binding.visibility);
  const visibility = declaredVisibility.length
    ? declaredVisibility
    : Array.from(new Set(allCandidates.map(({ module }) => normalizeCanonicalStage(module.stageName)))).filter(Boolean);
  const candidates = allCandidates.filter(({ module }) => visibility.includes(normalizeCanonicalStage(module.stageName)));
  const metadata = candidates[0]?.entry || null;
  const bindingStages = candidates.length
    ? candidates.map(({ module }) => ({
      key: module.key,
      stageName: module.stageName,
      stageType: module.stageType
    }))
    : pass.stages
      .filter((module) => visibility.includes(normalizeCanonicalStage(module.stageName)))
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
    identity: canonicalIdentity(binding),
    scopeIdentity: canonicalScopeIdentity(binding),
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
    structureStride: Number.isInteger(binding.structureStride) ? binding.structureStride : null,
    layout: {
      type: binding.type || null,
      buffer: cloneJson(binding.buffer || null),
      texture: cloneJson(binding.texture || null),
      sampler: cloneJson(binding.sampler || null)
    }
  };
  if (binding.buffer)
  {
    if (binding.buffer.type !== "uniform" && binding.buffer.type !== "read-only-storage"
      && binding.buffer.type !== "storage")
    {
      throw new Error(`Canonical layout binding has unsupported buffer type ${binding.buffer.type || "unknown"}`);
    }
    const uniform = binding.buffer.type === "uniform";
    const readWrite = binding.buffer.type === "storage";
    return new CjsWebGPUBuffer({
      ...base,
      access: uniform ? "uniform" : readWrite ? "readWrite" : "readOnly",
      bufferKind: uniform
        ? "constantBuffer"
        : BUFFER_RESOURCE_TYPES.get(metadata?.carbon?.type) || (readWrite ? "rwBuffer" : "structuredBuffer")
    });
  }
  if (binding.texture)
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
  const key = stage.key || buildStageKey(stage);
  const techniqueName = stage.techniqueName || "Main";
  const passIndex = Number.isInteger(stage.passIndex) ? stage.passIndex : 0;
  const stageName = stage.stageName || "";
  const candidates = shaders.filter((shader) =>
    shader?.key === key ||
    (
      shader?.techniqueName === techniqueName &&
      shader?.passIndex === passIndex &&
      shader?.stageName === stageName
    )
  );
  if (candidates.length > 1)
  {
    throw new Error(`Shader stage ${key} has ambiguous WGSL source records`);
  }
  const shader = candidates[0] || null;
  if (!shader) return null;

  if ((shader.key !== undefined && shader.key !== key)
    || (shader.techniqueName !== undefined && shader.techniqueName !== techniqueName)
    || (shader.passIndex !== undefined && shader.passIndex !== passIndex)
    || (shader.stageName !== undefined && shader.stageName !== stageName))
  {
    throw new Error(`Shader stage ${key} has inconsistent WGSL provenance`);
  }
  const canonicalStage = normalizeCanonicalStage(stageName);
  if (!canonicalStage)
  {
    throw new Error(`Shader stage ${key} has unsupported WGSL stage ${stageName || "<empty>"}`);
  }
  if (shader.stage !== undefined && shader.stage !== canonicalStage)
  {
    throw new Error(`Shader stage ${key} has inconsistent WGSL stage ${shader.stage}`);
  }
  const expectedStageType = CANONICAL_STAGE_TYPES[canonicalStage];
  if ((Number.isInteger(stage.stageType) && stage.stageType !== expectedStageType)
    || (shader.stageType !== undefined && shader.stageType !== expectedStageType))
  {
    throw new Error(`Shader stage ${key} has inconsistent WGSL stage type`);
  }
  return shader;
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
