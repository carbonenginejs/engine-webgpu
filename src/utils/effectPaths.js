const QUALITY_TO_SUFFIX = new Map([
  [ "low", "sm_lo" ],
  [ "lo", "sm_lo" ],
  [ "medium", "sm_hi" ],
  [ "med", "sm_hi" ],
  [ "hi", "sm_hi" ],
  [ "high", "sm_depth" ],
  [ "depth", "sm_depth" ],
  [ "sm_lo", "sm_lo" ],
  [ "sm_hi", "sm_hi" ],
  [ "sm_depth", "sm_depth" ]
]);

/**
 * Normalize a Carbon-style effect path for backend routing.
 *
 * @param {string} path Effect path.
 * @returns {string} Lowercased, slash-normalized path.
 */
export function normalizeEffectPath(path)
{
  return String(path || "").trim().replaceAll("\\", "/").toLowerCase();
}

/**
 * Map a quality label to Carbon's compiled shader suffix.
 *
 * @param {string} quality Quality or suffix token.
 * @returns {string} Compiled suffix without the leading dot.
 */
export function shaderModelSuffix(quality = "high")
{
  const normalized = normalizeEffectPath(quality);
  if (!QUALITY_TO_SUFFIX.has(normalized))
  {
    throw new Error(`Unknown WebGPU shader quality ${JSON.stringify(quality)}`);
  }
  return QUALITY_TO_SUFFIX.get(normalized);
}

/**
 * Rewrite an authored `/effect/*.fx` path to a backend-owned compiled path
 * while preserving the real shader basename.
 *
 * @param {string} path Authored Carbon effect path.
 * @param {object} [options] Rewrite options.
 * @param {string} [options.effectRoot="/effect.webgpu/"] Compiled effect root.
 * @param {string} [options.quality="high"] Quality token.
 * @returns {string} Rewritten compiled path.
 */
export function toCompiledEffectPath(path, options = {})
{
  const effectRoot = normalizeEffectPath(options.effectRoot || "/effect.webgpu/");
  const suffix = shaderModelSuffix(options.quality || "high");
  let normalized = normalizeEffectPath(path);

  if (!normalized)
  {
    return normalized;
  }

  if (normalized.endsWith(".fx"))
  {
    normalized = normalized.slice(0, -3);
    if (normalized.includes("/effect/"))
    {
      normalized = normalized.replace("/effect/", effectRoot);
    }
    return `${normalized}.${suffix}`;
  }

  return normalized;
}
