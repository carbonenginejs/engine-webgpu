import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR,
  createEveSpaceObjectMainResourceBehavior
} from "../src/core/spaceObjectMainBehavior.js";
import {
  buildEveSpaceObjectMainUniformData,
  getEveSpaceObjectMainMaterialConstants
} from "../src/core/spaceObjectMainBindings.js";

test("space-object Main behavior carries the CjsLibrary recipe and live builder", () =>
{
  class Format {}
  const behavior = createEveSpaceObjectMainResourceBehavior({ format: Format });

  assert.equal(Object.isFrozen(behavior), true);
  assert.equal(Object.isFrozen(behavior.request), true);
  assert.equal(behavior.id, EVE_SPACE_OBJECT_MAIN_RESOURCE_BEHAVIOR);
  assert.deepEqual(behavior.request, {
    emit: "json",
    format: Format
  });
  assert.equal(behavior.GetMaterialConstants, getEveSpaceObjectMainMaterialConstants);
  assert.equal(behavior.BuildUniformData, buildEveSpaceObjectMainUniformData);
});

test("space-object Main behavior matches CEWGPU paths and registered WebGPU support", () =>
{
  const behavior = createEveSpaceObjectMainResourceBehavior();

  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/effect/quad.cewgpu",
    capabilities: { webgpu: true }
  }), true);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/effect/quad.CEWGPU?variant=main#pass0",
    capabilities: { webgpu: true }
  }), true);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/effect/quad.cewgpu",
    capabilities: {}
  }), false);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/effect/quad.cewgpu",
    capabilities: { webgpu: false }
  }), false);
  assert.equal(behavior.CanResolveResourceRequest({
    path: "res:/effect/quad.sm_5_0.hlsl",
    capabilities: { webgpu: true }
  }), false);
});

test("space-object Main behavior validates its request recipe", () =>
{
  assert.throws(
    () => createEveSpaceObjectMainResourceBehavior({ emit: "" }),
    /emit must be a non-empty string/u
  );
  assert.throws(
    () => createEveSpaceObjectMainResourceBehavior({ format: null }),
    /format must be a format class or non-empty registered name/u
  );
  assert.equal(createEveSpaceObjectMainResourceBehavior({ format: "webgpu" }).request.format, "webgpu");
});
