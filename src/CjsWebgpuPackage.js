import { buildPackageJson, buildPipelines, buildShaderModules, normalizePackageShape } from "./core/packageHelpers.js";
import { createBackendBodySource, isRawPackage, projectRawPackage } from "./core/backendBodySource.js";
import { deepFreeze } from "./core/freeze.js";

/**
 * Immutable descriptor-only consumer for `CEWGPU` package data.
 */
export class CjsWebgpuPackage
{

  /**
   * Create a descriptor package from plain package data.
   *
   * @param {object} value Plain package data from `format-webgpu`.
   * @returns {CjsWebgpuPackage} Immutable descriptor package.
   */
  static from(value)
  {
    return new CjsWebgpuPackage(value);
  }

  /**
   * Create a descriptor package from bytes using an injected reader.
   *
   * @param {Uint8Array|ArrayBuffer|Buffer|DataView} bytes Package bytes.
   * @param {object} options Options with an injected `read` function.
   * @param {Function} options.read Reader such as `CjsWebgpuFormat.read`.
   * @param {object} [options.readOptions] Options forwarded to `read`.
   * @returns {CjsWebgpuPackage} Immutable descriptor package.
   */
  static fromBytes(bytes, options = {})
  {
    if (typeof options.read !== "function")
    {
      throw new TypeError("CjsWebgpuPackage.fromBytes: options.read must be a function such as CjsWebgpuFormat.read");
    }

    return CjsWebgpuPackage.from(options.read(bytes, options.readOptions || {}));
  }

  /**
   * @param {object} value Plain package data from `format-webgpu`.
   */
  constructor(value)
  {
    // A raw reader result carries the WGSB body set; plain JSON never can. Both
    // converge on one normalized document, so the existing path is untouched.
    const raw = isRawPackage(value);
    const normalized = normalizePackageShape(raw ? projectRawPackage(value) : value);
    const shaderModules = buildShaderModules(normalized);
    const { pipelines, bindGroups } = buildPipelines(normalized, shaderModules);

    this.format = normalized.format;
    this.version = normalized.version;
    this.sourcePath = normalized.sourcePath;
    this.info = deepFreeze(normalized.info);
    this.metadata = deepFreeze(normalized.metadata);
    this.analysis = deepFreeze(normalized.analysis);
    this.wgsl = deepFreeze(normalized.wgsl);
    this.chunks = deepFreeze(normalized.chunks);
    this.shaderModules = deepFreeze(shaderModules);
    this.pipelines = deepFreeze(pipelines);
    this.bindGroups = deepFreeze(bindGroups);
    this.backendBodySource = raw ? createBackendBodySource(value) : null;
    this._json = buildPackageJson(normalized, shaderModules, pipelines, bindGroups);
    Object.freeze(this);
  }

  /**
   * Resolve one permutation index to its translated backend passes.
   *
   * @param {number} permutationIndex Exact PGRF permutation index.
   * @returns {object|null} Resolved body record, or null without a body set.
   */
  GetBackendBody(permutationIndex)
  {
    return this.backendBodySource ? this.backendBodySource.ResolveBody(permutationIndex) : null;
  }

  /**
   * @param {string} techniqueName Technique name.
   * @param {number} [passIndex=0] Pass index.
   * @returns {any|null} Matching pipeline descriptor.
   */
  GetPipeline(techniqueName, passIndex = 0)
  {
    return this.pipelines.find((entry) => entry.techniqueName === techniqueName && entry.passIndex === passIndex) || null;
  }

  /**
   * @param {string} key Shader-module key.
   * @returns {any|null} Matching shader-module descriptor.
   */
  GetShaderModule(key)
  {
    return this.shaderModules.find((entry) => entry.key === key) || null;
  }

  /**
   * @param {string} key Bind-group key.
   * @returns {any|null} Matching bind-group descriptor.
   */
  GetBindGroup(key)
  {
    return this.bindGroups.find((entry) => entry.key === key) || null;
  }

  /**
   * @returns {object} Plain JSON-compatible descriptor package.
   */
  ToJSON()
  {
    return this._json;
  }
}
