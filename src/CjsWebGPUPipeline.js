import { cloneJson, deepFreeze } from "./core/freeze.js";

/**
 * Immutable WebGPU-facing pass/pipeline descriptor.
 */
export class CjsWebGPUPipeline
{

  /**
   * @param {object} values Descriptor values.
   */
  constructor(values = {})
  {
    this.key = String(values.key || "");
    this.techniqueName = String(values.techniqueName || "");
    this.passIndex = Number.isInteger(values.passIndex) ? values.passIndex : 0;
    this.renderStates = Number.isInteger(values.renderStates) ? values.renderStates : 0;
    this.states = deepFreeze(cloneJson(values.states || []));
    this.shaderModules = deepFreeze(Array.isArray(values.shaderModules) ? values.shaderModules.slice() : []);
    this.bindGroups = deepFreeze(Array.isArray(values.bindGroups) ? values.bindGroups.slice() : []);
    Object.freeze(this);
  }

  /**
   * @param {string} stageName Stage name.
   * @returns {any|null} Matching shader-module descriptor.
   */
  GetShaderModule(stageName)
  {
    return this.shaderModules.find((entry) => entry.stageName === stageName) || null;
  }

  /**
   * @returns {boolean} True when every stage in the pipeline has WGSL text.
   */
  HasCompleteWgsl()
  {
    return this.shaderModules.length > 0 && this.shaderModules.every((entry) => entry.HasWgsl());
  }

  /**
   * @returns {object} Plain JSON-compatible descriptor.
   */
  ToJSON()
  {
    return cloneJson({
      key: this.key,
      techniqueName: this.techniqueName,
      passIndex: this.passIndex,
      renderStates: this.renderStates,
      states: this.states,
      shaderModules: this.shaderModules.map((entry) => entry.ToJSON()),
      bindGroups: this.bindGroups.map((entry) => entry.ToJSON())
    });
  }
}
