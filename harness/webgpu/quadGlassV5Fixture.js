import {
  QUADV5_CLEAR_TARGETS,
  QUADV5_TARGET_HEIGHT,
  QUADV5_TARGET_WIDTH,
  QUADV5_VERTEX_BUFFER_LAYOUT,
  createQuadV5FixtureValues,
  createQuadV5MainBindingValues
} from "./quadV5Fixture.js";

const TARGET_BODY_INDEX = 0;

export const QUAD_GLASS_V5_TARGET_WIDTH = QUADV5_TARGET_WIDTH;
export const QUAD_GLASS_V5_TARGET_HEIGHT = QUADV5_TARGET_HEIGHT;
export const QUAD_GLASS_V5_VERTEX_BUFFER_LAYOUT = QUADV5_VERTEX_BUFFER_LAYOUT;
export const QUAD_GLASS_V5_CLEAR_TARGETS = QUADV5_CLEAR_TARGETS;

/**
 * Translate the two audited D3D cull states into the explicit WebGPU recipe
 * used by the harness.
 *
 * @param {number} passIndex Main pass index.
 * @returns {{frontFace: string, cullMode: string}} Frozen primitive recipe.
 */
export function getQuadGlassV5PrimitiveRecipe(passIndex)
{
  if (passIndex !== 0 && passIndex !== 1)
  {
    throw new RangeError("QuadGlassV5 primitive recipe requires Main pass 0 or 1");
  }
  return Object.freeze({
    frontFace: "cw",
    cullMode: passIndex === 0 ? "back" : "front"
  });
}

export const QUAD_GLASS_V5_SELECTION = Object.freeze({
  BINDLESS_RENDERING: "BINDLESS_RENDERING_DISABLED",
  SPACE_OBJECT_CLIPPING: "SOC_DISABLED",
  SPACE_OBJECT_PPT_ENABLED: "SOPPT_DISABLED",
  SPACE_OBJECT_TRANSPARENCY: "SOT_OPAQUE",
  V5_DEBUG: "OFF",
  SPACE_OBJECT_INSTANCED_ATTACHMENT: "SOIA_DISABLED"
});

const SELECTION_PROVENANCE = Object.freeze({
  BINDLESS_RENDERING: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "BINDLESS_RENDERING_DISABLED"
  }),
  SPACE_OBJECT_CLIPPING: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "SOC_DISABLED"
  }),
  SPACE_OBJECT_PPT_ENABLED: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "SOPPT_DISABLED"
  }),
  SPACE_OBJECT_TRANSPARENCY: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "SOT_OPAQUE"
  }),
  V5_DEBUG: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "OFF"
  }),
  SPACE_OBJECT_INSTANCED_ATTACHMENT: Object.freeze({
    optionIndex: 0,
    defaultOption: 0,
    defaultValue: "SOIA_DISABLED"
  })
});

const UNIFORMS = Object.freeze([
  Object.freeze({
    identity: "uniform-buffer:0:0",
    scopeIdentity: "uniform-buffer:0:0@fragment",
    binding: 0,
    visibility: "fragment",
    minBindingSize: 224
  }),
  Object.freeze({
    identity: "uniform-buffer:0:1",
    scopeIdentity: "uniform-buffer:0:1@vertex",
    binding: 1,
    visibility: "vertex",
    minBindingSize: 512
  }),
  Object.freeze({
    identity: "uniform-buffer:0:2",
    scopeIdentity: "uniform-buffer:0:2@fragment",
    binding: 2,
    visibility: "fragment",
    minBindingSize: 384
  }),
  Object.freeze({
    identity: "uniform-buffer:0:3",
    scopeIdentity: "uniform-buffer:0:3@vertex",
    binding: 3,
    visibility: "vertex",
    minBindingSize: 128
  }),
  Object.freeze({
    identity: "uniform-buffer:0:4",
    scopeIdentity: "uniform-buffer:0:4@fragment",
    binding: 4,
    visibility: "fragment",
    minBindingSize: 208
  })
]);

