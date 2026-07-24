import { CjsWebGPUPackage } from "../CjsWebGPUPackage.js";

function fail(message)
{
  throw new Error(`CJS WebGPU effect matrix: ${message}`);
}

const BACKEND_NAMES = Object.freeze([ "dx11", "dx12" ]);

function positiveInteger(value, label)
{
  if (!Number.isInteger(value) || value < 1) fail(`${label} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value, label)
{
  if (!Number.isInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
  return value;
}

function validateReadyWgsl(variant)
{
  const passKey = `${variant.techniqueName}.pass${variant.passIndex}`;
  if (variant.passKey !== passKey) fail(`${variant.id} pass key does not match its technique/pass`);
  const wgsl = variant.wgsl;
  if (wgsl?.format !== "CJS_WGSL_SET" || (wgsl.formatVersion !== 1 && wgsl.formatVersion !== 2))
  {
    fail(`${passKey} ready variant is not a version 1 or 2 CJS_WGSL_SET`);
  }
  const shaders = Array.isArray(wgsl.shaders) ? wgsl.shaders : [];
  if (shaders.length !== 2) fail(`${passKey} does not contain exactly vertex+pixel WGSL`);
  const expectedStages = new Map([
    [ "vertex", { stage: "vertex", stageType: 0 } ],
    [ "pixel", { stage: "fragment", stageType: 1 } ]
  ]);
  const seen = new Set();
  for (const shader of shaders)
  {
    const expected = expectedStages.get(shader?.stageName);
    if (!expected || seen.has(shader.stageName)) fail(`${passKey} has duplicate or unsupported WGSL stages`);
    seen.add(shader.stageName);
    if (shader.key !== `${passKey}.${shader.stageName}`
      || shader.techniqueName !== variant.techniqueName
      || shader.passIndex !== variant.passIndex
      || shader.stage !== expected.stage
      || shader.stageType !== expected.stageType)
    {
      fail(`${passKey}.${shader.stageName} has inconsistent WGSL provenance`);
    }
    if (typeof shader.entryPoint !== "string" || !shader.entryPoint
      || typeof shader.code !== "string" || !shader.code
      || !Array.isArray(shader.sourceMap))
    {
      fail(`${passKey}.${shader.stageName} has malformed WGSL code metadata`);
    }
  }
  if (seen.size !== expectedStages.size) fail(`${passKey} does not contain exactly vertex+pixel WGSL`);
  const layouts = Array.isArray(wgsl.layouts) ? wgsl.layouts : [];
  if (layouts.length !== 1) fail(`${passKey} must have exactly one canonical layout`);
  const layout = layouts[0];
  if (layout?.key !== passKey
    || layout.techniqueName !== variant.techniqueName
    || layout.passIndex !== variant.passIndex
    || !Array.isArray(layout.bindGroups))
  {
    fail(`${passKey} has inconsistent canonical-layout provenance`);
  }
  return shaders;
}

function passAnalysis(variant)
{
  const shaders = validateReadyWgsl(variant);
  return {
    passes: [ {
      techniqueName: variant.techniqueName,
      passIndex: variant.passIndex,
      renderStates: 0,
      states: []
    } ],
    stages: shaders.map((shader) => ({
      key: shader.key,
      techniqueName: shader.techniqueName,
      passIndex: shader.passIndex,
      stageName: shader.stageName,
      stageType: shader.stageType,
      bindings: []
    }))
  };
}

function validateBackendRecord(backend, record)
{
  if (!record || typeof record !== "object") fail(`${backend} has no backend record`);
  const expectedBodies = positiveInteger(record.expectedBodies, `${backend}.expectedBodies`);
  if (record.resolvedBodies !== expectedBodies || record.failedBodies !== 0)
  {
    fail(`${backend} does not resolve every permutation body`);
  }
  if (record.offsetRecords !== expectedBodies || record.offsetCountMatch !== true || record.offsetIndicesMatch !== true)
  {
    fail(`${backend} does not have one correctly indexed offset per permutation body`);
  }
  if (!Array.isArray(record.bodyResults) || record.bodyResults.length !== expectedBodies)
  {
    fail(`${backend} body-result coverage is incomplete`);
  }
  if (!record.stages || !record.passes
    || !Array.isArray(record.stageVariants) || !Array.isArray(record.passVariants))
  {
    fail(`${backend} has incomplete stage/pass qualification records`);
  }

  const stageVariants = new Map();
  let stageOccurrences = 0;
  let emittedStageOccurrences = 0;
  let emittedStageVariants = 0;
  for (const variant of record.stageVariants)
  {
    if (typeof variant?.digest !== "string" || !variant.digest || stageVariants.has(variant.digest))
    {
      fail(`${backend} has a missing or duplicate stage digest`);
    }
    positiveInteger(variant.occurrences, `${backend}:${variant.digest}.occurrences`);
    if (variant.frontEnd !== "qualified") fail(`${backend}:${variant.digest} is not front-end qualified`);
    if (!Array.isArray(variant.keys) || !variant.keys.length) fail(`${backend}:${variant.digest} has no provenance keys`);
    if (variant.wgsl !== "emitted" && variant.wgsl !== "unsupported")
    {
      fail(`${backend}:${variant.digest} has an invalid WGSL status`);
    }
    if (variant.wgsl === "emitted")
    {
      const shader = variant.independentShader;
      if (!shader || (shader.stage !== "vertex" && shader.stage !== "fragment")
        || typeof shader.entryPoint !== "string" || !shader.entryPoint
        || typeof shader.code !== "string" || !shader.code)
      {
        fail(`${backend}:${variant.digest} has malformed independently emitted WGSL`);
      }
      emittedStageOccurrences += variant.occurrences;
      emittedStageVariants += 1;
    }
    else if (variant.independentShader)
    {
      fail(`${backend}:${variant.digest} is unsupported but carries emitted WGSL`);
    }
    stageOccurrences += variant.occurrences;
    stageVariants.set(variant.digest, variant);
  }
  const stageSummary = record.stages;
  if (stageSummary.occurrences !== stageOccurrences
    || stageSummary.frontEndQualifiedOccurrences !== stageOccurrences
    || stageSummary.frontEndFailedOccurrences !== 0
    || stageSummary.emittedWgslOccurrences !== emittedStageOccurrences
    || stageSummary.unsupportedWgslOccurrences !== stageOccurrences - emittedStageOccurrences
    || stageSummary.uniquePrograms !== stageVariants.size
    || stageSummary.uniqueFrontEndQualifiedPrograms !== stageVariants.size
    || stageSummary.uniqueFrontEndFailedPrograms !== 0
    || stageSummary.uniqueEmittedWgslPrograms !== emittedStageVariants
    || stageSummary.uniqueUnsupportedWgslPrograms !== stageVariants.size - emittedStageVariants)
  {
    fail(`${backend} stage summary does not reconcile with its variants`);
  }

  const passVariants = new Map();
  let passOccurrences = 0;
  let readyPassOccurrences = 0;
  let readyPassVariants = 0;
  for (const variant of record.passVariants)
  {
    if (typeof variant?.id !== "string" || !variant.id || passVariants.has(variant.id))
    {
      fail(`${backend} has a missing or duplicate pass variant id`);
    }
    if (typeof variant.techniqueName !== "string" || !variant.techniqueName
      || !Number.isInteger(variant.passIndex) || variant.passIndex < 0
      || variant.passKey !== `${variant.techniqueName}.pass${variant.passIndex}`)
    {
      fail(`${backend}:${variant.id} has inconsistent pass provenance`);
    }
    positiveInteger(variant.occurrences, `${backend}:${variant.id}.occurrences`);
    const stageDigests = Array.isArray(variant.stageDigests) ? variant.stageDigests : [];
    const stageNames = new Set(stageDigests.map((entry) => entry?.stageName));
    if (!stageDigests.length || stageNames.size !== stageDigests.length
      || stageDigests.some((entry) => typeof entry?.stageName !== "string" || !entry.stageName
        || !stageVariants.has(entry.digest)
        || stageVariants.get(entry.digest).stage !== entry.stageName))
    {
      fail(`${backend}:${variant.id} has invalid qualified stage references`);
    }
    if (variant.status === "ready")
    {
      if (stageDigests.length !== 2 || !stageNames.has("vertex") || !stageNames.has("pixel"))
      {
        fail(`${backend}:${variant.id} ready pass does not reference exactly vertex+pixel`);
      }
      validateReadyWgsl(variant);
      readyPassOccurrences += variant.occurrences;
      readyPassVariants += 1;
    }
    else if (variant.status !== "unsupported" || variant.wgsl)
    {
      fail(`${backend}:${variant.id} has an invalid pass status or artifact`);
    }
    passOccurrences += variant.occurrences;
    passVariants.set(variant.id, variant);
  }
  const passSummary = record.passes;
  if (passSummary.occurrences !== passOccurrences
    || passSummary.readyOccurrences !== readyPassOccurrences
    || passSummary.unsupportedOccurrences !== passOccurrences - readyPassOccurrences
    || passSummary.failedOccurrences !== 0
    || passSummary.uniqueVariants !== passVariants.size
    || passSummary.uniqueReadyVariants !== readyPassVariants
    || passSummary.uniqueUnsupportedVariants !== passVariants.size - readyPassVariants
    || passSummary.uniqueFailedVariants !== 0)
  {
    fail(`${backend} pass summary does not reconcile with its variants`);
  }

  const mappedOccurrences = new Map();
  for (let bodyIndex = 0; bodyIndex < record.bodyResults.length; bodyIndex += 1)
  {
    const body = record.bodyResults[bodyIndex];
    if (body?.bodyIndex !== bodyIndex || body.status !== "qualified" || !Array.isArray(body.passes))
    {
      fail(`${backend} body result ${bodyIndex} is malformed or unqualified`);
    }
    for (const mapping of body.passes)
    {
      const variant = passVariants.get(mapping?.variantId);
      if (!variant || mapping.passKey !== variant.passKey || mapping.status !== variant.status)
      {
        fail(`${backend} body ${bodyIndex} references an inconsistent pass variant`);
      }
      mappedOccurrences.set(variant.id, (mappedOccurrences.get(variant.id) || 0) + 1);
    }
  }
  for (const variant of passVariants.values())
  {
    if (mappedOccurrences.get(variant.id) !== variant.occurrences)
    {
      fail(`${backend}:${variant.id} occurrence count does not match body mappings`);
    }
  }
  return { stageVariants, passVariants };
}

/**
 * Converts a format-webgpu exhaustive qualification report into validated
 * descriptor-only pipelines suitable for CjsWebGPUDevice.PreparePipeline.
 * Repeated permutation occurrences remain coverage metadata and are not
 * redundantly compiled when their exact pass variant is identical.
 *
 * @param {object} matrix CJS_WEBGPU_EFFECT_MATRIX report.
 * @returns {object} Plain preparation matrix with unique ready pipelines.
 */
export function buildMatrixPipelines(matrix)
{
  if (matrix?.format !== "CJS_WEBGPU_EFFECT_MATRIX" || matrix.formatVersion !== 1)
  {
    fail("input must be a version 1 CJS_WEBGPU_EFFECT_MATRIX report");
  }
  if (matrix.status !== "qualified") fail("report is not exhaustively qualified");
  if (matrix.comparison?.axesMatch !== true || matrix.comparison.activeTopologyMatch !== true)
  {
    fail("report has permutation-axis or active-topology drift");
  }
  if (!matrix.backends || typeof matrix.backends !== "object"
    || BACKEND_NAMES.some((backend) => !matrix.backends[backend])
    || Object.keys(matrix.backends).some((backend) => !BACKEND_NAMES.includes(backend)))
  {
    fail("report must contain exactly dx11 and dx12 backend records");
  }
  for (const backend of BACKEND_NAMES) validateBackendRecord(backend, matrix.backends[backend]);

  const pipelines = [];
  const ids = new Set();
  let coveredOccurrences = 0;
  const shaderModules = new Map();
  let coveredShaderOccurrences = 0;
  for (const backend of BACKEND_NAMES)
  {
    const record = matrix.backends[backend];
    for (const variant of record.stageVariants)
    {
      if (!variant?.independentShader) continue;
      const shader = variant.independentShader;
      if (typeof shader.code !== "string" || !shader.code || typeof shader.entryPoint !== "string" || !shader.entryPoint)
      {
        fail(`${backend}:${variant.digest || "stage variant"} has malformed independently emitted WGSL`);
      }
      const key = `${shader.stage}\u0000${shader.entryPoint}\u0000${shader.code}`;
      const occurrences = variant.occurrences;
      coveredShaderOccurrences += occurrences;
      if (!shaderModules.has(key))
      {
        shaderModules.set(key, {
          id: `${backend}:${variant.digest}`,
          stage: shader.stage,
          entryPoint: shader.entryPoint,
          code: shader.code,
          occurrences: 0,
          sources: []
        });
      }
      const module = shaderModules.get(key);
      module.occurrences += occurrences;
      module.sources.push({ backend, digest: variant.digest, keys: variant.keys || [] });
    }
    for (const variant of record.passVariants)
    {
      if (variant?.status !== "ready") continue;
      if (!variant.wgsl) fail(`${backend}:${variant.id || variant.passKey} is ready without WGSL`);
      const id = `${backend}:${variant.id}`;
      if (ids.has(id)) fail(`duplicate ready variant ${id}`);
      ids.add(id);
      const pkg = CjsWebGPUPackage.from({
        sourcePath: record.sourcePath || backend,
        analysis: passAnalysis(variant),
        wgsl: variant.wgsl
      });
      const pipeline = pkg.GetPipeline(variant.techniqueName, variant.passIndex);
      if (!pipeline?.HasCompleteWgsl()) fail(`${id} did not produce a complete engine pipeline`);
      const occurrences = variant.occurrences;
      coveredOccurrences += occurrences;
      pipelines.push({
        id,
        backend,
        variantId: variant.id,
        passKey: variant.passKey,
        occurrences,
        exampleBodyIndex: variant.exampleBodyIndex,
        exampleOptions: variant.exampleOptions || [],
        pipeline: pipeline.ToJSON()
      });
    }
  }
  return {
    format: "CJS_WEBGPU_PREPARE_MATRIX",
    formatVersion: 1,
    sourceFormat: matrix.format,
    uniqueShaderModules: shaderModules.size,
    coveredShaderOccurrences,
    shaderModules: Array.from(shaderModules.values()),
    uniquePipelines: pipelines.length,
    coveredOccurrences,
    pipelines
  };
}
