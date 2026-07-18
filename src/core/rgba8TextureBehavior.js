export const WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR = "webgpu_rgba8_texture";

function assertPlainObject(value, label)
{
  if (!value || typeof value !== "object" || Array.isArray(value))
  {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
  {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function assertNonEmptyString(value, label)
{
  if (typeof value !== "string" || value.trim() === "")
  {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertSynchronous(value, label)
{
  if (value && (typeof value === "object" || typeof value === "function")
    && typeof value.then === "function")
  {
    Promise.resolve(value).catch(() => {});
    throw new TypeError(`${label} must be synchronous`);
  }
  return value;
}

/**
 * Create a CjsLibrary-owned request recipe for decoded RGBA8 texture
 * publication. The application injects path matching/fallback policy; this
 * behavior only describes the selected presentation and never probes a GPU.
 */
export function createWebGPURgba8TextureResourceBehavior(options = {})
{
  assertPlainObject(options, "WebGPU RGBA8 texture behavior options");
  const allowed = new Set([
    "format", "matchPath", "resolvePath", "requirement", "emit"
  ]);
  for (const key of Object.keys(options))
  {
    if (!allowed.has(key)) throw new TypeError(`WebGPU RGBA8 texture behavior has unsupported ${key}`);
  }

  const {
    format,
    matchPath,
    resolvePath,
    requirement = "image",
    emit = "rgba"
  } = options;
  assertNonEmptyString(requirement, "WebGPU RGBA8 texture behavior requirement");
  assertNonEmptyString(emit, "WebGPU RGBA8 texture behavior emit");
  if (format !== undefined
    && typeof format !== "function"
    && (typeof format !== "string" || format.trim() === ""))
  {
    throw new TypeError("WebGPU RGBA8 texture behavior format must be a format class or non-empty registered name");
  }
  if (matchPath !== undefined && typeof matchPath !== "function")
  {
    throw new TypeError("WebGPU RGBA8 texture behavior matchPath must be a function");
  }
  if (resolvePath !== undefined && typeof resolvePath !== "function")
  {
    throw new TypeError("WebGPU RGBA8 texture behavior resolvePath must be a function");
  }

  const request = {
    requirement,
    emit
  };
  if (format !== undefined) request.format = format;

  const behavior = {
    id: WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR,
    request: Object.freeze(request),

    CanResolveResourceRequest(context = {})
    {
      if (context?.capabilities?.webgpu !== true || typeof context?.path !== "string" || !matchPath)
      {
        return false;
      }
      const result = assertSynchronous(
        matchPath(context),
        "WebGPU RGBA8 texture behavior matchPath"
      );
      if (typeof result !== "boolean")
      {
        throw new TypeError("WebGPU RGBA8 texture behavior matchPath must return boolean");
      }
      return result;
    }
  };

  if (resolvePath)
  {
    behavior.ResolveResourceRequest = (context = {}) =>
    {
      const path = assertSynchronous(
        resolvePath(context),
        "WebGPU RGBA8 texture behavior resolvePath"
      );
      assertNonEmptyString(path, "WebGPU RGBA8 texture behavior resolved path");
      return Object.freeze({ path });
    };
  }

  return Object.freeze(behavior);
}