const RESOURCE_NAMES = Object.freeze([
  "EveSpaceSceneEnvMap",
  "EveSceneFogVolumeMap",
  "NormalMap",
  "GlowMap",
  "RoughnessMap",
  "MaterialMap",
  "PaintMaskMap"
]);

const RESOURCE_DIMENSIONS = Object.freeze([
  "cube",
  "2d-array",
  "2d",
  "2d",
  "2d",
  "2d",
  "2d"
]);

const RESOURCE_REGISTERS = Object.freeze({
  dx11: Object.freeze([ 0, 1, 2, 3, 4, 5, 6 ]),
  dx12: Object.freeze([ 0, 2, 4, 5, 8, 10, 11 ])
});

const SAMPLERS = Object.freeze([
  Object.freeze({ name: "SurfaceSampler", registerIndex: 0, binding: 12 }),
  Object.freeze({ name: "FogSampler", registerIndex: 1, binding: 13 })
]);

const MATERIAL_CONSTANTS = Object.freeze([
  "GeneralGlowColor",
  "Mtl1DiffuseColor",
  "Mtl2DiffuseColor",
  "Mtl3DiffuseColor",
  "Mtl4DiffuseColor",
  "Mtl1FresnelColor",
  "Mtl2FresnelColor",
  "Mtl3FresnelColor",
  "Mtl4FresnelColor",
  "Mtl1Gloss",
  "Mtl2Gloss",
  "Mtl3Gloss",
  "Mtl4Gloss"
]);

function fail(message)
{
  throw new Error(`QuadGlassV5 fixture: ${message}`);
}

function normalizedPath(value)
{
  return typeof value === "string" ? value.replace(/\\/gu, "/").toLowerCase() : "";
}

function expectedResources(backend)
{
  const registers = RESOURCE_REGISTERS[backend];
  if (!registers) fail(`unsupported package backend ${String(backend)}`);
  return RESOURCE_NAMES.map((name, index) => Object.freeze({
    name,
    identity: `sampled-resource:0:${registers[index]}`,
    scopeIdentity: `sampled-resource:0:${registers[index]}@fragment`,
    registerIndex: registers[index],
    binding: 5 + index,
    viewDimension: RESOURCE_DIMENSIONS[index]
  }));
}

function expectedSamplers()
{
  return SAMPLERS.map((entry) => Object.freeze({
    ...entry,
    identity: `sampler:0:${entry.registerIndex}`,
    scopeIdentity: `sampler:0:${entry.registerIndex}@fragment`
  }));
}

function assertSelections(options, owner)
{
  if (!Array.isArray(options) || options.length !== Object.keys(QUAD_GLASS_V5_SELECTION).length)
  {
    fail(`${owner} must contain every QuadGlassV5 permutation selection`);
  }
  const selected = new Map();
  for (const entry of options)
  {
    if (typeof entry?.name !== "string" || selected.has(entry.name))
    {
      fail(`${owner} has malformed or duplicate selections`);
    }
    selected.set(entry.name, entry);
  }
  for (const [ name, value ] of Object.entries(QUAD_GLASS_V5_SELECTION))
  {
    const entry = selected.get(name);
    const provenance = SELECTION_PROVENANCE[name];
    if (!entry || entry.value !== value) fail(`${owner} requires ${name}=${value}`);
    if (entry.optionIndex !== provenance.optionIndex
      || entry.defaultOption !== provenance.defaultOption
      || entry.defaultValue !== provenance.defaultValue
      || entry.source !== "local")
    {
      fail(`${owner} has unexpected provenance for ${name}`);
    }
  }
}

function mainStage(record, passIndex, stageName)
{
  const matches = record.analysis?.stages?.filter((entry) =>
    entry?.techniqueName === "Main"
      && entry.passIndex === passIndex
      && entry.stageName === stageName);
  if (!Array.isArray(matches) || matches.length !== 1)
  {
    fail(`analysis must contain exactly one Main.pass${passIndex}.${stageName} stage`);
  }
  return matches[0];
}

