import assert from "node:assert/strict";
import test from "node:test";
import { CjsWebGPUPackage } from "../src/index.js";
import { createBackendBodySource, isRawPackage } from "../src/core/backendBodySource.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function samplerBinding(binding)
{
  return {
    identity: "sampler:0:0",
    scopeIdentity: "sampler:0:0@fragment",
    resourceKind: "sampler",
    generatedSymbol: "s0",
    registerSpace: 0,
    registerIndex: 0,
    group: 0,
    binding,
    visibility: [ "fragment" ],
    type: "sampler",
    sampler: { type: "filtering" }
  };
}

function unit(key, sha256, passKey)
{
  return {
    key,
    sha256,
    wgslSetVersion: 3,
    shaders: [ {
      key: `${passKey}.vertex`,
      stageName: "vertex",
      entryPoint: "main",
      code: "// vertex",
      sourceMap: []
    } ],
    layouts: [ { key: passKey, bindGroups: [ { group: 0, bindings: [ samplerBinding(0) ] } ] } ]
  };
}

function wgslDocument()
{
  return {
    format: "CJS_WGSL_SET",
    formatVersion: 3,
    shaders: [],
    layouts: [ { key: "Main.pass0", bindGroups: [ { group: 0, bindings: [ samplerBinding(0) ] } ] } ]
  };
}

function analysisDocument()
{
  return {
    source: "res:/test/effect.dx11/quad.sm_hi",
    stages: [ {
      key: "Main.pass0.pixel",
      techniqueName: "Main",
      passIndex: 0,
      stageName: "pixel",
      stageType: 1,
      bindings: []
    } ]
  };
}

/**
 * A raw reader result: only the surface the engine duck-types, and deliberately
 * no runtime-resource import.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Raw-shaped package fake.
 */
function rawPackage(overrides = {})
{
  const bodies = overrides.bodies ?? [ {
    bodyKey: "body0",
    status: "translated",
    passes: [ { passKey: "Main.pass0", unitKey: "unit0" }, { passKey: "Depth.pass0", unitKey: "unit1" } ]
  } ];
  const passUnits = overrides.passUnits
    ?? [ unit("unit0", SHA_A, "Main.pass0"), unit("unit1", SHA_B, "Depth.pass0") ];
  const shared = passUnits.map((entry) => ({ ...entry }));

  return {
    version: 1,
    sourcePath: "res:/test/effect.dx11/quad.sm_hi",
    info: { format: "CEWGPU", formatVersion: 3 },
    metadata: { bodyIndex: 4, bodyMode: "all" },
    analysisJson: analysisDocument(),
    wgslJson: wgslDocument(),
    chunks: [ { tag: "WGSB", size: 8, offset: 16, bytes: new Uint8Array(8) } ],
    backendBodySet: overrides.backendBodySet !== undefined
      ? overrides.backendBodySet
      : { bodies, passUnits },
    GetBackendBodyPrograms(permutationIndex)
    {
      if (overrides.resolve) return overrides.resolve(permutationIndex);
      const body = bodies[permutationIndex];
      if (!body) return null;
      if (body.status !== "translated")
      {
        return {
          permutationIndex,
          bodyKey: body.bodyKey,
          status: body.status,
          error: body.error,
          passes: []
        };
      }
      // Live, shared, unfrozen objects - exactly what the real reader returns.
      return {
        permutationIndex,
        bodyKey: body.bodyKey,
        status: "translated",
        error: null,
        passes: body.passes.map((pass) =>
        {
          const source = shared.find((entry) => entry.key === pass.unitKey) ?? {};
          return {
            passKey: pass.passKey,
            unitKey: pass.unitKey,
            wgslSetVersion: source.wgslSetVersion ?? null,
            shaders: source.shaders ?? [],
            layouts: source.layouts ?? []
          };
        })
      };
    },
    _shared: shared
  };
}

/**
 * The same package as plain JSON: no body set can survive this emit.
 *
 * @returns {object} JSON-shaped package fake.
 */
function jsonPackage()
{
  return {
    format: "CEWGPU",
    version: 1,
    sourcePath: "res:/test/effect.dx11/quad.sm_hi",
    info: { format: "CEWGPU", formatVersion: 3 },
    metadata: { bodyIndex: 4, bodyMode: "selected" },
    analysis: analysisDocument(),
    wgsl: wgslDocument(),
    chunks: [ { tag: "WGSL", size: 8, offset: 16 } ]
  };
}

