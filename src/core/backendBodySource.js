import { cloneJson } from "./freeze.js";

/**
 * Raw-package ingestion seam.
 *
 * A raw `CEWGPU` reader result carries the `WGSB` `CJS_WGSL_BODY_SET` chunk that
 * the default JSON emit cannot express: `packageToJson` does not project
 * `backendBodySet`, and its `chunks[]` carries `{tag,size,offset}` with no
 * bytes. Raw emit is therefore the only route to every translated body.
 *
 * The engine duck-types that reader rather than importing it, mirroring the
 * existing injected-reader discipline. Nothing here names a WebGPU type: a
 * body/pass/unit graph is source-language independent, and only the payload
 * inside a unit is WGSL.
 */

const RAW_PACKAGE_METHODS = Object.freeze([ "GetBackendBodyPrograms" ]);

/**
 * Report whether a value is a raw package rather than plain package JSON.
 *
 * @param {any} value Candidate package input.
 * @returns {boolean} True when the value exposes the raw backend-body accessor.
 */
export function isRawPackage(value)
{
  return !!value
    && typeof value === "object"
    && RAW_PACKAGE_METHODS.every((name) => typeof value[name] === "function");
}

/**
 * Project a raw package onto the plain shape `normalizePackageShape` consumes.
 *
 * The projection is deliberately narrow: it reproduces exactly the fields the
 * existing path already reads, so a raw package and its JSON emit converge on
 * one normalized document.
 *
 * @param {object} value Raw package.
 * @returns {object} Plain package data.
 */
export function projectRawPackage(value)
{
  return {
    format: "CEWGPU",
    version: value.version,
    sourcePath: value.sourcePath,
    info: value.info,
    metadata: value.metadata,
    analysis: value.analysisJson ?? null,
    wgsl: value.wgslJson ?? null,
    chunks: Array.isArray(value.chunks)
      ? value.chunks.map(({ tag, size, offset }) => ({ tag, size, offset }))
      : []
  };
}

/**
 * Build an engine-owned view of a raw package's translated bodies.
 *
 * Returns null when the package carries no body set at all, which is a
 * legitimate state for a selected-mode package rather than an error.
 *
 * @param {object} value Raw package.
 * @returns {object|null} Backend body source, or null when there is no body set.
 */
export function createBackendBodySource(value)
{
  if (!isRawPackage(value))
  {
    throw new TypeError("CjsWebGPUPackage: backend body source requires a raw package reader result");
  }

  const bodySet = value.backendBodySet ?? null;
  if (!bodySet) return null;

  // `unit.key` is a per-package ordinal ("unit0", "unit1", ...) and collides
  // across packages, so it is a lookup key here and a diagnostic label
  // elsewhere - never a cache key. `unit.sha256` is the shareable identity.
  const unitsByKey = new Map();
  for (const unit of Array.isArray(bodySet.passUnits) ? bodySet.passUnits : [])
  {
    if (typeof unit?.key !== "string" || !unit.key)
    {
      throw new Error("CEWGPU body set contains a translation unit without a key");
    }
    if (typeof unit.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(unit.sha256))
    {
      throw new Error(`CEWGPU translation unit ${unit.key} has no sha256 identity`);
    }
    if (unitsByKey.has(unit.key))
    {
      throw new Error(`CEWGPU body set duplicates translation unit ${unit.key}`);
    }
    unitsByKey.set(unit.key, unit);
  }

  const bodyCount = Array.isArray(bodySet.bodies) ? bodySet.bodies.length : 0;

  return Object.freeze({
    sourcePath: value.sourcePath,
    bodyCount,
    unitCount: unitsByKey.size,
    // Every permutation maps to a body; the body set stores only the unique
    // ones. Both counts are needed to state coverage honestly.
    permutationCount: Number.isInteger(value.info?.permutationGraph?.permutationCount)
      ? value.info.permutationGraph.permutationCount
      : 0,

    /**
     * Resolve one permutation index to its translated passes.
     *
     * @param {number} permutationIndex Exact PGRF permutation index.
     * @returns {object} Resolved body record.
     */
    ResolveBody(permutationIndex)
    {
      const resolved = value.GetBackendBodyPrograms(permutationIndex);

      // Null is never "this body has no passes". It is either "the package did
      // not pass canonical envelope validation" or "there is no WGSB/PGRF to
      // join". Both are ingestion faults worth naming separately from an
      // unsupported body, which is a success return.
      if (!resolved)
      {
        throw new Error(
          `CEWGPU permutation ${permutationIndex} resolved no backend body: the package has a body set of `
          + `${bodyCount} bodies, so either it failed envelope validation, it carries no permutation graph, `
          + "or that permutation index is out of range"
        );
      }

      // An unsupported body is a success return carrying its reason. Surface
      // the reason; never crash on it and never silently skip it.
      if (resolved.status !== "translated")
      {
        return Object.freeze({
          permutationIndex: resolved.permutationIndex,
          bodyKey: resolved.bodyKey,
          status: resolved.status,
          error: resolved.error ?? null,
          passes: Object.freeze([])
        });
      }

      // `GetBackendBodyPrograms` hands back live, unfrozen objects shared
      // across calls - they are the reader's own internal state. Clone before
      // the package deep-freezes anything, or the engine freezes another
      // package's internals.
      const passes = (resolved.passes || []).map((pass) =>
      {
        const unit = unitsByKey.get(pass.unitKey);
        if (!unit)
        {
          throw new Error(
            `CEWGPU body ${resolved.bodyKey} references missing translation unit ${pass.unitKey}`
          );
        }
        return Object.freeze({
          passKey: pass.passKey,
          unitKey: pass.unitKey,
          sha256: unit.sha256,
          wgslSetVersion: pass.wgslSetVersion,
          shaders: cloneJson(pass.shaders || []),
          layouts: cloneJson(pass.layouts || []),
          resourceTransforms: pass.resourceTransforms ? cloneJson(pass.resourceTransforms) : null
        });
      });

      return Object.freeze({
        permutationIndex: resolved.permutationIndex,
        bodyKey: resolved.bodyKey,
        status: resolved.status,
        error: null,
        passes: Object.freeze(passes)
      });
    }
  });
}