function assertVertexInputs(record, passIndex)
{
  const active = (mainStage(record, passIndex, "vertex").pipelineInputs || [])
    .filter((entry) => entry.usedMask !== 0)
    .map(({ registerIndex, dimension, type }) => ({ registerIndex, dimension, type }))
    .sort((left, right) => left.registerIndex - right.registerIndex);
  const expected = [
    { registerIndex: 0, dimension: 3, type: 0 },
    { registerIndex: 2, dimension: 2, type: 0 },
    { registerIndex: 3, dimension: 3, type: 0 },
    { registerIndex: 4, dimension: 3, type: 0 },
    { registerIndex: 5, dimension: 3, type: 0 },
    { registerIndex: 6, dimension: 2, type: 0 }
  ];
  if (JSON.stringify(active) !== JSON.stringify(expected))
  {
    fail(`Main.pass${passIndex}.vertex has an unexpected active input contract`);
  }
}

function assertPixelInputs(record, passIndex)
{
  const active = (mainStage(record, passIndex, "pixel").pipelineInputs || [])
    .filter((entry) => entry.usedMask !== 0)
    .map(({ registerIndex, usedMask, dimension, type }) => ({
      registerIndex,
      usedMask,
      dimension,
      type
    }))
    .sort((left, right) => left.registerIndex - right.registerIndex);
  const expected = [
    { registerIndex: 1, usedMask: 3, dimension: 4, type: 0 },
    { registerIndex: 2, usedMask: 7, dimension: 3, type: 0 },
    { registerIndex: 3, usedMask: 7, dimension: 3, type: 0 },
    { registerIndex: 4, usedMask: 7, dimension: 3, type: 0 },
    { registerIndex: 5, usedMask: 15, dimension: 4, type: 0 },
    { registerIndex: 8, usedMask: 11, dimension: 4, type: 0 }
  ];
  if (JSON.stringify(active) !== JSON.stringify(expected))
  {
    fail(`Main.pass${passIndex}.pixel has an unexpected active input contract`);
  }
}

function assertShaderModules(pipeline, passIndex)
{
  if (!Array.isArray(pipeline.shaderModules) || pipeline.shaderModules.length !== 2)
  {
    fail(`Main.pass${passIndex} requires exactly vertex and pixel modules`);
  }
  for (const stageName of [ "vertex", "pixel" ])
  {
    const matches = pipeline.shaderModules.filter((entry) => entry?.stageName === stageName);
    if (matches.length !== 1 || typeof matches[0].wgsl !== "string" || !matches[0].wgsl
      || matches[0].key !== `Main.pass${passIndex}.${stageName}`
      || matches[0].techniqueName !== "Main" || matches[0].passIndex !== passIndex
      || matches[0].stageType !== (stageName === "vertex" ? 0 : 1)
      || matches[0].entryPoint !== "main")
    {
      fail(`Main.pass${passIndex} requires one complete ${stageName} module`);
    }
    if (stageName === "vertex")
    {
      for (const location of [ 0, 2, 3, 4, 5, 6 ])
      {
        if (!new RegExp(`@location\\(${location}\\)\\s+input${location}:`, "u")
          .test(matches[0].wgsl))
        {
          fail(`vertex WGSL is missing location ${location}`);
        }
      }
    }
    else if (!/@builtin\(position\)\s+position:\s*vec4<f32>/u.test(matches[0].wgsl)
      || !/@builtin\(front_facing\)\s+front_facing:\s*bool/u.test(matches[0].wgsl)
      || !/@location\(0\)\s+output0:/u.test(matches[0].wgsl)
      || !/@location\(1\)\s+output1:/u.test(matches[0].wgsl))
    {
      fail(
        "pixel WGSL must consume position/front_facing and expose both render targets"
      );
    }
  }
}

