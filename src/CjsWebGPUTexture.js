import { cloneJson } from "./core/freeze.js";
import { CjsWebGPUResource } from "./CjsWebGPUResource.js";

/**
 * Immutable WebGPU-facing texture binding descriptor.
 */
export class CjsWebGPUTexture extends CjsWebGPUResource
{

  /**
   * @param {object} values Descriptor values.
   */
  constructor(values = {})
  {
    super(values);
    this.textureKind = String(values.textureKind || "2d");
    this.arrayElements = Number.isInteger(values.arrayElements) ? values.arrayElements : 1;
    this.isSRGB = Boolean(values.isSRGB);
    Object.freeze(this);
  }

  /**
   * @returns {object} Plain JSON-compatible descriptor.
   */
  ToJSON()
  {
    return {
      ...cloneJson(super.ToJSON()),
      textureKind: this.textureKind,
      arrayElements: this.arrayElements,
      isSRGB: this.isSRGB
    };
  }
}
