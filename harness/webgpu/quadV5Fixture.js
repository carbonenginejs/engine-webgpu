const TARGET_BODY_INDEX = 4;

export const QUADV5_TARGET_WIDTH = 64;
export const QUADV5_TARGET_HEIGHT = 64;

export const QUADV5_PPT_SELECTION = Object.freeze({
  BINDLESS_RENDERING: "BINDLESS_RENDERING_DISABLED",
  SPACE_OBJECT_CLIPPING: "SOC_DISABLED",
  SPACE_OBJECT_PPT_ENABLED: "SOPPT_ENABLED",
  SPACE_OBJECT_TRANSPARENCY: "SOT_OPAQUE",
  V5_DEBUG: "OFF",
  SPACE_OBJECT_INSTANCED_ATTACHMENT: "SOIA_DISABLED",
  BLEND_MODE: "BLEND_MODE_OVERLAY"
});

export const QUADV5_SKINNED_PPT_SELECTION = Object.freeze({
  BINDLESS_RENDERING: "BINDLESS_RENDERING_DISABLED",
  SPACE_OBJECT_CLIPPING: "SOC_DISABLED",
  SPACE_OBJECT_PPT_ENABLED: "SOPPT_ENABLED",
  SPACE_OBJECT_TRANSPARENCY: "SOT_OPAQUE",
  V5_DEBUG: "OFF",
  BLEND_MODE: "BLEND_MODE_OVERLAY"
});

export const QUADV5_SKINNED_HEAT_PPT_SELECTION = Object.freeze({
  BINDLESS_RENDERING: "BINDLESS_RENDERING_DISABLED",
  SPACE_OBJECT_CLIPPING: "SOC_DISABLED",
  SPACE_OBJECT_PPT_ENABLED: "SOPPT_ENABLED",
  SPACE_OBJECT_TRANSPARENCY: "SOT_OPAQUE",
  V5_DEBUG: "OFF"
});

export const QUADV5_SKINNED_HEAT_DETAIL_PPT_SELECTION =
  QUADV5_SKINNED_HEAT_PPT_SELECTION;

const SELECTION_PROVENANCE = Object.freeze({
  BINDLESS_RENDERING: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "BINDLESS_RENDERING_DISABLED" }),
  SPACE_OBJECT_CLIPPING: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOC_DISABLED" }),
  SPACE_OBJECT_PPT_ENABLED: Object.freeze({ optionIndex: 1, defaultOption: 0, defaultValue: "SOPPT_DISABLED" }),
  SPACE_OBJECT_TRANSPARENCY: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOT_OPAQUE" }),
  V5_DEBUG: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "OFF" }),
  SPACE_OBJECT_INSTANCED_ATTACHMENT: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOIA_DISABLED" }),
  BLEND_MODE: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "BLEND_MODE_OVERLAY" })
});

const BASE_UNIFORMS = Object.freeze([
  Object.freeze({ identity: "uniform-buffer:0:0", binding: 0, visibility: "fragment", minBindingSize: 384 }),
  Object.freeze({ identity: "uniform-buffer:0:1", binding: 1, visibility: "vertex", minBindingSize: 512 }),
  Object.freeze({ identity: "uniform-buffer:0:2", binding: 2, visibility: "fragment", minBindingSize: 352 }),
  Object.freeze({ identity: "uniform-buffer:0:3", binding: 3, visibility: "vertex", minBindingSize: 416 }),
  Object.freeze({ identity: "uniform-buffer:0:4", binding: 4, visibility: "fragment", minBindingSize: 432 })
]);

const RESOURCE_NAMES = Object.freeze([
  "EveSpaceSceneEnvMap",
  "SSAOMap",
  "EveSpaceSceneShadowMap",
  "NormalMap",
  "GlowMap",
  "AlbedoMap",
  "RoughnessMap",
  "MaterialMap",
  "PaintMaskMap",
  "PatternMask1Map",
  "PatternMask2Map"
]);

const RESOURCE_REGISTERS = Object.freeze({
  dx11: Object.freeze([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]),
  dx12: Object.freeze([ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12 ])
});

const HEAT_DETAIL_RESOURCE_NAMES = Object.freeze([
  ...RESOURCE_NAMES,
  "HeatGlowNoiseMap",
  "Detail1Map",
  "Detail2Map"
]);

const HEAT_RESOURCE_NAMES = Object.freeze([
  ...RESOURCE_NAMES,
  "HeatGlowNoiseMap"
]);

const HEAT_DETAIL_RESOURCE_REGISTERS = Object.freeze({
  dx11: Object.freeze([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 ]),
  dx12: Object.freeze([ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15 ])
});

const HEAT_RESOURCE_REGISTERS = Object.freeze({
  dx11: Object.freeze([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]),
  dx12: Object.freeze([ 0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13 ])
});

const HEAT_DETAIL_VERTEX_INPUTS = Object.freeze([
  Object.freeze({ usageName: "POSITION", usageIndex: 0, registerIndex: 0, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "BLENDINDICES", usageIndex: 0, registerIndex: 1, usedMask: 1, type: 2, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 0, registerIndex: 2, usedMask: 3, type: 0, dimension: 2 }),
  Object.freeze({ usageName: "NORMAL", usageIndex: 0, registerIndex: 3, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "TANGENT", usageIndex: 0, registerIndex: 4, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "BITANGENT", usageIndex: 0, registerIndex: 5, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 1, registerIndex: 6, usedMask: 3, type: 0, dimension: 2 })
]);

const HEAT_DETAIL_PIXEL_INPUTS = Object.freeze([
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 0, registerIndex: 1, usedMask: 3, type: 0, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 1, registerIndex: 2, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 2, registerIndex: 3, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 3, registerIndex: 4, usedMask: 7, type: 0, dimension: 3 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 4, registerIndex: 5, usedMask: 15, type: 0, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 5, registerIndex: 6, usedMask: 0, type: 0, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 6, registerIndex: 7, usedMask: 15, type: 0, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 8, registerIndex: 8, usedMask: 0, type: 0, dimension: 4 }),
  Object.freeze({ usageName: "TEXCOORD", usageIndex: 9, registerIndex: 9, usedMask: 11, type: 0, dimension: 4 })
]);

const HEAT_DETAIL_WGSL_STRUCTS = Object.freeze({
  VertexInput: Object.freeze([
    "@location(0) input0: vec3<f32>",
    "@location(1) input1: vec4<u32>",
    "@location(2) input2: vec2<f32>",
    "@location(3) input3: vec3<f32>",
    "@location(4) input4: vec3<f32>",
    "@location(5) input5: vec3<f32>",
    "@location(6) input6: vec2<f32>"
  ]),
  VertexOutput: Object.freeze([
    "@invariant @builtin(position) position: vec4<f32>",
    "@location(1) output1: vec4<f32>",
    "@location(2) output2: vec3<f32>",
    "@location(3) output3: vec3<f32>",
    "@location(4) output4: vec3<f32>",
    "@location(5) output5: vec4<f32>",
    "@location(6) output6: vec4<f32>",
    "@location(7) output7: vec4<f32>",
    "@location(8) output8: vec4<f32>",
    "@location(9) output9: vec4<f32>"
  ]),
  FragmentInput: Object.freeze([
    "@builtin(position) position: vec4<f32>",
    "@location(1) input1: vec4<f32>",
    "@location(2) input2: vec3<f32>",
    "@location(3) input3: vec3<f32>",
    "@location(4) input4: vec3<f32>",
    "@location(5) input5: vec4<f32>",
    "@location(7) input7: vec4<f32>",
    "@location(9) input9: vec4<f32>"
  ]),
  FragmentOutput: Object.freeze([
    "@location(0) output0: vec4<f32>",
    "@location(1) output1: vec4<f32>"
  ])
});