function assertBindingSlot(binding, expected, kind, visibility)
{
  const [ resourceKind, registerSpace, registerIndex ] = expected.identity.split(":");
  if (!binding || binding.identity !== expected.identity
    || binding.scopeIdentity !== expected.scopeIdentity
    || binding.resourceKind !== resourceKind
    || binding.registerSpace !== Number(registerSpace)
    || binding.registerIndex !== Number(registerIndex)
    || binding.sourceTruth !== "wgsl-layout"
    || binding.group !== 0 || binding.binding !== expected.binding
    || binding.dynamic !== false
    || !Array.isArray(binding.visibility) || binding.visibility.length !== 1
    || binding.visibility[0] !== visibility)
  {
    fail(`${expected.identity} has an unexpected slot, scope, register, or visibility`);
  }
  const kinds = [ "buffer", "texture", "sampler" ].filter((key) => binding.layout?.[key]);
  if (kinds.length !== 1 || kinds[0] !== kind)
  {
    fail(`${expected.identity} has an unexpected layout kind`);
  }
}

function assertMaterialReflection(record, passIndex)
{
  const material = mainStage(record, passIndex, "pixel").bindings?.filter((entry) =>
    entry?.kind === "constantBuffer"
      && entry.registerSpace === 0
      && entry.registerIndex === 0);
  if (!Array.isArray(material) || material.length !== 1
    || material[0].carbon?.hasLocalConstants !== true
    || material[0].carbon?.constantValueSize !== 224)
  {
    fail("pixel cb0 must expose the exact 224-byte local material layout");
  }
  const constants = material[0].carbon.constants;
  if (!Array.isArray(constants) || constants.length !== MATERIAL_CONSTANTS.length)
  {
    fail("pixel cb0 has an unexpected material constant count");
  }
  for (let index = 0; index < MATERIAL_CONSTANTS.length; index += 1)
  {
    const constant = constants[index];
    if (constant?.name !== MATERIAL_CONSTANTS[index]
      || constant.offset !== 16 + index * 16
      || constant.size !== 16 || constant.dimension !== 4
      || constant.type !== 0 || constant.elements !== 0)
    {
      fail(`pixel cb0 has an unexpected ${MATERIAL_CONSTANTS[index]} layout`);
    }
  }
}

function assertAnalysisResources(record, passIndex, resources)
{
  const bindings = mainStage(record, passIndex, "pixel").bindings || [];
  for (const expected of resources)
  {
    const matches = bindings.filter((entry) => entry?.kind === "resource"
      && entry.registerSpace === 0
      && entry.registerIndex === expected.registerIndex);
    if (matches.length !== 1 || matches[0].carbon?.name !== expected.name)
    {
      fail(`${expected.identity} must reflect ${expected.name}`);
    }
  }
  const samplerBindings = bindings.filter((entry) => entry?.kind === "sampler");
  if (record.backend === "dx12")
  {
    if (samplerBindings.length !== 0)
    {
      fail("DX12 analysis has unexpected static sampler reflection");
    }
    return;
  }
  if (samplerBindings.length !== 2)
  {
    fail("DX11 analysis must contain both static samplers");
  }
  const surface = samplerBindings.find((entry) => entry.registerIndex === 0)?.carbon?.sampler;
  const fog = samplerBindings.find((entry) => entry.registerIndex === 1)?.carbon?.sampler;
  if (!surface || surface.comparison !== false
    || surface.minFilter !== 3 || surface.magFilter !== 2 || surface.mipFilter !== 2
    || surface.addressU !== 1 || surface.addressV !== 1 || surface.addressW !== 3
    || surface.mipLODBias !== 0 || surface.maxAnisotropy !== 16
    || surface.isDynamic !== false)
  {
    fail("DX11 surface sampler has unexpected static state");
  }
  if (!fog || fog.comparison !== false
    || fog.minFilter !== 2 || fog.magFilter !== 2 || fog.mipFilter !== 2
    || fog.addressU !== 3 || fog.addressV !== 3 || fog.addressW !== 3
    || fog.mipLODBias !== 0 || fog.maxAnisotropy !== 16
    || fog.isDynamic !== false)
  {
    fail("DX11 fog sampler has unexpected static state");
  }
}

