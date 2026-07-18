import assert from "node:assert/strict";
import { test } from "node:test";

import {
  WEBGPU_RGBA8_TEXTURE_PREPARE_PIPELINE,
  WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR,
  createWebGPURgba8TextureResourceBehavior
} from "../src/index.js";
import { CjsLibrary } from "../../runtime-core/src/index.js";

test("RGBA8 texture behavior carries a fail-closed CjsLibrary request recipe", () =>
{
  class Format {}
  const behavior = createWebGPURgba8TextureResourceBehavior({
    format: Format,
    matchPath: ({ path }) => /\.(?:png|tga)$/iu.test(path)
  });

  assert.equal(Object.isFrozen(behavior), true);
  assert.equal(Object.isFrozen(behavior.request), true);
  assert.equal(behavior.id, WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR);
  assert.equal(WEBGPU_RGBA8_TEXTURE_PREPARE_PIPELINE, "webgpu_rgba8_texture");
  assert.deepEqual(behavior.request, {
    requirement: "image",
    emit: "rgba",
    preparePipeline: "webgpu_rgba8_texture",
    format: Format
  });
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/texture/albedo.png",
    capabilities: { webgpu: true }
  }), true);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/texture/albedo.png",
    capabilities: { webgpu: false }
  }), false);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/texture/albedo.dds",
    capabilities: { webgpu: true }
  }), false);
  assert.equal(createWebGPURgba8TextureResourceBehavior().CanResolveResourceRequest({
    path: "res:/texture/albedo.png",
    capabilities: { webgpu: true }
  }), false);
});

test("RGBA8 texture behavior combines an application path fallback with presentation", () =>
{
  const behavior = createWebGPURgba8TextureResourceBehavior({
    requirement: "decoded-image",
    preparePipeline: "webgpu_rgba8_texture_srgb",
    matchPath: ({ path, capabilities }) => path.endsWith(".dds") && capabilities.dds === false,
    resolvePath: ({ path }) => path.replace(/\.dds$/u, ".png")
  });
  const context = {
    path: "res:/texture/albedo.dds",
    capabilities: { webgpu: true, dds: false }
  };

  assert.equal(behavior.CanResolveResourceRequest(context), true);
  assert.deepEqual(behavior.ResolveResourceRequest(context), {
    path: "res:/texture/albedo.png"
  });
  assert.deepEqual(behavior.request, {
    requirement: "decoded-image",
    emit: "rgba",
    preparePipeline: "webgpu_rgba8_texture_srgb"
  });
});

test("RGBA8 texture behavior resolves through CjsLibrary with normal override semantics", () =>
{
  const behavior = createWebGPURgba8TextureResourceBehavior({
    matchPath: ({ path, capabilities }) => /\.dds$/u.test(path) && capabilities.dds === false,
    resolvePath: ({ path }) => path.replace(/\.dds$/u, ".png")
  });
  const library = new CjsLibrary({
    capabilities: { webgpu: true, dds: false },
    resourceDefaults: { payload: "texture" },
    behaviors: {
      [WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR]: {
        behavior,
        default: true,
        priority: 50
      }
    }
  });

  const resolved = library.ResolveResourceRequest("res:/texture/albedo.dds");
  assert.equal(resolved.path, "res:/texture/albedo.png");
  assert.equal(resolved.behaviorName, WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR);
  assert.equal(resolved.behavior, behavior);
  assert.deepEqual(resolved.options, {
    payload: "texture",
    requirement: "image",
    emit: "rgba",
    preparePipeline: "webgpu_rgba8_texture"
  });
  assert.equal(Object.isFrozen(resolved.options), true);

  library.SetCapability("webgpu", false);
  const forced = library.ResolveResourceRequest("res:/texture/albedo.dds", {
    behavior: WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR,
    emit: "rgba"
  });
  assert.equal(forced.behaviorName, WEBGPU_RGBA8_TEXTURE_RESOURCE_BEHAVIOR);
  assert.equal(forced.path, "res:/texture/albedo.png");

  const disabled = library.ResolveResourceRequest("res:/texture/albedo.dds", {
    behavior: false,
    requirement: "raw"
  });
  assert.equal(disabled.path, "res:/texture/albedo.dds");
  assert.equal(disabled.behaviorName, null);
  assert.deepEqual(disabled.options, { payload: "texture", requirement: "raw" });
});

test("RGBA8 texture behavior validates injected synchronous policy", async () =>
{
  assert.throws(
    () => createWebGPURgba8TextureResourceBehavior({ emit: "" }),
    /emit must be a non-empty string/u
  );
  assert.throws(
    () => createWebGPURgba8TextureResourceBehavior({ matchPath: true }),
    /matchPath must be a function/u
  );
  assert.throws(
    () => createWebGPURgba8TextureResourceBehavior({ unknown: true }),
    /unsupported unknown/u
  );
  const asyncMatcher = createWebGPURgba8TextureResourceBehavior({
    matchPath: async () => { throw new Error("rejected matcher must be observed"); }
  });
  assert.throws(
    () => asyncMatcher.CanResolveResourceRequest({ path: "res:/a.png", capabilities: { webgpu: true } }),
    /matchPath must be synchronous/u
  );
  const invalidMatcher = createWebGPURgba8TextureResourceBehavior({ matchPath: () => "yes" });
  assert.throws(
    () => invalidMatcher.CanResolveResourceRequest({ path: "res:/a.png", capabilities: { webgpu: true } }),
    /matchPath must return boolean/u
  );
  const asyncResolver = createWebGPURgba8TextureResourceBehavior({
    resolvePath: async () => { throw new Error("rejected resolver must be observed"); }
  });
  assert.throws(
    () => asyncResolver.ResolveResourceRequest({ path: "res:/a.dds" }),
    /resolvePath must be synchronous/u
  );
  const invalidResolver = createWebGPURgba8TextureResourceBehavior({
    resolvePath: () => ""
  });
  assert.throws(
    () => invalidResolver.ResolveResourceRequest({ path: "res:/a.dds" }),
    /resolved path must be a non-empty string/u
  );
  await new Promise((resolve) => setImmediate(resolve));
});
