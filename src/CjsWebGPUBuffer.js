import { cloneJson } from "./core/freeze.js";
import { CjsWebGPUResource } from "./CjsWebGPUResource.js";

/**
 * Immutable WebGPU-facing buffer binding descriptor.
 */
export class CjsWebGPUBuffer extends CjsWebGPUResource
{

  /**
   * @param {object} values Descriptor values.
   */
  constructor(values = {})
  {
    super(values);
    this.bufferKind = String(values.bufferKind || "buffer");
    Object.freeze(this);
  }

  /**
   * @returns {object} Plain JSON-compatible descriptor.
   */
  ToJSON()
  {
    return {
      ...cloneJson(super.ToJSON()),
      bufferKind: this.bufferKind
    };
  }
}