function assertBindings(record, pipeline, passIndex)
{
  const groups = pipeline?.bindGroups;
  if (!Array.isArray(groups) || groups.length !== 1 || groups[0]?.group !== 0)
  {
    fail(`Main.pass${passIndex} requires exactly canonical bind group 0`);
  }
  const bindings = groups[0].bindings;
  const resources = expectedResources(record.backend);
  const samplers = expectedSamplers();
  if (!Array.isArray(bindings)
    || bindings.length !== UNIFORMS.length + resources.length + samplers.length)
  {
    fail(`Main.pass${passIndex} requires exactly 14 canonical bindings`);
  }
  const byScope = new Map(bindings.map((entry) => [ entry.scopeIdentity, entry ]));
  if (byScope.size !== bindings.length)
  {
    fail(`Main.pass${passIndex} contains duplicate binding scopes`);
  }
  for (const expected of UNIFORMS)
  {
    const binding = byScope.get(expected.scopeIdentity);
    assertBindingSlot(binding, expected, "buffer", expected.visibility);
    if (binding.layout.buffer.type !== "uniform"
      || binding.layout.buffer.hasDynamicOffset !== false
      || binding.layout.buffer.minBindingSize !== expected.minBindingSize)
    {
      fail(`${expected.identity} has an unexpected uniform-buffer layout`);
    }
  }
  for (const expected of resources)
  {
    const binding = byScope.get(expected.scopeIdentity);
    assertBindingSlot(binding, expected, "texture", "fragment");
    if (binding.layout.texture.sampleType !== "float"
      || binding.layout.texture.viewDimension !== expected.viewDimension
      || binding.layout.texture.multisampled !== false)
    {
      fail(`${expected.identity} has an unexpected texture layout`);
    }
  }
  for (const expected of samplers)
  {
    const binding = byScope.get(expected.scopeIdentity);
    assertBindingSlot(binding, expected, "sampler", "fragment");
    if (binding.layout.sampler.type !== "filtering")
    {
      fail(`${expected.identity} has an unexpected sampler layout`);
    }
  }
  assertMaterialReflection(record, passIndex);
  assertAnalysisResources(record, passIndex, resources);
}

/**
 * Fail closed unless the record is the exact default, non-bindless,
 * PPT-disabled unpacked QuadGlassV5 package containing both Main passes.
 *
 * @param {object} record Resource provenance plus a pipeline descriptor.
 * @returns {object} The validated input record.
 */
