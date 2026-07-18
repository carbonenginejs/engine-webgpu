import {
  buildEveSpaceObjectMainUniformData,
  getEveSpaceObjectMainMaterialConstants
} from "./spaceObjectMainBindings.js";

export const EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR = "webgpu_eve_space_object_main";

/**
 * Creates the engine-owned portion of the Eve space-object Main behavior.
 *
 * The request recipe is consumed by CjsLibrary before CjsResMan is called.
 * BuildUniformData remains on the behavior and is called later by render
 * orchestration with current frame/object/material values.
 */
export function createEveSpaceObjectMainResourceBehavior(options = {})
{
  if (!options || typeof options !== "object" || Array.isArray(options))
  {
    throw new TypeError("Eve space-object Main behavior options must be an object");
  }
  const {
    format,
    requirement = "webgpu-package",
    emit = "json",
    preparePipeline = "webgpu_package"
  } = options;
  if (typeof requirement !== "string" || requirement.trim() === "")
  {
    throw new TypeError("Eve space-object Main behavior requirement must be a non-empty string");
  }
  if (typeof emit !== "string" || emit.trim() === "")
  {
    throw new TypeError("Eve space-object Main behavior emit must be a non-empty string");
  }
  if (typeof preparePipeline !== "string" || preparePipeline.trim() === "")
  {
    throw new TypeError("Eve space-object Main behavior preparePipeline must be a non-empty string");
  }

  const request = {
    requirement,
    emit,
    preparePipeline
  };
  if (format !== undefined)
  {
    if (typeof format !== "function" && (typeof format !== "string" || format.trim() === ""))
    {
      throw new TypeError("Eve space-object Main behavior format must be a format class or non-empty registered name");
    }
    request.format = format;
  }

  return Object.freeze({
    id: EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR,
    request: Object.freeze(request),

    CanResolveResourceRequest({ path, capabilities = {} } = {})
    {
      return typeof path === "string"
        && /\.cewgpu(?:[?#].*)?$/iu.test(path)
        && capabilities.webgpu === true;
    },

    GetMaterialConstants: getEveSpaceObjectMainMaterialConstants,
    BuildUniformData: buildEveSpaceObjectMainUniformData
  });
}
