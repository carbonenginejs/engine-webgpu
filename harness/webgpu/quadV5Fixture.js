const TARGET_BODY_INDEX = 4;

export const QUADV5_PPT_SELECTION = Object.freeze({
  BINDLESS_RENDERING: "BINDLESS_RENDERING_DISABLED",
  SPACE_OBJECT_CLIPPING: "SOC_DISABLED",
  SPACE_OBJECT_PPT_ENABLED: "SOPPT_ENABLED",
  SPACE_OBJECT_TRANSPARENCY: "SOT_OPAQUE",
  V5_DEBUG: "OFF",
  SPACE_OBJECT_INSTANCED_ATTACHMENT: "SOIA_DISABLED",
  BLEND_MODE: "BLEND_MODE_OVERLAY"
});

const SELECTION_PROVENANCE = Object.freeze({
  BINDLESS_RENDERING: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "BINDLESS_RENDERING_DISABLED" }),
  SPACE_OBJECT_CLIPPING: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOC_DISABLED" }),
  SPACE_OBJECT_PPT_ENABLED: Object.freeze({ optionIndex: 1, defaultOption: 0, defaultValue: "SOPPT_DISABLED" }),
  SPACE_OBJECT_TRANSPARENCY: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOT_OPAQUE" }),
  V5_DEBUG: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "OFF" }),
  SPACE_OBJECT_INSTANCED_ATTACHMENT: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "SOIA_DISABLED" }),
  BLEND_MODE: Object.freeze({ optionIndex: 0, defaultOption: 0, defaultValue: "BLEND_MODE_OVERLAY" })
});

const REQUIRED_BINDINGS = Object.freeze([
  { identity: "uniform-buffer:0:0", binding: 0, visibility: "fragment", kind: "buffer", minBindingSize: 160 },
  { identity: "uniform-buffer:0:1", binding: 1, visibility: "vertex", kind: "buffer", minBindingSize: 656 },
  { identity: "uniform-buffer:0:2", binding: 2, visibility: "fragment", kind: "buffer", minBindingSize: 352 },
  { identity: "uniform-buffer:0:3", binding: 3, visibility: "vertex", kind: "buffer", minBindingSize: 128 },
  { identity: "uniform-buffer:0:4", binding: 4, visibility: "fragment", kind: "buffer", minBindingSize: 208 },
  { identity: "sampled-resource:0:0", binding: 5, visibility: "fragment", kind: "texture" },
  { identity: "sampled-resource:0:1", binding: 6, visibility: "fragment", kind: "texture" },
  { identity: "sampled-resource:0:2", binding: 7, visibility: "fragment", kind: "texture" },
  { identity: "sampler:0:0", binding: 8, visibility: "fragment", kind: "sampler" }
]);

export const QUADV5_VERTEX_BUFFER_LAYOUT = Object.freeze({
  arrayStride: 40,
  attributes: Object.freeze([
    Object.freeze({ shaderLocation: 0, offset: 0, format: "float32x3" }),
    Object.freeze({ shaderLocation: 2, offset: 12, format: "float32x2" }),
    Object.freeze({ shaderLocation: 3, offset: 20, format: "float32x3" }),
    Object.freeze({ shaderLocation: 6, offset: 32, format: "float32x2" })
  ])
});

export const QUADV5_EXPECTED_TARGETS = Object.freeze([
  Object.freeze([ 64, 128, 255, 255 ]),
  Object.freeze([ 0, 0, 0, 255 ])
]);

function fail(message)
{
  throw new Error(`QuadV5 PPT fixture: ${message}`);
}