export function validateQuadGlassV5PackageRecord(record)
{
  if (!record || typeof record !== "object") fail("package record is required");
  if (record.backend !== "dx11" && record.backend !== "dx12")
  {
    fail("package backend must be dx11 or dx12");
  }
  const analysisSource = normalizedPath(record.analysis?.source);
  const metadataSource = normalizedPath(record.metadata?.sourcePath);
  if (!analysisSource || analysisSource !== metadataSource
    || !analysisSource.includes(`/effect.${record.backend}/`))
  {
    fail(`package source provenance must match ${record.backend}`);
  }
  if (!analysisSource.endsWith(
    "/managed/space/spaceobject/v5/quad/unpacked_quadglassv5.sm_hi"
  ) && !analysisSource.endsWith(
    "/managed/space/spaceobject/v5/quad/unpacked_quadglassv5.sm_lo"
  ))
  {
    fail("package source must be the unpacked_quadglassv5 ship shader");
  }
  if (record.analysis?.bodyIndex !== TARGET_BODY_INDEX
    || record.metadata?.bodyIndex !== TARGET_BODY_INDEX)
  {
    fail(`package must resolve body index ${TARGET_BODY_INDEX}`);
  }
  assertSelections(record.analysis.selectedOptions, "analysis.selectedOptions");
  assertSelections(record.metadata.selectedOptions, "metadata.selectedOptions");
  const selection = record.metadata.wgslSelection;
  if (selection?.mode !== "explicit"
    || selection.techniqueName !== "Main" || selection.passIndex !== null
    || selection.completePasses !== true
    || !Array.isArray(selection.requestedStageNames)
    || selection.requestedStageNames.length !== 0
    || !Array.isArray(selection.selectedStageKeys)
    || selection.selectedStageKeys.length !== 4
    || !selection.selectedStageKeys.includes("Main.pass0.vertex")
    || !selection.selectedStageKeys.includes("Main.pass0.pixel")
    || !selection.selectedStageKeys.includes("Main.pass1.vertex")
    || !selection.selectedStageKeys.includes("Main.pass1.pixel"))
  {
    fail("package selection must contain both complete Main render passes");
  }
  const analysisPasses = record.analysis?.passes?.filter((entry) =>
    entry?.techniqueName === "Main");
  if (!Array.isArray(analysisPasses) || analysisPasses.length !== 2
    || analysisPasses[0].passIndex !== 0 || analysisPasses[0].renderStates !== 1
    || JSON.stringify(analysisPasses[0].states)
      !== JSON.stringify([ { state: 22, value: 3 } ])
    || analysisPasses[1].passIndex !== 1 || analysisPasses[1].renderStates !== 2
    || JSON.stringify(analysisPasses[1].states)
      !== JSON.stringify([ { state: 22, value: 2 } ]))
  {
    fail("analysis must retain the exact complementary Main cull states");
  }
  if (!Array.isArray(record.pipelines) || record.pipelines.length !== 2)
  {
    fail("package must expose exactly Main.pass0 and Main.pass1");
  }
  const expectedStates = [
    { renderStates: 1, states: [ { state: 22, value: 3 } ] },
    { renderStates: 2, states: [ { state: 22, value: 2 } ] }
  ];
  for (let passIndex = 0; passIndex < 2; passIndex += 1)
  {
    const pipeline = record.pipelines[passIndex];
    if (pipeline?.techniqueName !== "Main" || pipeline.passIndex !== passIndex
      || pipeline.renderStates !== expectedStates[passIndex].renderStates
      || JSON.stringify(pipeline.states) !== JSON.stringify(expectedStates[passIndex].states))
    {
      fail(`pipeline Main.pass${passIndex} has an unexpected complementary cull state`);
    }
    assertVertexInputs(record, passIndex);
    assertPixelInputs(record, passIndex);
    assertShaderModules(pipeline, passIndex);
    assertBindings(record, pipeline, passIndex);
  }
  for (const stageName of [ "vertex", "pixel" ])
  {
    const stageWgsl = record.pipelines.map((pipeline) =>
      pipeline.shaderModules.find((entry) => entry.stageName === stageName)?.wgsl);
    if (!stageWgsl[0] || stageWgsl[0] !== stageWgsl[1])
    {
      fail(`Main pass ${stageName} WGSL must be identical across complementary cull passes`);
    }
  }
  return record;
}

/**
 * Return backend-local binding identities for the shared semantic fixture.
 *
 * @param {object} record One validated QuadGlassV5 package record.
 * @returns {{textures: object[], samplers: object[]}} Frozen resource plan.
 */
export function getQuadGlassV5ResourcePlan(record)
{
  validateQuadGlassV5PackageRecord(record);
  return Object.freeze({
    textures: Object.freeze(expectedResources(record.backend)),
    samplers: Object.freeze(expectedSamplers())
  });
}

/**
 * Validate ordered and distinct DX11/DX12 records before claiming parity.
 *
 * @param {object[]} records Package records in DX11, DX12 order.
 * @returns {object[]} The validated input array.
 */
export function validateQuadGlassV5PackagePair(records)
{
  if (!Array.isArray(records) || records.length !== 2)
  {
    fail("comparison requires exactly one DX11 and one DX12 package");
  }
  records.forEach(validateQuadGlassV5PackageRecord);
  if (records[0].backend !== "dx11" || records[1].backend !== "dx12")
  {
    fail("comparison package order must be DX11 then DX12");
  }
  const physicalPaths = records.map((record) => normalizedPath(record.filePath));
  if (physicalPaths.some((value) => !value) || physicalPaths[0] === physicalPaths[1])
  {
    fail("comparison requires distinct physical package files");
  }
  const resourcePaths = records.map((record) => normalizedPath(record.resourcePath));
  if (resourcePaths.some((value) => !value) || resourcePaths[0] === resourcePaths[1])
  {
    fail("comparison requires distinct logical resource paths");
  }
  const payload = (record) => record.pipelines
    .flatMap((pipeline) => pipeline.shaderModules)
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((entry) => `${entry.key}:${entry.wgsl}`)
    .join("\n");
  if (payload(records[0]) === payload(records[1]))
  {
    fail("DX11 and DX12 packages contain identical WGSL payloads");
  }
  return records;
}