const SAMPLER_NAMES = Object.freeze([
  "Sampler0",
  "PatternMask1MapSampler",
  "PatternMask2MapSampler"
]);

export const QUADV5_VERTEX_BUFFER_LAYOUT = Object.freeze({
  arrayStride: 64,
  attributes: Object.freeze([
    Object.freeze({ shaderLocation: 0, offset: 0, format: "float32x3" }),
    Object.freeze({ shaderLocation: 2, offset: 12, format: "float32x2" }),
    Object.freeze({ shaderLocation: 3, offset: 20, format: "float32x3" }),
    Object.freeze({ shaderLocation: 4, offset: 32, format: "float32x3" }),
    Object.freeze({ shaderLocation: 5, offset: 44, format: "float32x3" }),
    Object.freeze({ shaderLocation: 6, offset: 56, format: "float32x2" })
  ])
});

export const QUADV5_SKINNED_VERTEX_BUFFER_LAYOUT = Object.freeze({
  arrayStride: 8,
  attributes: Object.freeze([
    Object.freeze({ shaderLocation: 1, offset: 0, format: "uint16x4" })
  ])
});

export const QUADV5_CLEAR_TARGETS = Object.freeze([
  Object.freeze([ 0, 255, 0, 255 ]),
  Object.freeze([ 255, 0, 255, 255 ])
]);

function fail(message)
{
  throw new Error(`QuadV5 PPT fixture: ${message}`);
}

function assertSelections(options, owner, expectedSelection)
{
  if (!Array.isArray(options) || options.length !== Object.keys(expectedSelection).length)
  {
    fail(`${owner} must contain every permutation selection for this QuadV5 variant`);
  }
  const selected = new Map();
  for (const entry of options)
  {
    if (typeof entry?.name !== "string" || selected.has(entry.name))
    {
      fail(`${owner} has malformed or duplicate selections`);
    }
    selected.set(entry.name, entry.value);
  }
  for (const [ name, value ] of Object.entries(expectedSelection))
  {
    if (!selected.has(name)) fail(`${owner} is missing ${name}`);
    const entry = options.find((candidate) => candidate.name === name);
    const provenance = SELECTION_PROVENANCE[name];
    if (entry.value !== value) fail(`${owner} requires ${name}=${value}`);
    if (entry.optionIndex !== provenance.optionIndex || entry.defaultOption !== provenance.defaultOption
      || entry.defaultValue !== provenance.defaultValue || entry.source !== "local")
    {
      fail(`${owner} has unexpected provenance for ${name}`);
    }
  }
}

function normalizedPath(value)
{
  return typeof value === "string" ? value.replace(/\\/gu, "/").toLowerCase() : "";
}

function interfaceInput(entry)
{
  return {
    usageName: entry?.usageName,
    usageIndex: entry?.usageIndex,
    registerIndex: entry?.registerIndex,
    usedMask: entry?.usedMask,
    type: entry?.type,
    dimension: entry?.dimension
  };
}

function assertVertexInputs(analysis, skinned, strictHeat)
{
  const stage = analysis.stages?.find((entry) =>
    entry?.techniqueName === "Main" && entry.passIndex === 0 && entry.stageName === "vertex");
  if (!stage) fail("analysis has no Main.pass0.vertex stage");
  if (strictHeat)
  {
    const inputs = (stage.pipelineInputs || []).map(interfaceInput);
    if (JSON.stringify(inputs) !== JSON.stringify(HEAT_DETAIL_VERTEX_INPUTS))
    {
      fail("Main.pass0.vertex has an unexpected skinned-heat used-mask interface");
    }
    return;
  }
  const active = (stage.pipelineInputs || [])
    .filter((entry) => entry.usedMask !== 0)
    .map(({ registerIndex, dimension, type }) => ({ registerIndex, dimension, type }))
    .sort((left, right) => left.registerIndex - right.registerIndex);
  const expected = [
    { registerIndex: 0, dimension: 3, type: 0 },
    ...(skinned ? [ { registerIndex: 1, dimension: 4, type: 2 } ] : []),
    { registerIndex: 2, dimension: 2, type: 0 },
    { registerIndex: 3, dimension: 3, type: 0 },
    { registerIndex: 4, dimension: 3, type: 0 },
    { registerIndex: 5, dimension: 3, type: 0 },
    { registerIndex: 6, dimension: 2, type: 0 }
  ];
  if (JSON.stringify(active) !== JSON.stringify(expected))
  {
    fail("Main.pass0.vertex has an unexpected active input contract");
  }
}

function assertHeatDetailWgslStruct(wgsl, name)
{
  const match = new RegExp(`struct\\s+${name}\\s*\\{([\\s\\S]*?)\\};`, "u").exec(wgsl);
  if (!match) fail(`WGSL is missing exact ${name}`);
  const fields = match[1].split(/\r?\n/u)
    .map((line) => line.trim().replace(/,$/u, ""))
    .filter(Boolean);
  if (JSON.stringify(fields) !== JSON.stringify(HEAT_DETAIL_WGSL_STRUCTS[name]))
  {
    fail(`WGSL has an unexpected ${name} contract`);
  }
}

function assertShaderModules(pipeline, skinned, strictHeat)
{
  if (!Array.isArray(pipeline.shaderModules) || pipeline.shaderModules.length !== 2)
  {
    fail("Main.pass0 requires exactly vertex and pixel modules");
  }
  for (const stageName of [ "vertex", "pixel" ])
  {
    const matches = pipeline.shaderModules.filter((entry) => entry?.stageName === stageName);
    if (matches.length !== 1 || typeof matches[0].wgsl !== "string" || !matches[0].wgsl
      || matches[0].key !== `Main.pass0.${stageName}`
      || matches[0].techniqueName !== "Main" || matches[0].passIndex !== 0
      || matches[0].stageType !== (stageName === "vertex" ? 0 : 1)
      || matches[0].entryPoint !== "main")
    {
      fail(`Main.pass0 requires one complete ${stageName} module`);
    }
    if (stageName === "vertex")
    {
      for (const location of [ 0, ...(skinned ? [ 1 ] : []), 2, 3, 4, 5, 6 ])
      {
        if (!new RegExp(`@location\\(${location}\\)\\s+input${location}:`, "u").test(matches[0].wgsl))
        {
          fail(`vertex WGSL is missing location ${location}`);
        }
      }
    }
    else if (!/@location\(0\)\s+output0:/u.test(matches[0].wgsl)
      || !/@location\(1\)\s+output1:/u.test(matches[0].wgsl))
    {
      fail("pixel WGSL must expose both QuadV5 render targets");
    }
    if (strictHeat)
    {
      for (const name of stageName === "vertex"
        ? [ "VertexInput", "VertexOutput" ]
        : [ "FragmentInput", "FragmentOutput" ])
      {
        assertHeatDetailWgslStruct(matches[0].wgsl, name);
      }
    }
  }
}