test("raw and JSON package inputs converge on the same normalized descriptors", () =>
{
  const fromRaw = CjsWebGPUPackage.from(rawPackage());
  const fromJson = CjsWebGPUPackage.from(jsonPackage());

  assert.equal(isRawPackage(rawPackage()), true);
  assert.equal(isRawPackage(jsonPackage()), false);

  assert.deepEqual(fromRaw.wgsl, fromJson.wgsl);
  assert.deepEqual(fromRaw.analysis, fromJson.analysis);
  assert.equal(fromRaw.sourcePath, fromJson.sourcePath);
  assert.equal(fromRaw.pipelines.length, fromJson.pipelines.length);
  assert.deepEqual(
    fromRaw.pipelines[0].bindGroups[0].bindings[0].scopeIdentity,
    fromJson.pipelines[0].bindGroups[0].bindings[0].scopeIdentity
  );

  // Only the raw path can carry a body set.
  assert.equal(fromJson.backendBodySource, null);
  assert.equal(fromJson.GetBackendBody(0), null);
  assert.notEqual(fromRaw.backendBodySource, null);
});

test("a raw package exposes its body set keyed by translation-unit identity", () =>
{
  const pkg = CjsWebGPUPackage.from(rawPackage());
  assert.equal(pkg.backendBodySource.bodyCount, 1);
  assert.equal(pkg.backendBodySource.unitCount, 2);

  const body = pkg.GetBackendBody(0);
  assert.equal(body.status, "translated");
  assert.equal(body.bodyKey, "body0");
  assert.equal(body.error, null);
  assert.deepEqual(body.passes.map((pass) => pass.passKey), [ "Main.pass0", "Depth.pass0" ]);
  // sha256, not the per-package ordinal key, is the shareable identity.
  assert.deepEqual(body.passes.map((pass) => pass.sha256), [ SHA_A, SHA_B ]);
  assert.deepEqual(body.passes.map((pass) => pass.unitKey), [ "unit0", "unit1" ]);
  assert.equal(body.passes[0].wgslSetVersion, 3);
  assert.equal(body.passes[0].resourceTransforms, null);
});

test("a raw body source clones the reader's live shared unit objects", () =>
{
  const raw = rawPackage();
  const source = createBackendBodySource(raw);
  const first = source.ResolveBody(0);
  const second = source.ResolveBody(0);

  // The reader hands back the same objects on every call.
  assert.equal(raw.GetBackendBodyPrograms(0).passes[0].shaders, raw._shared[0].shaders);

  assert.notEqual(first.passes[0].shaders, raw._shared[0].shaders);
  assert.notEqual(first.passes[0].shaders, second.passes[0].shaders);
  assert.deepEqual(first.passes[0].shaders, raw._shared[0].shaders);

  Object.freeze(first.passes[0].shaders);
  assert.equal(Object.isFrozen(raw._shared[0].shaders), false);
});

test("an unsupported body is a success return carrying its reason", () =>
{
  const pkg = CjsWebGPUPackage.from(rawPackage({
    bodies: [ {
      bodyKey: "body7",
      status: "unsupported",
      error: "geometry stage is not supported",
      passes: []
    } ]
  }));

  const body = pkg.GetBackendBody(0);
  assert.equal(body.status, "unsupported");
  assert.equal(body.bodyKey, "body7");
  assert.equal(body.error, "geometry stage is not supported");
  assert.deepEqual(body.passes, []);
});

test("a null resolution is named as an ingestion fault, never as an empty body", () =>
{
  const pkg = CjsWebGPUPackage.from(rawPackage());
  assert.throws(
    () => pkg.GetBackendBody(9),
    /resolved no backend body.*failed envelope validation.*permutation graph.*out of range/su
  );
});

test("a package with no body set is not an error", () =>
{
  const pkg = CjsWebGPUPackage.from(rawPackage({ backendBodySet: null }));
  assert.equal(pkg.backendBodySource, null);
  assert.equal(pkg.GetBackendBody(0), null);
});

test("a body set with unusable translation-unit identities fails closed", () =>
{
  assert.throws(
    () => createBackendBodySource(rawPackage({
      passUnits: [ { ...unit("unit0", SHA_A, "Main.pass0"), sha256: undefined } ]
    })),
    /unit0 has no sha256 identity/u
  );

  assert.throws(
    () => createBackendBodySource(rawPackage({
      passUnits: [ unit("unit0", SHA_A, "Main.pass0"), unit("unit0", SHA_B, "Depth.pass0") ]
    })),
    /duplicates translation unit unit0/u
  );

  const missingUnit = rawPackage({ passUnits: [ unit("unit0", SHA_A, "Main.pass0") ] });
  assert.throws(
    () => createBackendBodySource(missingUnit).ResolveBody(0),
    /references missing translation unit unit1/u
  );
});

test("the backend body seam rejects a non-raw value", () =>
{
  assert.throws(
    () => createBackendBodySource(jsonPackage()),
    /requires a raw package reader result/u
  );
});