/**
 * Create deterministic synthetic geometry, semantic buffers, and textures for
 * the exact gb2-style QuadGlassV5 active binding contract.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @returns {object} Typed-array fixture values.
 */
export function createQuadGlassV5FixtureValues(width, height)
{
  const base = createQuadV5FixtureValues(width, height);
  const sourceVertexCount = base.vertices.length / 16;
  const vertices = new Float32Array(base.vertices.length * 2);
  for (let copy = 0; copy < 2; copy += 1)
  {
    const xOffset = copy === 0 ? -0.48 : 0.48;
    for (let index = 0; index < sourceVertexCount; index += 1)
    {
      const sourceOffset = index * 16;
      const targetOffset = (copy * sourceVertexCount + index) * 16;
      vertices.set(base.vertices.subarray(sourceOffset, sourceOffset + 16), targetOffset);
      vertices[targetOffset] = base.vertices[sourceOffset] * 0.45 + xOffset;
      vertices[targetOffset + 1] = base.vertices[sourceOffset + 1] * 0.8;
    }
  }
  const indices = new Uint16Array(base.indices.length * 2);
  indices.set(base.indices);
  for (let index = 0; index < base.indices.length; index += 3)
  {
    indices[base.indices.length + index] = base.indices[index] + sourceVertexCount;
    indices[base.indices.length + index + 1] = base.indices[index + 2] + sourceVertexCount;
    indices[base.indices.length + index + 2] = base.indices[index + 1] + sourceVertexCount;
  }
  const bindingValues = createQuadV5MainBindingValues(width, height);
  const surfaceNames = new Set([
    "EveSpaceSceneEnvMap",
    "NormalMap",
    "GlowMap",
    "RoughnessMap",
    "MaterialMap"
  ]);
  const textures = base.textures.filter((entry) => surfaceNames.has(entry.name));
  const environment = textures.find((entry) => entry.name === "EveSpaceSceneEnvMap");
  if (!environment) fail("shared QuadV5 fixture has no environment cube");
  const paintMask = (name, red) => Object.freeze({
    name,
    dimension: "2d",
    width: 1,
    height: 1,
    format: "rgba8unorm",
    bytesPerRow: 4,
    data: new Uint8Array([ red, 0, 0, 255 ])
  });
  const opaquePaintMask = paintMask("OpaquePaintMaskMap", 0);
  const transparentPaintMask = paintMask("TransparentPaintMaskMap", 255);
  const fogVolume = Object.freeze({
    name: "EveSceneFogVolumeMap",
    dimension: "2d-array",
    width: 1,
    height: 1,
    depthOrArrayLayers: 4,
    format: "rgba8unorm",
    data: new Uint8Array([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ])
  });
  return Object.freeze({
    vertices,
    indices,
    bindingValues: Object.freeze({
      ...bindingValues,
      perFramePS: Object.freeze({
        ...bindingValues.perFramePS,
        VolumetricSlices: [ 1, 2, 3, 4 ]
      })
    }),
    textures: Object.freeze([
      ...textures,
      opaquePaintMask,
      transparentPaintMask,
      fogVolume
    ]),
    samplers: Object.freeze([
      Object.freeze({
        name: "SurfaceSampler",
        minFilter: "linear",
        magFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat",
        addressModeW: "clamp-to-edge",
        maxAnisotropy: 16
      }),
      Object.freeze({
        name: "FogSampler",
        minFilter: "linear",
        magFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        maxAnisotropy: 16
      })
    ]),
    textureResourceVariants: Object.freeze({
      base: Object.freeze({
        PaintMaskMap: "OpaquePaintMaskMap"
      }),
      transparentPaint: Object.freeze({
        PaintMaskMap: "TransparentPaintMaskMap"
      })
    })
  });
}