function assertHeatMainInventory(record)
{
  const stages = record.analysis?.stages?.filter((entry) => entry?.techniqueName === "Main");
  const expectedStages = [
    { key: "Main.pass0.vertex", passIndex: 0, stageName: "vertex", stageType: 0 },
    { key: "Main.pass0.pixel", passIndex: 0, stageName: "pixel", stageType: 1 }
  ];
  if (!Array.isArray(stages) || stages.length !== expectedStages.length)
  {
    fail("analysis must expose exactly the skinned-heat Main.pass0 stage pair");
  }
  for (let index = 0; index < expectedStages.length; index += 1)
  {
    const stage = stages[index];
    const expected = expectedStages[index];
    if (stage?.key !== expected.key || stage.passIndex !== expected.passIndex
      || stage.stageName !== expected.stageName || stage.stageType !== expected.stageType)
    {
      fail("analysis has an unexpected skinned-heat Main stage inventory");
    }
  }
  const passes = record.analysis?.passes?.filter((entry) => entry?.techniqueName === "Main");
  if (!Array.isArray(passes) || passes.length !== 1 || passes[0].passIndex !== 0
    || passes[0].renderStates !== 1 || JSON.stringify(passes[0].states) !== "[]")
  {
    fail("analysis must expose the exact skinned-heat Main.pass0 render state");
  }
  if (record.pipeline?.renderStates !== 1 || JSON.stringify(record.pipeline.states) !== "[]")
  {
    fail("pipeline must expose the exact skinned-heat Main.pass0 render state");
  }
  const pixel = stages[1];
  const pixelInputs = (pixel.pipelineInputs || []).map(interfaceInput);
  if (JSON.stringify(pixelInputs) !== JSON.stringify(HEAT_DETAIL_PIXEL_INPUTS))
  {
    fail("Main.pass0.pixel has an unexpected skinned-heat used-mask interface");
  }
}

function requiredUniforms(skinned, heat, heatDetail)
{
  return BASE_UNIFORMS.map((entry) => Object.freeze({
    ...entry,
    scopeIdentity: `${entry.identity}@${entry.visibility}`,
    ...(heatDetail && entry.identity === "uniform-buffer:0:0" ? { minBindingSize: 640 } : {}),
    ...(heat && entry.identity === "uniform-buffer:0:0" ? { minBindingSize: 464 } : {}),
    ...(skinned && entry.identity === "uniform-buffer:0:3" ? { minBindingSize: 432 } : {})
  }));
}

function expectedBoneBinding()
{
  return Object.freeze({
    name: "BoneTransforms",
    identity: "sampled-resource:0:0",
    scopeIdentity: "sampled-resource:0:0@vertex",
    registerIndex: 0,
    binding: 5
  });
}

function expectedResourceBindings(backend, skinned, heat, heatDetail)
{
  const registerTable = heatDetail
    ? HEAT_DETAIL_RESOURCE_REGISTERS
    : (heat ? HEAT_RESOURCE_REGISTERS : RESOURCE_REGISTERS);
  const registers = registerTable[backend];
  if (!registers) fail(`unsupported package backend ${String(backend)}`);
  const names = heatDetail
    ? HEAT_DETAIL_RESOURCE_NAMES
    : (heat ? HEAT_RESOURCE_NAMES : RESOURCE_NAMES);
  return names.map((name, index) => Object.freeze({
    name,
    identity: `sampled-resource:0:${registers[index]}`,
    scopeIdentity: `sampled-resource:0:${registers[index]}@fragment`,
    registerIndex: registers[index],
    binding: (skinned ? 6 : 5) + index,
    viewDimension: index === 0 ? "cube" : "2d",
    registerType: index === 0 ? 41 : 36,
    carbonType: index === 0 ? 4 : 2,
    arrayElements: 1,
    isSRGB: index === 0 || name === "AlbedoMap",
    isAutoregister: name === "EveSpaceSceneShadowMap"
  }));
}

function expectedSamplerBindings(skinned, heat, heatDetail)
{
  return SAMPLER_NAMES.map((name, registerIndex) => Object.freeze({
    name,
    identity: `sampler:0:${registerIndex}`,
    scopeIdentity: `sampler:0:${registerIndex}@fragment`,
    registerIndex,
    binding: (heatDetail ? 20 : (heat ? 18 : (skinned ? 17 : 16))) + registerIndex
  }));
}

const HEAT_DETAIL_MATERIAL_CONSTANTS = Object.freeze([
  [ "GeneralData", 0 ],
  [ "Mtl1DiffuseColor", 32 ],
  [ "Mtl2DiffuseColor", 48 ],
  [ "Mtl3DiffuseColor", 64 ],
  [ "Mtl4DiffuseColor", 80 ],
  [ "Mtl1FresnelColor", 96 ],
  [ "Mtl2FresnelColor", 112 ],
  [ "Mtl3FresnelColor", 128 ],
  [ "Mtl4FresnelColor", 144 ],
  [ "Mtl1Gloss", 160 ],
  [ "Mtl2Gloss", 176 ],
  [ "Mtl3Gloss", 192 ],
  [ "Mtl4Gloss", 208 ],
  [ "PMtl1DiffuseColor", 288 ],
  [ "PMtl1FresnelColor", 304 ],
  [ "PMtl1Gloss", 320 ],
  [ "PMtl2DiffuseColor", 336 ],
  [ "PMtl2FresnelColor", 352 ],
  [ "PMtl2Gloss", 368 ],
  [ "Mtl1HeatGlowData", 384 ],
  [ "Mtl2HeatGlowData", 400 ],
  [ "Mtl3HeatGlowData", 416 ],
  [ "Mtl4HeatGlowData", 432 ],
  [ "GeneralHeatGlowColor", 448 ],
  [ "Detail1Data", 464 ],
  [ "Detail2Data", 480 ],
  [ "SecondaryDetail2Data", 496 ],
  [ "Detail3Data", 512 ],
  [ "DetailAlbedoColor", 528 ],
  [ "DetailFresnelColor", 544 ],
  [ "DetailSelector", 624 ]
]);

const HEAT_MATERIAL_CONSTANTS = Object.freeze(
  HEAT_DETAIL_MATERIAL_CONSTANTS.slice(0, 24)
);

