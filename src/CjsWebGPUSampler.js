import { cloneJson } from "./core/freeze.js";
import { CjsWebGPUResource } from "./CjsWebGPUResource.js";

/**
 * Immutable WebGPU-facing sampler binding descriptor.
 */
export class CjsWebGPUSampler extends CjsWebGPUResource
{

  /**
   * @param {object} values Descriptor values.
   */
  constructor(values = {})
  {
    super(values);
    Object.freeze(this);
  }

  /**
   * @returns {object} Plain JSON-compatible descriptor.
   */
  ToJSON()
  {
    return cloneJson(super.ToJSON());
  }
}