function assertSelections(options, owner)
{
  if (!Array.isArray(options) || options.length !== Object.keys(QUADV5_PPT_SELECTION).length)
  {
    fail(`${owner} must contain all seven permutation selections`);
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
  for (const [ name, value ] of Object.entries(QUADV5_PPT_SELECTION))
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

function assertVertexInputs(analysis)
{
  const stage = analysis.stages?.find((entry) =>
    entry?.techniqueName === "Main" && entry.passIndex === 0 && entry.stageName === "vertex");
  if (!stage) fail("analysis has no Main.pass0.vertex stage");
  const active = (stage.pipelineInputs || [])
    .filter((entry) => entry.usedMask !== 0)
    .map(({ registerIndex, dimension, type }) => ({ registerIndex, dimension, type }))
    .sort((left, right) => left.registerIndex - right.registerIndex);
  const expected = [
    { registerIndex: 0, dimension: 3, type: 0 },
    { registerIndex: 2, dimension: 2, type: 0 },
    { registerIndex: 3, dimension: 3, type: 0 },
    { registerIndex: 6, dimension: 2, type: 0 }
  ];
  if (JSON.stringify(active) !== JSON.stringify(expected))
  {
    fail("Main.pass0.vertex has an unexpected active input contract");
  }
}

function assertShaderModules(pipeline)
{
  if (!Array.isArray(pipeline.shaderModules) || pipeline.shaderModules.length !== 2)
  {
    fail("Main.pass0 requires exactly vertex and pixel modules");
  }
  for (const stageName of [ "vertex", "pixel" ])
  {
    const matches = pipeline.shaderModules.filter((entry) => entry?.stageName === stageName);
    if (matches.length !== 1 || typeof matches[0].wgsl !== "string" || !matches[0].wgsl
      || typeof matches[0].entryPoint !== "string" || !matches[0].entryPoint)
    {
      fail(`Main.pass0 requires one complete ${stageName} module`);
    }
    if (stageName === "vertex")
    {
      for (const location of [ 0, 2, 3, 6 ])
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
  }
}

function assertBindings(pipeline)
{
  if (!Array.isArray(pipeline.bindGroups) || pipeline.bindGroups.length !== 1
    || pipeline.bindGroups[0]?.group !== 0)
  {
    fail("Main.pass0 requires exactly canonical bind group 0");
  }
  const bindings = pipeline.bindGroups[0].bindings;
  if (!Array.isArray(bindings) || bindings.length !== REQUIRED_BINDINGS.length)
  {
    fail("Main.pass0 requires exactly nine canonical bindings");
  }
  const byIdentity = new Map(bindings.map((entry) => [
    `${entry.resourceKind}:${entry.registerSpace}:${entry.registerIndex}`,
    entry
  ]));
  if (byIdentity.size !== bindings.length) fail("Main.pass0 contains duplicate binding identities");
  for (const expected of REQUIRED_BINDINGS)
  {
    const binding = byIdentity.get(expected.identity);
    if (!binding || binding.sourceTruth !== "wgsl-layout" || binding.group !== 0
      || binding.binding !== expected.binding || binding.dynamic !== false
      || !Array.isArray(binding.visibility) || binding.visibility.length !== 1
      || binding.visibility[0] !== expected.visibility)
    {
      fail(`${expected.identity} has an unexpected slot or visibility`);
    }
    const layout = binding.layout || {};
    const kinds = [ "buffer", "texture", "sampler" ].filter((key) => layout[key]);
    if (kinds.length !== 1 || kinds[0] !== expected.kind)
    {
      fail(`${expected.identity} has an unexpected layout kind`);
    }
    if (expected.kind === "buffer"
      && (layout.buffer.type !== "uniform" || layout.buffer.hasDynamicOffset !== false
        || layout.buffer.minBindingSize !== expected.minBindingSize))
    {
      fail(`${expected.identity} has an unexpected uniform-buffer layout`);
    }
    if (expected.kind === "texture"
      && (layout.texture.sampleType !== "float" || layout.texture.viewDimension !== "2d"
        || layout.texture.multisampled !== false))
    {
      fail(`${expected.identity} has an unexpected texture layout`);
    }
    if (expected.kind === "sampler" && layout.sampler.type !== "filtering")
    {
      fail(`${expected.identity} has an unexpected sampler layout`);
    }
  }
}

/**
 * Fail closed unless a resource-loaded package is the exact PPT-on QuadV5
 * body and exposes the bounded Main.pass0 contract used by the live fixture.
 *
 * @param {object} record Resource provenance plus a pipeline descriptor.
 * @returns {object} The validated input record.
 */
export function validateQuadV5PackageRecord(record)
{
  if (!record || typeof record !== "object") fail("package record is required");
  if (record.backend !== "dx11" && record.backend !== "dx12") fail("package backend must be dx11 or dx12");
  const analysisSource = normalizedPath(record.analysis?.source);
  const metadataSource = normalizedPath(record.metadata?.sourcePath);
  const backendMarker = `/effect.${record.backend}/`;
  if (!analysisSource || analysisSource !== metadataSource || !analysisSource.includes(backendMarker))
  {
    fail(`package source provenance must match ${record.backend}`);
  }
  if (record.analysis?.bodyIndex !== TARGET_BODY_INDEX || record.metadata?.bodyIndex !== TARGET_BODY_INDEX)
  {
    fail(`package must resolve body index ${TARGET_BODY_INDEX}`);
  }
  assertSelections(record.analysis.selectedOptions, "analysis.selectedOptions");
  assertSelections(record.metadata.selectedOptions, "metadata.selectedOptions");
  const selection = record.metadata.wgslSelection;
  if (selection?.techniqueName !== "Main" || selection.passIndex !== 0
    || selection.completePasses !== true
    || !Array.isArray(selection.selectedStageKeys)
    || selection.selectedStageKeys.length !== 2
    || !selection.selectedStageKeys.includes("Main.pass0.vertex")
    || !selection.selectedStageKeys.includes("Main.pass0.pixel"))
  {
    fail("package selection must be the complete Main.pass0 vertex/pixel pair");
  }
  if (record.pipeline?.techniqueName !== "Main" || record.pipeline.passIndex !== 0)
  {
    fail("pipeline must be Main.pass0");
  }
  assertVertexInputs(record.analysis);
  assertShaderModules(record.pipeline);
  assertBindings(record.pipeline);
  return record;
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

/**
 * Create semantic values for the proven Carbon space-object Main-pass ABI.
 * The production serializer converts these values into canonical uniform data.
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
  viewInverseTranspose[14] = 5;
  const material = {
    GeneralGlowColor: [ 0.25, 0.5, 1, 0 ],
    Mtl1DiffuseColor: [ 0, 0, 0, 0 ],
    Mtl2DiffuseColor: [ 0, 0, 0, 0 ],
    Mtl3DiffuseColor: [ 0, 0, 0, 0 ],
    Mtl4DiffuseColor: [ 0, 0, 0, 0 ],
    Mtl1FresnelColor: [ 0, 0, 0, 0 ],
    Mtl2FresnelColor: [ 0, 0, 0, 0 ],
    Mtl3FresnelColor: [ 0, 0, 0, 0 ],
    Mtl4FresnelColor: [ 0, 0, 0, 0 ]
  };
  const perObject = {
    worldTransform: identityMatrix(),
    worldTransformLast: identityMatrix(),
    invWorldTransform: identityMatrix(),
    shipData: [ 0, 1, 0, 0 ]
  };
  return Object.freeze({
    material: Object.freeze(material),
    perFrameVS: Object.freeze({
      ViewInverseTransposeMat: viewInverseTranspose,
      ViewProjectionMat: identityMatrix(),
      ViewProjectionLast: identityMatrix(),
      Sun: Object.freeze({ DirWorld: [ 0, 0, 1 ] })
    }),
    perFramePS: Object.freeze({
      TargetResolution: [ width, height ],
      SceneMipLodBias: 0,
      GammaBrightness: 2
    }),
    perObjectVS: Object.freeze({ ...perObject }),
    perObjectPS: Object.freeze({ ...perObject })
  });
}

/**
 * Create deterministic CPU-side geometry and 1x1 textures for the first real
 * QuadV5 draw. Constant-buffer values are provided separately as semantics and
 * packed by the production Carbon ABI serializer.
 *
 * @param {number} width Render-target width.
 * @param {number} height Render-target height.
 * @returns {object} Typed-array fixture values.
 */
export function createQuadV5FixtureValues(width, height)
{
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
  {
    throw new TypeError("QuadV5 fixture dimensions must be positive integers");
  }
  return Object.freeze({
    vertices: new Float32Array([
      -1, -1, 0, 0, 1, 0, 0, 1, 0, 1,
       1, -1, 0, 1, 1, 0, 0, 1, 1, 1,
      -1,  1, 0, 0, 0, 0, 0, 1, 0, 0,
       1,  1, 0, 1, 0, 0, 0, 1, 1, 0
    ]),
    indices: new Uint16Array([ 0, 1, 2, 2, 1, 3 ]),
    textures: Object.freeze([
      Object.freeze({ identity: "sampled-resource:0:0", format: "rgba8unorm", bytes: new Uint8Array([ 255, 0, 0, 255 ]) }),
      Object.freeze({ identity: "sampled-resource:0:1", format: "rgba8unorm-srgb", bytes: new Uint8Array([ 255, 255, 255, 255 ]) }),
      Object.freeze({ identity: "sampled-resource:0:2", format: "rgba8unorm", bytes: new Uint8Array([ 128, 0, 0, 255 ]) })
    ])
  });
}