function assertHeatMaterial(record, heatDetail)
{
  const vertex = record.analysis.stages.find((entry) =>
    entry?.techniqueName === "Main"
      && entry.passIndex === 0
      && entry.stageName === "vertex");
  const pixel = record.analysis.stages.find((entry) =>
    entry?.techniqueName === "Main"
      && entry.passIndex === 0
      && entry.stageName === "pixel");
  const vertexBuffers = vertex?.bindings?.filter((entry) => entry?.kind === "constantBuffer");
  const pixelBuffers = pixel?.bindings?.filter((entry) => entry?.kind === "constantBuffer");
  if (JSON.stringify(vertexBuffers?.map((entry) => entry.registerIndex)) !== "[1,3]"
    || JSON.stringify(pixelBuffers?.map((entry) => entry.registerIndex)) !== "[0,2,4]")
  {
    fail("Main.pass0 must expose the exact skinned-heat constant-buffer inventory");
  }
  for (const entry of [ ...vertexBuffers, ...pixelBuffers ])
  {
    const local = entry.registerIndex === 0;
    if (entry.registerType !== 0 || entry.registerSpace !== 0
      || entry.generatedSymbol !== `cb${entry.registerIndex}`
      || entry.registerCount !== 1 || entry.arrayCount !== 1 || entry.dynamic !== true
      || entry.metadataName !== (local ? "$LocalConstants" : null)
      || entry.carbon?.hasLocalConstants !== local
      || (!local && (entry.carbon.constantValueSize !== 0
        || JSON.stringify(entry.carbon.constants) !== "[]")))
    {
      fail(`Main.pass0 cb${entry.registerIndex} has unexpected skinned-heat metadata`);
    }
  }
  const material = pixelBuffers.filter((entry) => entry.registerIndex === 0);
  const size = heatDetail ? 640 : 464;
  const expectedConstants = heatDetail
    ? HEAT_DETAIL_MATERIAL_CONSTANTS
    : HEAT_MATERIAL_CONSTANTS;
  if (!Array.isArray(material) || material.length !== 1
    || material[0].carbon?.hasLocalConstants !== true
    || material[0].carbon?.constantValueSize !== size)
  {
    fail(`pixel cb0 must expose the exact ${size}-byte skinned-heat material layout`);
  }
  const constants = material[0].carbon.constants;
  if (!Array.isArray(constants) || constants.length !== expectedConstants.length)
  {
    fail("pixel cb0 has an unexpected skinned-heat constant count");
  }
  for (let index = 0; index < expectedConstants.length; index += 1)
  {
    const [ name, offset ] = expectedConstants[index];
    const constant = constants[index];
    if (constant?.name !== name || constant.offset !== offset || constant.size !== 16
      || constant.dimension !== 4 || constant.type !== 0 || constant.elements !== 0)
    {
      fail(`pixel cb0 has an unexpected ${name} layout`);
    }
  }
}

function hasExactSamplerState(state, isDynamic)
{
  return state?.comparison === false
    && state.minFilter === 3 && state.magFilter === 2 && state.mipFilter === 2
    && state.addressU === 1 && state.addressV === 1 && state.addressW === 3
    && state.mipLODBias === 0 && state.maxAnisotropy === 16
    && state.isDynamic === isDynamic;
}

function assertAnalysisResources(record, resources, samplers, skinned, strictHeat)
{
  const pixel = record.analysis?.stages?.filter((entry) =>
    entry?.techniqueName === "Main" && entry.passIndex === 0 && entry.stageName === "pixel");
  if (!Array.isArray(pixel) || pixel.length !== 1)
  {
    fail("analysis must contain exactly one Main.pass0.pixel stage");
  }
  const vertex = record.analysis?.stages?.filter((entry) =>
    entry?.techniqueName === "Main" && entry.passIndex === 0 && entry.stageName === "vertex");
  if (!Array.isArray(vertex) || vertex.length !== 1)
  {
    fail("analysis must contain exactly one Main.pass0.vertex stage");
  }
  const vertexBindings = Array.isArray(vertex[0].bindings) ? vertex[0].bindings : [];
  const boneBindings = vertexBindings.filter((entry) => entry?.kind === "resource"
    && entry.registerSpace === 0 && entry.registerIndex === 0
    && entry.carbon?.name === "BoneTransforms");
  if ((skinned && boneBindings.length !== 1) || (!skinned && boneBindings.length !== 0))
  {
    fail("vertex t0 BoneTransforms reflection does not match the QuadV5 variant");
  }
  if (strictHeat)
  {
    const vertexResources = vertexBindings.filter((entry) => entry?.kind === "resource");
    const bone = boneBindings[0];
    if (vertexResources.length !== 1 || bone?.registerType !== 33
      || bone.carbon?.type !== 7 || bone.carbon?.arrayElements !== 1
      || bone.carbon?.isSRGB !== false || bone.carbon?.isAutoregister !== false)
    {
      fail("vertex t0 BoneTransforms has unexpected skinned-heat Carbon metadata");
    }
  }
  const bindings = Array.isArray(pixel[0].bindings) ? pixel[0].bindings : [];
  if (strictHeat
    && bindings.filter((entry) => entry?.kind === "resource").length !== resources.length)
  {
    fail("pixel resources must match the exact skinned-heat inventory");
  }
  for (const expected of resources)
  {
    const matches = bindings.filter((entry) => entry?.kind === "resource"
      && entry.registerSpace === 0 && entry.registerIndex === expected.registerIndex);
    if (matches.length !== 1 || matches[0].carbon?.name !== expected.name)
    {
      fail(`${expected.identity} must reflect ${expected.name}`);
    }
    if (strictHeat)
    {
      const reflected = matches[0];
      if (reflected.registerType !== expected.registerType
        || reflected.carbon?.type !== expected.carbonType
        || reflected.carbon?.arrayElements !== expected.arrayElements
        || reflected.carbon?.isSRGB !== expected.isSRGB
        || reflected.carbon?.isAutoregister !== expected.isAutoregister)
      {
        fail(`${expected.identity} has unexpected skinned-heat Carbon metadata`);
      }
    }
  }
  const reflectedSamplers = bindings.filter((entry) => entry?.kind === "sampler");
  const expectedSamplerCount = record.backend === "dx12" ? samplers.length - 1 : samplers.length;
  if (strictHeat && reflectedSamplers.length !== expectedSamplerCount)
  {
    fail("pixel samplers must match the exact skinned-heat inventory");
  }
  for (const expected of samplers)
  {
    const matches = bindings.filter((entry) => entry?.kind === "sampler"
      && entry.registerSpace === 0 && entry.registerIndex === expected.registerIndex);
    if (expected.registerIndex === 0 && record.backend === "dx12")
    {
      if (matches.length !== 0) fail(`${expected.identity} has unexpected DX12 sampler reflection`);
      continue;
    }
    const reflectedName = matches[0]?.carbon?.name ?? null;
    const expectedName = expected.registerIndex === 0 ? null : expected.name;
    if (matches.length !== 1 || reflectedName !== expectedName)
    {
      fail(`${expected.identity} has unexpected sampler reflection`);
    }
    if (expected.registerIndex === 0 || strictHeat)
    {
      const state = matches[0].carbon?.sampler;
      const isDynamic = expected.registerIndex !== 0;
      if (!hasExactSamplerState(state, isDynamic))
      {
        fail(`${expected.identity} has unexpected ${isDynamic ? "dynamic" : "static"} sampler state`);
      }
    }
  }
}

function assertBindingSlot(binding, expected, kind, visibility)
{
  const [ expectedResourceKind, expectedRegisterSpace, expectedRegisterIndex ] = expected.identity.split(":");
  if (!binding || binding.identity !== expected.identity
    || binding.scopeIdentity !== expected.scopeIdentity
    || binding.resourceKind !== expectedResourceKind
    || binding.registerSpace !== Number(expectedRegisterSpace)
    || binding.registerIndex !== Number(expectedRegisterIndex)
    || binding.sourceTruth !== "wgsl-layout" || binding.group !== 0
    || binding.binding !== expected.binding || binding.dynamic !== false
    || !Array.isArray(binding.visibility) || binding.visibility.length !== 1
    || binding.visibility[0] !== visibility)
  {
    fail(`${expected.identity} has an unexpected slot, scope, register, or visibility`);
  }
  const layout = binding.layout || {};
  const kinds = [ "buffer", "texture", "sampler" ].filter((key) => layout[key]);
  if (kinds.length !== 1 || kinds[0] !== kind)
  {
    fail(`${expected.identity} has an unexpected layout kind`);
  }
}

function assertBindings(record)
{
  const pipeline = record.pipeline;
  if (!Array.isArray(pipeline.bindGroups) || pipeline.bindGroups.length !== 1
    || pipeline.bindGroups[0]?.group !== 0)
  {
    fail("Main.pass0 requires exactly canonical bind group 0");
  }
  const skinned = record.variant === "skinned";
  const heat = record.variant === "skinnedHeat";
  const heatDetail = record.variant === "skinnedHeatDetail";
  const strictHeat = heat || heatDetail;
  const usesSkinning = skinned || strictHeat;
  const uniforms = requiredUniforms(usesSkinning, heat, heatDetail);
  const bone = usesSkinning ? expectedBoneBinding() : null;
  const resources = expectedResourceBindings(record.backend, usesSkinning, heat, heatDetail);
  const samplers = expectedSamplerBindings(usesSkinning, heat, heatDetail);
  const expectedCount = uniforms.length + (bone ? 1 : 0) + resources.length + samplers.length;
  const bindings = pipeline.bindGroups[0].bindings;
  if (!Array.isArray(bindings) || bindings.length !== expectedCount)
  {
    fail(`Main.pass0 requires exactly ${expectedCount} canonical bindings`);
  }
  const byScope = new Map(bindings.map((entry) => [ entry.scopeIdentity, entry ]));
  if (byScope.size !== bindings.length) fail("Main.pass0 contains duplicate binding scopes");

  for (const expected of uniforms)
  {
    const binding = byScope.get(expected.scopeIdentity);
    assertBindingSlot(binding, expected, "buffer", expected.visibility);
    if (binding.layout.buffer.type !== "uniform" || binding.layout.buffer.hasDynamicOffset !== false
      || binding.layout.buffer.minBindingSize !== expected.minBindingSize)
    {
      fail(`${expected.identity} has an unexpected uniform-buffer layout`);
    }
  }
  if (bone)
  {
    const binding = byScope.get(bone.scopeIdentity);
    assertBindingSlot(binding, bone, "buffer", "vertex");
    if (binding.resourceKind !== "sampled-resource"
      || binding.layout.buffer.type !== "read-only-storage"
      || binding.layout.buffer.hasDynamicOffset !== false
      || binding.layout.buffer.minBindingSize !== 48
      || binding.structureStride !== 48)
    {
      fail("BoneTransforms has an unexpected read-only storage layout");
    }
  }
  for (const expected of resources)
  {
    const binding = byScope.get(expected.scopeIdentity);
    assertBindingSlot(binding, expected, "texture", "fragment");
    if (binding.layout.texture.sampleType !== "float"
      || binding.layout.texture.viewDimension !== expected.viewDimension
      || binding.layout.texture.multisampled !== false
      || binding.layout.type !== `texture_${expected.viewDimension}<f32>`
      || binding.textureKind !== expected.viewDimension
      || binding.arrayElements !== 1
      || binding.isSRGB !== expected.isSRGB)
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
  assertAnalysisResources(record, resources, samplers, usesSkinning, strictHeat);
  if (strictHeat) assertHeatMaterial(record, heatDetail);
}

/**
 * Fail closed unless a resource-loaded package is the exact PPT-on unpacked
 * QuadV5 body and exposes the current full Main.pass0 contract.
 *
 * @param {object} record Resource provenance plus a pipeline descriptor.
 * @returns {object} The validated input record.
 */
export function validateQuadV5PackageRecord(record)
{
  if (!record || typeof record !== "object") fail("package record is required");
  if (record.backend !== "dx11" && record.backend !== "dx12") fail("package backend must be dx11 or dx12");
  const variant = record.variant ?? "static";
  if (variant !== "static" && variant !== "skinned"
    && variant !== "skinnedHeat" && variant !== "skinnedHeatDetail")
  {
    fail("package variant must be static, skinned, skinnedHeat, or skinnedHeatDetail");
  }
  const skinned = variant !== "static";
  const heat = variant === "skinnedHeat";
  const heatDetail = variant === "skinnedHeatDetail";
  const strictHeat = heat || heatDetail;
  const expectedSelection = heat
    ? QUADV5_SKINNED_HEAT_PPT_SELECTION
    : (heatDetail
      ? QUADV5_SKINNED_HEAT_DETAIL_PPT_SELECTION
      : (skinned ? QUADV5_SKINNED_PPT_SELECTION : QUADV5_PPT_SELECTION));
  const analysisSource = normalizedPath(record.analysis?.source);
  const metadataSource = normalizedPath(record.metadata?.sourcePath);
  const backendMarker = `/effect.${record.backend}/`;
  if (!analysisSource || analysisSource !== metadataSource || !analysisSource.includes(backendMarker))
  {
    fail(`package source provenance must match ${record.backend}`);
  }
  const expectedStem = heatDetail
    ? "unpackedskinned_quadheatdetailv5"
    : (heat
      ? "unpackedskinned_quadheatv5"
      : (skinned ? "unpackedskinned_quadv5" : "unpacked_quadv5"));
  const highQualitySuffix = `/managed/space/spaceobject/v5/quad/${expectedStem}.sm_hi`;
  const lowQualitySuffix = `/managed/space/spaceobject/v5/quad/${expectedStem}.sm_lo`;
  if (strictHeat
    ? !analysisSource.endsWith(highQualitySuffix)
    : (!analysisSource.endsWith(highQualitySuffix) && !analysisSource.endsWith(lowQualitySuffix)))
  {
    fail(`package source must be the ${expectedStem} ship shader`);
  }
  if (record.analysis?.bodyIndex !== TARGET_BODY_INDEX || record.metadata?.bodyIndex !== TARGET_BODY_INDEX)
  {
    fail(`package must resolve body index ${TARGET_BODY_INDEX}`);
  }
  assertSelections(record.analysis.selectedOptions, "analysis.selectedOptions", expectedSelection);
  assertSelections(record.metadata.selectedOptions, "metadata.selectedOptions", expectedSelection);
  const selection = record.metadata.wgslSelection;
  if (selection?.mode !== "explicit"
    || selection.techniqueName !== "Main" || selection.passIndex !== 0
    || selection.completePasses !== true
    || !Array.isArray(selection.requestedStageNames)
    || selection.requestedStageNames.length !== 2
    || selection.requestedStageNames[0] !== "vertex"
    || selection.requestedStageNames[1] !== "pixel"
    || !Array.isArray(selection.selectedStageKeys)
    || selection.selectedStageKeys.length !== 2
    || selection.selectedStageKeys[0] !== "Main.pass0.vertex"
    || selection.selectedStageKeys[1] !== "Main.pass0.pixel")
  {
    fail("package selection must be the complete Main.pass0 vertex/pixel pair");
  }
  if (record.pipeline?.techniqueName !== "Main" || record.pipeline.passIndex !== 0)
  {
    fail("pipeline must be Main.pass0");
  }
  if (strictHeat) assertHeatMainInventory(record);
  assertVertexInputs(record.analysis, skinned, strictHeat);
  assertShaderModules(record.pipeline, skinned, strictHeat);
  assertBindings(record);
  return record;
}

/**
 * Return the validated backend-local binding identities for the shared
 * semantic fixture resources.
 *
 * @param {object} record One exact unpacked QuadV5 package record.
 * @returns {{textures: object[], samplers: object[]}} Frozen resource plan.
 */
export function getQuadV5ResourcePlan(record)
{
  validateQuadV5PackageRecord(record);
  const skinned = record.variant === "skinned";
  const heat = record.variant === "skinnedHeat";
  const heatDetail = record.variant === "skinnedHeatDetail";
  const strictHeat = heat || heatDetail;
  const usesSkinning = skinned || strictHeat;
  return Object.freeze({
    storage: usesSkinning ? Object.freeze([ expectedBoneBinding() ]) : Object.freeze([]),
    textures: Object.freeze(expectedResourceBindings(record.backend, usesSkinning, heat, heatDetail)),
    samplers: Object.freeze(expectedSamplerBindings(usesSkinning, heat, heatDetail))
  });
}

/**
 * Validate the ordered, distinct DX11/DX12 records before claiming parity.
 *
 * @param {object[]} records Package records in DX11, DX12 order.
 * @returns {object[]} The validated input array.
 */
export function validateQuadV5PackagePair(records)
{
  if (!Array.isArray(records) || records.length !== 2)
  {
    fail("comparison requires exactly one DX11 and one DX12 package");
  }
  records.forEach(validateQuadV5PackageRecord);
  if (records[0].backend !== "dx11" || records[1].backend !== "dx12")
  {
    fail("comparison package order must be DX11 then DX12");
  }
  if ((records[0].variant ?? "static") !== (records[1].variant ?? "static"))
  {
    fail("comparison package variants must match");
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
  const shaderPayload = (record) => record.pipeline.shaderModules
    .slice()
    .sort((left, right) => left.stageName.localeCompare(right.stageName))
    .map((entry) => `${entry.stageName}:${entry.wgsl}`)
    .join("\n");
  if (shaderPayload(records[0]) === shaderPayload(records[1]))
  {
    fail("DX11 and DX12 packages contain identical WGSL payloads");
  }
  return records;
}

function identityMatrix()
{
  const result = new Float32Array(16);
  result[0] = 1;
  result[5] = 1;
  result[10] = 1;
  result[15] = 1;
  return result;
}

function identityMatrices(count)
{
  const result = new Float32Array(count * 16);
  for (let index = 0; index < count; index += 1)
  {
    result[index * 16] = 1;
    result[index * 16 + 5] = 1;
    result[index * 16 + 10] = 1;
    result[index * 16 + 15] = 1;
  }
  return result;
}

function zeros(count)
{
  return new Float32Array(count);
}

/**
 * Create explicit authored values for every field in the bounded Carbon
 * space-object Main ABI. They are not sourced from SOF, and no production
 * defaults are inferred.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @returns {object} Plain semantic fixture values.
 */
export function createQuadV5MainBindingValues(width, height)
{
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
  {
    throw new TypeError("QuadV5 fixture dimensions must be positive integers");
  }
  const viewInverseTranspose = identityMatrix();
  viewInverseTranspose[11] = 5;
  const sun = Object.freeze({
    DirWorld: [ 0.25, -0.35, 0.9027735 ],
    unused_pad0: 0,
    DiffuseColor: [ 1, 0.92, 0.78, 1 ]
  });
  const material = Object.freeze({
    GeneralData: [ 1, 0, 0, 0 ],
    GeneralGlowColor: [ 0.08, 0.22, 0.7, 0 ],
    Mtl1DiffuseColor: [ 0.15, 0.36, 0.72, 1 ],
    Mtl2DiffuseColor: [ 0.52, 0.16, 0.1, 1 ],
    Mtl3DiffuseColor: [ 0.12, 0.48, 0.34, 1 ],
    Mtl4DiffuseColor: [ 0.58, 0.52, 0.18, 1 ],
    Mtl1FresnelColor: [ 0.18, 0.3, 0.52, 1 ],
    Mtl2FresnelColor: [ 0.42, 0.18, 0.12, 1 ],
    Mtl3FresnelColor: [ 0.12, 0.36, 0.28, 1 ],
    Mtl4FresnelColor: [ 0.48, 0.42, 0.16, 1 ],
    Mtl1Gloss: [ 0.32, 0.58, 0, 0 ],
    Mtl2Gloss: [ 0.48, 0.72, 0, 0 ],
    Mtl3Gloss: [ 0.22, 0.46, 0, 0 ],
    Mtl4Gloss: [ 0.4, 0.64, 0, 0 ],
    PMtl1DiffuseColor: [ 0.34, 0.12, 0.5, 1 ],
    PMtl1FresnelColor: [ 0.3, 0.16, 0.44, 1 ],
    PMtl1Gloss: [ 0.36, 0.62, 0, 0 ],
    PMtl2DiffuseColor: [ 0.1, 0.44, 0.56, 1 ],
    PMtl2FresnelColor: [ 0.12, 0.34, 0.48, 1 ],
    PMtl2Gloss: [ 0.28, 0.54, 0, 0 ]
  });
  const perFrameVS = Object.freeze({
    ViewInverseTransposeMat: viewInverseTranspose,
    ViewProjectionMat: identityMatrix(),
    ViewMat: identityMatrix(),
    ProjectionMat: identityMatrix(),
    ShadowViewMat: identityMatrix(),
    ShadowViewProjectionMat: identityMatrix(),
    EnvMapRotationMat: identityMatrix(),
    ViewProjectionLast: identityMatrix(),
    ViewLast: identityMatrix(),
    ProjLast: identityMatrix(),
    Sun: sun,
    FogFactors: [ 0, 1, 0 ],
    pad: 0,
    TargetResolution: [ width, height ],
    FovXY: [ 1, 1 ],
    ViewportAdjustment: [ 1, 1, 0, 0 ],
    Time: 0,
    Upscaling: 1,
    ViewportSize: [ width, height ]
  });
  const perFramePS = Object.freeze({
    ViewInverseTransposeMat: viewInverseTranspose,
    ViewMat: identityMatrix(),
    EnvMapRotationMat: identityMatrix(),
    Sun: sun,
    AmbientColor: [ 0.12, 0.15, 0.22 ],
    ReflectionIntensity: 0.28,
    FogColor: [ 0, 0, 0, 0 ],
    ViewportOffset: [ 0, 0 ],
    ViewportSize: [ width, height ],
    TargetResolution: [ width, height ],
    DepthMapSampleCount: 1,
    Debug: 0,
    ShadowMapSettings: [ 1, 1, 0, 0 ],
    ShadowCameraRange: [ 0, 1 ],
    ShadowLightness: 1,
    ShadowQuality: 0,
    ProjectionToView: [ 1, 1 ],
    FovXY: [ 1, 1 ],
    Time: 0,
    SceneMipLodBias: 0,
    Upscaling: 1,
    GammaBrightness: 2,
    FrameIndex: 0,
    Jittering: 0,
    InverseShadowMapAtlasSize: 1,
    ShadowMapAtlasEntryMinSizeLog2: 0,
    VolumetricSlices: [ 0, 0, 0, 0 ],
    ShadowMapValues: identityMatrix(),
    ShadowMatrixVal: identityMatrices(16),
    SplitInfo: [ 0, 0, 0, 0 ],
    ProjectionInverseMat: identityMatrix(),
    CascadeRanges: zeros(64),
    FroxelFogData: Object.freeze({
      FogColor: [ 0, 0, 0 ],
      BackgroundVisibility: 1,
      BaseDensity: 0,
      MaxDistance: 0,
      MaxDistanceVisibility: 1,
      EnvironmentIntensity: 0,
      EnvironmentG: 0,
      _pad0: 0,
      _pad1: 0,
      _pad2: 0,
      planets: zeros(8)
    })
  });
  const perObjectVS = Object.freeze({
    worldTransform: identityMatrix(),
    worldTransformLast: identityMatrix(),
    invWorldTransform: identityMatrix(),
    shipData: [ 0, 1, 0, 0 ],
    clipData: [ 0, 0, 0, 0 ],
    ellpsoidRadii: [ 1, 1, 1, 0 ],
    ellpsoidCenter: [ 0, 0, 0, 0 ],
    customMaskMatrix: identityMatrices(2),
    customMaskData: zeros(8),
    boneOffsets: [ 0, 0, 1, 0 ],
    morphTargetVertexDataOffset: 0,
    morphTargetAnimationDataOffset: 0,
    activeMorphTargetsCount: 0,
    bakedMorphTargetVertexDataOffset: 0,
    customData: [ 0, 0, 0, 0 ]
  });
  const shLightingCoefficients = zeros(28);
  shLightingCoefficients[0] = 0.18;
  shLightingCoefficients[1] = 0.2;
  shLightingCoefficients[2] = 0.24;
  const perObjectPS = Object.freeze({
    worldTransform: identityMatrix(),
    worldTransformLast: identityMatrix(),
    invWorldTransform: identityMatrix(),
    shipData: [ 0, 1, 0, 0 ],
    clipSphereCenter: [ 0, 0, 0 ],
    clipRadiusSq: 0,
    clipRadius2Sq: 0,
    impactDataOffset: 0,
    clipSphereFactor2: 0,
    clipSphereFactor: 0,
    shLightingCoefficients,
    customMaskMaterialIDs: zeros(8),
    customMaskTargets: zeros(8),
    customMaskClamps: [ 0, 1, 0, 1 ],
    screenSize: [ width, height, 1 / width, 1 / height ],
    customData: [ 0, 0, 0, 0 ]
  });
  return Object.freeze({ material, perFrameVS, perFramePS, perObjectVS, perObjectPS });
}

function createHeatMaterial()
{
  return Object.freeze({
    GeneralData: [ 1, 0, 0, 0 ],
    Mtl1DiffuseColor: [ 0.15, 0.36, 0.72, 1 ],
    Mtl2DiffuseColor: [ 0.52, 0.16, 0.1, 1 ],
    Mtl3DiffuseColor: [ 0.12, 0.48, 0.34, 1 ],
    Mtl4DiffuseColor: [ 0.58, 0.52, 0.18, 1 ],
    Mtl1FresnelColor: [ 0.18, 0.3, 0.52, 1 ],
    Mtl2FresnelColor: [ 0.42, 0.18, 0.12, 1 ],
    Mtl3FresnelColor: [ 0.12, 0.36, 0.28, 1 ],
    Mtl4FresnelColor: [ 0.48, 0.42, 0.16, 1 ],
    Mtl1Gloss: [ 0.32, 0.58, 0, 0 ],
    Mtl2Gloss: [ 0.48, 0.72, 0, 0 ],
    Mtl3Gloss: [ 0.22, 0.46, 0, 0 ],
    Mtl4Gloss: [ 0.4, 0.64, 0, 0 ],
    PMtl1DiffuseColor: [ 0.34, 0.12, 0.5, 1 ],
    PMtl1FresnelColor: [ 0.3, 0.16, 0.44, 1 ],
    PMtl1Gloss: [ 0.36, 0.62, 0, 0 ],
    PMtl2DiffuseColor: [ 0.1, 0.44, 0.56, 1 ],
    PMtl2FresnelColor: [ 0.12, 0.34, 0.48, 1 ],
    PMtl2Gloss: [ 0.28, 0.54, 0, 0 ],
    Mtl1HeatGlowData: [ 1, 0.025, 4, 0.002 ],
    Mtl2HeatGlowData: [ 1, 0.005, 8, 0.0005 ],
    Mtl3HeatGlowData: [ 1, 0.025, 4, 0.002 ],
    Mtl4HeatGlowData: [ 1, 0.025, 4, 0.002 ],
    GeneralHeatGlowColor: [ 0.85, 0, 0, 1 ]
  });
}

function createHeatDetailMaterial(detailSelector)
{
  return Object.freeze({
    ...createHeatMaterial(),
    Detail1Data: [ 1, 1, 0.5, 0.2 ],
    Detail2Data: [ 1, 1, 0.5, 0.2 ],
    SecondaryDetail2Data: [ 1, 1, 0.5, 0.2 ],
    Detail3Data: [ 1, 1, 0.5, 0.2 ],
    DetailAlbedoColor: [ 0.32, 0.18, 0.08, 1 ],
    DetailFresnelColor: [ 0.24, 0.2, 0.16, 1 ],
    DetailSelector: detailSelector
  });
}

function createHeatBindingCase(base, heat)
{
  const shipData = Object.freeze([ heat, 1, 0, 0 ]);
  return Object.freeze({
    ...base,
    material: createHeatMaterial(),
    perObjectVS: Object.freeze({ ...base.perObjectVS, shipData }),
    perObjectPS: Object.freeze({ ...base.perObjectPS, shipData })
  });
}

function createHeatDetailBindingCase(base, heat, detailSelector)
{
  const shipData = Object.freeze([ heat, 1, 0, 0 ]);
  return Object.freeze({
    ...base,
    material: createHeatDetailMaterial(Object.freeze(detailSelector)),
    perObjectVS: Object.freeze({ ...base.perObjectVS, shipData }),
    perObjectPS: Object.freeze({ ...base.perObjectPS, shipData })
  });
}

/**
 * Create the ordered cold/hot cases used to isolate authored heat behavior in
 * the common PPT-on skinned QuadHeatV5 shader.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @returns {{caseNames: readonly string[], bindingValuesByCase: Readonly<Record<string, object>>}}
 * Frozen case names and exact reflected binding values keyed by case name.
 */
export function createQuadV5HeatBindingCases(width, height)
{
  const base = createQuadV5MainBindingValues(width, height);
  const caseNames = Object.freeze([ "cold", "hot" ]);
  const bindingValuesByCase = Object.freeze({
    cold: createHeatBindingCase(base, 0),
    hot: createHeatBindingCase(base, 1)
  });
  return Object.freeze({ caseNames, bindingValuesByCase });
}

/**
 * Create the three ordered authored material cases used to isolate surface,
 * detail, and heat-detail behavior in the skinned QuadHeatDetailV5 shader.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @returns {{caseNames: readonly string[], bindingValuesByCase: Readonly<Record<string, object>>}}
 * Frozen case names and exact reflected binding values keyed by case name.
 */
export function createQuadV5HeatDetailBindingCases(width, height)
{
  const base = createQuadV5MainBindingValues(width, height);
  const caseNames = Object.freeze([ "surface", "detail", "hotDetail" ]);
  const bindingValuesByCase = Object.freeze({
    surface: createHeatDetailBindingCase(base, 0, [ 0, 0, 0, 0 ]),
    detail: createHeatDetailBindingCase(base, 0, [ 1, 1, 0, 0 ]),
    hotDetail: createHeatDetailBindingCase(base, 1, [ 1, 1, 0, 0 ])
  });
  return Object.freeze({ caseNames, bindingValuesByCase });
}

function rgbaTexture(name, format, pixel)
{
  const width = 8;
  const height = 8;
  const bytesPerRow = width * 4;
  const data = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y += 1)
  {
    for (let x = 0; x < width; x += 1)
    {
      data.set(pixel(x, y), y * bytesPerRow + x * 4);
    }
  }
  return Object.freeze({ name, dimension: "2d", width, height, format, bytesPerRow, data });
}

function fixtureTextures(variant)
{
  const heat = variant === "skinnedHeat";
  const heatDetail = variant === "skinnedHeatDetail";
  const strictHeat = heat || heatDetail;
  return Object.freeze([
    Object.freeze({
      name: "EveSpaceSceneEnvMap",
      dimension: "cube",
      width: 1,
      height: 1,
      depthOrArrayLayers: 6,
      format: "rgba8unorm-srgb",
      data: new Uint8Array([
        28, 45, 78, 255,
        36, 54, 88, 255,
        48, 66, 98, 255,
        18, 32, 62, 255,
        56, 72, 104, 255,
        22, 38, 70, 255
      ])
    }),
    rgbaTexture("SSAOMap", "rgba8unorm", () => [ 255, 255, 255, 255 ]),
    rgbaTexture("EveSpaceSceneShadowMap", "rgba8unorm", () => [ 255, 255, 255, 255 ]),
    rgbaTexture("NormalMap", "rgba8unorm", (x, y) => [
      112 + x * 4,
      112 + y * 4,
      248,
      255
    ]),
    rgbaTexture("GlowMap", "rgba8unorm", (x, y) => {
      const glow = (x === y || x + y === 7) ? 220 : ((x + y) % 3 === 0 ? 72 : 8);
      return [ glow, Math.floor(glow * 0.72), 255, 255 ];
    }),
    rgbaTexture("AlbedoMap", "rgba8unorm-srgb", (x, y) => [
      48 + x * 21,
      42 + y * 18,
      92 + ((x + y) % 4) * 26,
      255
    ]),
    rgbaTexture("RoughnessMap", "rgba8unorm", (x, y) => {
      const roughness = 56 + ((x * 3 + y * 5) % 8) * 22;
      return [ roughness, roughness, roughness, 255 ];
    }),
    rgbaTexture("MaterialMap", "rgba8unorm", (x, y) => [
      x < 4 ? 255 : 0,
      x >= 4 ? 255 : 0,
      y < 4 ? 128 : 32,
      255
    ]),
    rgbaTexture("PaintMaskMap", "rgba8unorm", (x, y) => [
      (x + y) % 4 === 0 ? 220 : 16,
      x > y ? 180 : 24,
      y > x ? 140 : 20,
      255
    ]),
    rgbaTexture("PatternMask1Map", "rgba8unorm", (x) => {
      const value = x % 2 === 0 ? 255 : 0;
      return [ value, value, value, 255 ];
    }),
    rgbaTexture("PatternMask2Map", "rgba8unorm", (_x, y) => {
      const value = y % 2 === 0 ? 0 : 255;
      return [ value, value, value, 255 ];
    }),
    ...(strictHeat ? [
      rgbaTexture("HeatGlowNoiseMap", "rgba8unorm", (x, y) => [
        24 + ((x * 37 + y * 19) % 208),
        24 + ((x * 11 + y * 43) % 208),
        0,
        255
      ])
    ] : []),
    ...(heatDetail ? [
      rgbaTexture("Detail1Map", "rgba8unorm", (x, y) => [
        36 + x * 25,
        224 - y * 21,
        (x + y) % 2 ? 210 : 42,
        255
      ]),
      rgbaTexture("Detail2Map", "rgba8unorm", (x, y) => [
        (x + y) % 3 ? 58 : 232,
        40 + y * 24,
        216 - x * 19,
        255
      ])
    ] : [])
  ]);
}

/**
 * Create deterministic authored silhouette geometry and semantic texture inputs.
 * The silhouette is not an extracted EVE asset; it exercises the current
 * unpacked shader contract without reading SOF or inferring production
 * defaults.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @param {"static"|"skinned"|"skinnedHeat"|"skinnedHeatDetail"} [variant="static"] Fixture variant.
 * @returns {object} Typed-array fixture values.
 */
export function createQuadV5FixtureValues(width, height, variant = "static")
{
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
  {
    throw new TypeError("QuadV5 fixture dimensions must be positive integers");
  }
  const heat = variant === "skinnedHeat";
  const heatDetail = variant === "skinnedHeatDetail";
  if (variant !== "static" && variant !== "skinned" && !heat && !heatDetail)
  {
    throw new TypeError(
      "QuadV5 fixture variant must be static, skinned, skinnedHeat, or skinnedHeatDetail"
    );
  }
  const points = [
    [ 0, 0, 0.12 ],
    [ 0, 0.88, 0 ],
    [ 0.18, 0.46, 0.02 ],
    [ 0.76, 0.06, 0 ],
    [ 0.62, -0.2, 0 ],
    [ 0.22, -0.3, 0.03 ],
    [ 0.38, -0.72, 0 ],
    [ 0, -0.58, 0.02 ],
    [ -0.38, -0.72, 0 ],
    [ -0.22, -0.3, 0.03 ],
    [ -0.62, -0.2, 0 ],
    [ -0.76, 0.06, 0 ],
    [ -0.18, 0.46, 0.02 ]
  ];
  const vertices = new Float32Array(points.length * 16);
  for (let index = 0; index < points.length; index += 1)
  {
    const [ x, y, z ] = points[index];
    const uv = [ x * 0.5 + 0.5, 0.5 - y * 0.5 ];
    vertices.set([
      x, y, z,
      uv[0], uv[1],
      0, 0, 1,
      1, 0, 0,
      0, 1, 0,
      uv[0], uv[1]
    ], index * 16);
  }
  const indices = new Uint16Array(12 * 3);
  for (let edge = 0; edge < 12; edge += 1)
  {
    indices.set([ 0, edge + 1, edge === 11 ? 1 : edge + 2 ], edge * 3);
  }
  const boneIndices = new Uint16Array(points.length * 4);
  for (let index = 0; index < points.length; index += 1)
  {
    boneIndices[index * 4] = 1;
  }
  return Object.freeze({
    vertices,
    boneIndices,
    indices,
    textures: fixtureTextures(variant),
    samplerNames: SAMPLER_NAMES
  });
}
