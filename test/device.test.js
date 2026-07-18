import assert from "node:assert/strict";
import { test } from "node:test";

import { CjsWebGPUDevice } from "../src/index.js";

const SHADER_STAGE = Object.freeze({ VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 });
const BUFFER_USAGE = Object.freeze({ UNIFORM: 16, COPY_DST: 32, VERTEX: 64, INDEX: 128 });
const TEXTURE_USAGE = Object.freeze({ TEXTURE_BINDING: 256, COPY_DST: 512 });

function deferred()
{
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}

function fakeDevice(name = "device")
{
  const lost = deferred();
  const calls = [];
  const compilation = new Map();
  const compilationWaits = new Map();
  const validationErrors = [];
  const device = {
    name,
    calls,
    compilation,
    compilationWaits,
    validationErrors,
    lost: lost.promise,
    queue: {
      writeBuffer(buffer, offset, data)
      {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        calls.push([ "writeBuffer", buffer, offset, bytes ]);
      },
      writeTexture(destination, data, layout, size)
      {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        calls.push([ "writeTexture", destination, bytes, layout, size ]);
      },
      submit(commandBuffers)
      {
        calls.push([ "submit", commandBuffers ]);
      }
    },
    pushErrorScope(filter)
    {
      calls.push([ "pushErrorScope", filter ]);
    },
    async popErrorScope()
    {
      calls.push([ "popErrorScope" ]);
      return validationErrors.shift() || null;
    },
    createShaderModule(descriptor)
    {
      calls.push([ "createShaderModule", descriptor ]);
      return {
        kind: "shaderModule",
        descriptor,
        async getCompilationInfo()
        {
          calls.push([ "getCompilationInfo", descriptor.label ]);
          const wait = compilationWaits.get(descriptor.label);
          if (wait) await wait.promise;
          return { messages: compilation.get(descriptor.label) || [] };
        }
      };
    },
    createBindGroupLayout(descriptor)
    {
      const value = { kind: "bindGroupLayout", descriptor };
      calls.push([ "createBindGroupLayout", descriptor, value ]);
      return value;
    },
    createPipelineLayout(descriptor)
    {
      const value = { kind: "pipelineLayout", descriptor };
      calls.push([ "createPipelineLayout", descriptor, value ]);
      return value;
    },
    createBuffer(descriptor)
    {
      if (device.bufferError) throw device.bufferError;
      const value = {
        kind: "buffer",
        descriptor,
        destroy()
        {
          calls.push([ "destroyBuffer", value ]);
        }
      };
      calls.push([ "createBuffer", descriptor, value ]);
      return value;
    },
    createTexture(descriptor)
    {
      if (device.textureError) throw device.textureError;
      const value = {
        kind: "texture",
        descriptor,
        createView(viewDescriptor)
        {
          if (device.textureViewError) throw device.textureViewError;
          const view = { kind: "textureView", texture: value, descriptor: viewDescriptor };
          calls.push([ "createTextureView", viewDescriptor, view ]);
          return view;
        },
        destroy()
        {
          calls.push([ "destroyTexture", value ]);
        }
      };
      calls.push([ "createTexture", descriptor, value ]);
      return value;
    },
    createSampler(descriptor)
    {
      if (device.samplerError) throw device.samplerError;
      const value = { kind: "sampler", descriptor };
      calls.push([ "createSampler", descriptor, value ]);
      return value;
    },
    async createRenderPipelineAsync(descriptor)
    {
      calls.push([ "createRenderPipelineAsync", descriptor ]);
      if (device.pipelineWait) await device.pipelineWait.promise;
      if (device.pipelineError) throw device.pipelineError;
      return { kind: "renderPipeline", descriptor };
    },
    createBindGroup(descriptor)
    {
      if (device.bindGroupError) throw device.bindGroupError;
      const value = { kind: "bindGroup", descriptor };
      calls.push([ "createBindGroup", descriptor, value ]);
      return value;
    },
    destroy()
    {
      calls.push([ "destroy" ]);
    }
  };
  return { device, lost };
}

function pipelineDescriptor(overrides = {})
{
  return {
    key: "Main.pass0",
    techniqueName: "Main",
    passIndex: 0,
    renderStates: 1,
    states: [],
    shaderModules: [
      {
        key: "Main.pass0.vertex",
        stageName: "vertex",
        entryPoint: "vsMain",
        wgsl: "@vertex fn vsMain() -> @builtin(position) vec4f { return vec4f(); }"
      },
      {
        key: "Main.pass0.pixel",
        stageName: "pixel",
        entryPoint: "psMain",
        wgsl: "@fragment fn psMain() -> @location(0) vec4f { return vec4f(1); }"
      }
    ],
    bindGroups: [ {
      group: 0,
      bindings: [
        {
          sourceTruth: "wgsl-layout",
          resourceKind: "uniform-buffer",
          registerSpace: 0,
          registerIndex: 1,
          group: 0,
          binding: 3,
          visibility: [ "vertex" ],
          dynamic: false,
          layout: { buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: 64 } }
        },
        {
          sourceTruth: "wgsl-layout",
          resourceKind: "sampled-resource",
          registerSpace: 0,
          registerIndex: 0,
          group: 0,
          binding: 5,
          visibility: [ "fragment" ],
          dynamic: false,
          layout: { texture: { sampleType: "float", viewDimension: "2d", multisampled: false } }
        },
        {
          sourceTruth: "wgsl-layout",
          resourceKind: "sampler",
          registerSpace: 0,
          registerIndex: 0,
          group: 0,
          binding: 8,
          visibility: [ "fragment" ],
          dynamic: false,
          layout: { sampler: { type: "filtering" } }
        }
      ]
    } ],
    ...overrides
  };
}

function renderRecipe()
{
  return {
    label: "explicit Main pipeline",
    vertex: {
      buffers: [ {
        arrayStride: 20,
        attributes: [ { shaderLocation: 0, offset: 0, format: "float32x3" } ]
      } ]
    },
    fragment: { targets: [ { format: "rgba8unorm" } ] },
    primitive: { topology: "triangle-list", cullMode: "back" }
  };
}

function resources()
{
  return new Map([
    [ "uniform-buffer:0:1", { buffer: { kind: "buffer" } } ],
    [ "sampled-resource:0:0", { kind: "textureView" } ],
    [ "sampler:0:0", { kind: "sampler" } ]
  ]);
}

function bindingSetInputs(data = new Float32Array(16))
{
  return {
    uniformData: new Map([ [ "uniform-buffer:0:1", data ] ]),
    resources: new Map([
      [ "sampled-resource:0:0", { kind: "textureView" } ],
      [ "sampler:0:0", { kind: "sampler" } ]
    ])
  };
}

function geometryInputs()
{
  return {
    label: "test geometry",
    vertexBuffers: [ {
      slot: 0,
      data: new Float32Array([
        -1, -1, 0, 0, 0,
         1, -1, 0, 1, 0,
         0,  1, 0, 0.5, 1
      ]),
      layout: {
        arrayStride: 20,
        attributes: [ { shaderLocation: 0, offset: 0, format: "float32x3" } ]
      }
    } ],
    indexBuffer: {
      data: new Uint16Array([ 0, 1, 2 ]),
      format: "uint16"
    }
  };
}

function textureInputs()
{
  return {
    label: "test texture",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    bytesPerRow: 8,
    data: new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255
    ])
  };
}

function decodedRgba8Inputs(overrides = {})
{
  return {
    payloadType: "rgba",
    sourceFormat: "png",
    width: 2,
    height: 2,
    pixelFormat: "rgba8unorm",
    data: new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255
    ]),
    strideBytes: 8,
    origin: "top-left",
    colorSpace: "srgb",
    alphaMode: "straight",
    containerOnly: false,
    isDecoded: true,
    ...overrides
  };
}

function samplerInputs()
{
  return {
    label: "test sampler",
    addressModeU: "repeat",
    addressModeV: "mirror-repeat",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMaxClamp: 8,
    maxAnisotropy: 4
  };
}

function adapterResourceSlot()
{
  const values = new Map();
  const history = [];
  return {
    values,
    history,
    setError: null,
    setThenError: null,
    ignoreSet: false,
    GetAdapterResource(key)
    {
      return values.get(key) ?? null;
    },
    SetAdapterResource(key, value)
    {
      history.push([ key, value ]);
      if (this.setError) throw this.setError;
      if (!this.ignoreSet) values.set(key, value);
      if (this.setThenError)
      {
        const error = this.setThenError;
        this.setThenError = null;
        throw error;
      }
      return this;
    },
    DestroyAdapterResource(key)
    {
      history.push([ "destroy", key ]);
      const value = values.get(key);
      values.delete(key);
      value?.Destroy?.();
      return this;
    }
  };
}

test("CjsWebGPUDevice prepares canonical layouts and realizes an explicit pipeline/draw recipe", async () =>
{
  const fake = fakeDevice();
  fake.device.compilation.set("Main.pass0.fragment", [ { type: "warning", message: "portable warning", lineNum: 2 } ]);
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });

  const prepared = await webgpu.PreparePipeline(pipelineDescriptor());
  assert.equal(prepared.generation, 1);
  assert.equal(prepared.diagnostics.length, 1);
  assert.equal(prepared.diagnostics[0].stage, "fragment");
  const shaderCalls = fake.device.calls.filter(([ kind ]) => kind === "createShaderModule");
  assert.deepEqual(shaderCalls.map(([, descriptor ]) => [ descriptor.label, descriptor.code ]), [
    [ "Main.pass0.vertex", pipelineDescriptor().shaderModules[0].wgsl ],
    [ "Main.pass0.fragment", pipelineDescriptor().shaderModules[1].wgsl ]
  ]);

  const layout = fake.device.calls.find(([ kind ]) => kind === "createBindGroupLayout")[1];
  assert.deepEqual(layout.entries.map((entry) => [ entry.binding, entry.visibility, Object.keys(entry).sort() ]), [
    [ 3, SHADER_STAGE.VERTEX, [ "binding", "buffer", "visibility" ] ],
    [ 5, SHADER_STAGE.FRAGMENT, [ "binding", "texture", "visibility" ] ],
    [ 8, SHADER_STAGE.FRAGMENT, [ "binding", "sampler", "visibility" ] ]
  ]);

  const live = await webgpu.CreateRenderPipeline(prepared, renderRecipe());
  const pipelineCall = fake.device.calls.find(([ kind ]) => kind === "createRenderPipelineAsync")[1];
  assert.equal(pipelineCall.label, "explicit Main pipeline");
  assert.equal(pipelineCall.vertex.entryPoint, "vsMain");
  assert.equal(pipelineCall.fragment.entryPoint, "psMain");
  assert.deepEqual(pipelineCall.vertex.buffers, renderRecipe().vertex.buffers);
  assert.deepEqual(pipelineCall.fragment.targets, [ { format: "rgba8unorm" } ]);
  assert.deepEqual(pipelineCall.primitive, { topology: "triangle-list", cullMode: "back" });

  const vertexBuffer = { kind: "vertexBuffer" };
  const draw = webgpu.CreateDraw(live, {
    resources: resources(),
    vertexBuffers: [ { slot: 0, buffer: vertexBuffer, offset: 12 } ],
    draw: { vertexCount: 3, instanceCount: 2, firstVertex: 1 }
  });
  const bindGroupCall = fake.device.calls.find(([ kind ]) => kind === "createBindGroup")[1];
  assert.deepEqual(bindGroupCall.entries.map((entry) => entry.binding), [ 3, 5, 8 ]);
  assert.deepEqual(bindGroupCall.entries.map((entry) => entry.resource), Array.from(resources().values()));

  const passCalls = [];
  const pass = {
    setPipeline(value) { passCalls.push([ "pipeline", value ]); },
    setBindGroup(group, value) { passCalls.push([ "group", group, value ]); },
    setVertexBuffer(slot, buffer, offset, size) { passCalls.push([ "vertex", slot, buffer, offset, size ]); },
    draw(...args) { passCalls.push([ "draw", ...args ]); }
  };
  webgpu.EncodeDraw(pass, draw);
  assert.deepEqual(passCalls.map((entry) => entry[0]), [ "pipeline", "group", "vertex", "draw" ]);
  assert.deepEqual(passCalls.at(-1), [ "draw", 3, 2, 1, 0 ]);

  const commandBuffers = [ { kind: "commandBuffer" } ];
  webgpu.Submit(commandBuffers);
  assert.deepEqual(fake.device.calls.find(([ kind ]) => kind === "submit")[1], commandBuffers);
});

test("CjsWebGPUDevice encodes indexed draws without taking ownership of caller resources", async () =>
{
  const fake = fakeDevice();
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const indexBuffer = { kind: "indexBuffer" };
  const draw = webgpu.CreateDraw(live, {
    resources: resources(),
    indexBuffer: { buffer: indexBuffer, format: "uint16", offset: 4 },
    draw: { indexCount: 6, instanceCount: 2, firstIndex: 1, baseVertex: -2, firstInstance: 3 }
  });
  const calls = [];
  webgpu.EncodeDraw({
    setPipeline(value) { calls.push([ "pipeline", value ]); },
    setBindGroup(group, value) { calls.push([ "group", group, value ]); },
    setVertexBuffer() { throw new Error("unexpected vertex buffer"); },
    setIndexBuffer(...args) { calls.push([ "index", ...args ]); },
    drawIndexed(...args) { calls.push([ "drawIndexed", ...args ]); }
  }, draw);
  assert.deepEqual(calls.at(-2), [ "index", indexBuffer, "uint16", 4 ]);
  assert.deepEqual(calls.at(-1), [ "drawIndexed", 6, 2, 1, -2, 3 ]);
  webgpu.Destroy();
  webgpu.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroy").length, 1);
  assert.equal(indexBuffer.kind, "indexBuffer");
});

test("CjsWebGPUDevice owns explicit geometry uploads and integrates them with indexed draws", async () =>
{
  const fake = fakeDevice("geometry");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const inputs = geometryInputs();
  const expectedFirstVertex = inputs.vertexBuffers[0].data[0];
  const geometryPromise = webgpu.CreateGeometry(inputs);
  inputs.vertexBuffers[0].data[0] = 99;
  const geometry = await geometryPromise;
  assert.equal(Object.isFrozen(geometry), true);
  assert.equal(geometry.generation, 1);
  assert.equal(geometry.vertexBufferCount, 1);
  assert.equal(geometry.vertexCapacity, 3);
  assert.equal(geometry.instanceCapacity, null);
  assert.equal(geometry.indexed, true);
  assert.equal(geometry.indexFormat, "uint16");
  assert.equal(geometry.indexCount, 3);
  assert.deepEqual(geometry.vertexBufferLayouts, [ {
    ...inputs.vertexBuffers[0].layout,
    stepMode: "vertex"
  } ]);
  assert.notEqual(geometry.vertexBufferLayouts[0], inputs.vertexBuffers[0].layout);

  const bufferCalls = fake.device.calls.filter(([ kind ]) => kind === "createBuffer");
  assert.deepEqual(bufferCalls.map(([, descriptor ]) => descriptor), [
    { label: "test geometry.vertex0", size: 60, usage: BUFFER_USAGE.VERTEX | BUFFER_USAGE.COPY_DST },
    { label: "test geometry.index", size: 8, usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST }
  ]);
  const writes = fake.device.calls.filter(([ kind ]) => kind === "writeBuffer");
  assert.equal(writes.length, 2);
  assert.equal(writes[0][3].byteLength, 60);
  assert.equal(new Float32Array(writes[0][3].buffer)[0], expectedFirstVertex);
  assert.equal(writes[1][3].byteLength, 8);
  assert.deepEqual(Array.from(writes[1][3].slice(6)), [ 0, 0 ]);

  inputs.vertexBuffers[0].layout.arrayStride = 24;
  const recipe = renderRecipe();
  recipe.vertex.buffers = geometry.vertexBufferLayouts;
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), recipe);
  const draw = webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 3 }
  });
  const calls = [];
  webgpu.EncodeDraw({
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer(...args) { calls.push([ "vertex", ...args ]); },
    setIndexBuffer(...args) { calls.push([ "index", ...args ]); },
    drawIndexed(...args) { calls.push([ "drawIndexed", ...args ]); }
  }, draw);
  assert.deepEqual(calls[0].slice(0, 2), [ "vertex", 0 ]);
  assert.deepEqual(calls[0].slice(3), [ 0, 60 ]);
  assert.deepEqual(calls[1].slice(0, 2), [ "index", bufferCalls[1][2] ]);
  assert.deepEqual(calls[1].slice(2), [ "uint16", 0, 6 ]);
  assert.deepEqual(calls[2], [ "drawIndexed", 3, 1, 0, 0, 0 ]);

  geometry.Destroy();
  geometry.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, draw), /draw geometry is destroyed/i);
});

test("CjsWebGPUDevice geometry supports non-indexed and instanced capacities", async () =>
{
  const fake = fakeDevice("non-indexed-geometry");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const inputs = geometryInputs();
  delete inputs.indexBuffer;
  inputs.vertexBuffers.push({
    slot: 1,
    data: new Float32Array([ 1, 0, 0, 1 ]),
    layout: {
      arrayStride: 16,
      stepMode: "instance",
      attributes: [ { shaderLocation: 1, offset: 0, format: "float32x4" } ]
    }
  });
  const geometry = await webgpu.CreateGeometry(inputs);
  assert.equal(geometry.vertexCapacity, 3);
  assert.equal(geometry.instanceCapacity, 1);
  assert.equal(geometry.indexed, false);

  const recipe = renderRecipe();
  recipe.vertex.buffers = geometry.vertexBufferLayouts;
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), recipe);
  const draw = webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 3, instanceCount: 1 }
  });
  const calls = [];
  webgpu.EncodeDraw({
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer(...args) { calls.push([ "vertex", ...args ]); },
    draw(...args) { calls.push([ "draw", ...args ]); }
  }, draw);
  assert.deepEqual(calls.map((entry) => entry[0]), [ "vertex", "vertex", "draw" ]);
  assert.deepEqual(calls.at(-1), [ "draw", 3, 1, 0, 0 ]);

  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 4 }
  }), /vertex capacity at slot 0/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 3, instanceCount: 2 }
  }), /instance capacity at slot 1/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 0, instanceCount: 0, firstVertex: 99, firstInstance: 99 }
  }), /vertex capacity at slot 0/i);
  assert.doesNotThrow(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 0, instanceCount: 0 }
  }));
  geometry.Destroy();
});

test("CjsWebGPUDevice geometry validation fails closed and cleans partial uploads", async () =>
{
  const fake = fakeDevice("geometry-errors");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const duplicateSlots = geometryInputs();
  duplicateSlots.vertexBuffers.push({ ...duplicateSlots.vertexBuffers[0] });
  await assert.rejects(webgpu.CreateGeometry(duplicateSlots), /slots must be unique and contiguous/i);

  const duplicateLocations = geometryInputs();
  duplicateLocations.vertexBuffers[0].layout.attributes.push({
    shaderLocation: 0,
    offset: 12,
    format: "float32x2"
  });
  await assert.rejects(webgpu.CreateGeometry(duplicateLocations), /duplicates shader location 0/i);

  const duplicateLocationsAcrossBuffers = geometryInputs();
  duplicateLocationsAcrossBuffers.vertexBuffers.push({
    slot: 1,
    data: new Float32Array([ 0, 0, 0, 0 ]),
    layout: {
      arrayStride: 16,
      attributes: [ { shaderLocation: 0, offset: 0, format: "float32x4" } ]
    }
  });
  await assert.rejects(
    webgpu.CreateGeometry(duplicateLocationsAcrossBuffers),
    /duplicates shader location 0 across vertex buffers/i
  );

  const invalidStride = geometryInputs();
  invalidStride.vertexBuffers[0].layout.arrayStride = 18;
  await assert.rejects(webgpu.CreateGeometry(invalidStride), /arrayStride must be a positive multiple of 4/i);

  const invalidIndex = geometryInputs();
  invalidIndex.indexBuffer.format = "uint8";
  await assert.rejects(webgpu.CreateGeometry(invalidIndex), /format must be uint16 or uint32/i);

  const invalidVertexFormat = geometryInputs();
  invalidVertexFormat.vertexBuffers[0].layout.attributes[0].format = "float64x3";
  await assert.rejects(webgpu.CreateGeometry(invalidVertexFormat), /unsupported GPUVertexFormat float64x3/i);

  const overflowingAttribute = geometryInputs();
  overflowingAttribute.vertexBuffers[0].layout.attributes[0].offset = 12;
  await assert.rejects(webgpu.CreateGeometry(overflowingAttribute), /attribute 0 exceeds arrayStride/i);

  const scalarGeometry = await webgpu.CreateGeometry({
    vertexBuffers: [ {
      slot: 0,
      data: new Uint8Array([ 255, 0, 0, 0 ]),
      layout: {
        arrayStride: 4,
        attributes: [ { shaderLocation: 0, offset: 0, format: "unorm8" } ]
      }
    } ]
  });
  assert.equal(scalarGeometry.vertexBufferLayouts[0].attributes[0].format, "unorm8");
  scalarGeometry.Destroy();

  const originalCreateBuffer = fake.device.createBuffer.bind(fake.device);
  let allocation = 0;
  fake.device.createBuffer = (descriptor) =>
  {
    allocation += 1;
    if (allocation === 2) throw new Error("index allocation rejected");
    return originalCreateBuffer(descriptor);
  };
  const destroyedBeforeFailure = fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length;
  await assert.rejects(webgpu.CreateGeometry(geometryInputs()), /index allocation rejected/i);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, destroyedBeforeFailure + 1);
});

test("CjsWebGPUDevice geometry observes validation and out-of-memory scopes atomically", async () =>
{
  const validationFake = fakeDevice("geometry-native-validation");
  validationFake.device.validationErrors.push({ message: "invalid native geometry" });
  const validationDevice = new CjsWebGPUDevice({
    device: validationFake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  await assert.rejects(validationDevice.CreateGeometry(geometryInputs()), /geometry validation failed: invalid native geometry/i);
  assert.deepEqual(
    validationFake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").map((entry) => entry[1]),
    [ "out-of-memory", "validation" ]
  );
  assert.equal(validationFake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length, 2);
  assert.equal(validationFake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);

  const memoryFake = fakeDevice("geometry-native-memory");
  memoryFake.device.validationErrors.push(null, { message: "geometry out of memory" });
  const memoryDevice = new CjsWebGPUDevice({
    device: memoryFake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  await assert.rejects(memoryDevice.CreateGeometry(geometryInputs()), /geometry allocation failed: geometry out of memory/i);
  assert.equal(memoryFake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);

  const causalFake = fakeDevice("geometry-native-cause");
  causalFake.device.validationErrors.push(
    { message: "invalid after failed allocation" },
    { message: "causal geometry out of memory" }
  );
  const causalDevice = new CjsWebGPUDevice({
    device: causalFake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  await assert.rejects(
    causalDevice.CreateGeometry(geometryInputs()),
    /geometry allocation failed: causal geometry out of memory/i
  );
});

test("CjsWebGPUDevice geometry draws validate ownership, layouts, modes, and ranges", async () =>
{
  const fake = fakeDevice("geometry-draw-errors");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const geometry = await webgpu.CreateGeometry(geometryInputs());
  const recipe = renderRecipe();
  recipe.vertex.buffers = geometry.vertexBufferLayouts;
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), recipe);

  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    vertexBuffers: [],
    draw: { indexCount: 3 }
  }), /cannot be combined with raw vertexBuffers/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 3 }
  }), /non-indexed draw cannot include an index buffer/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 4 }
  }), /exceeds geometry index capacity/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 0, firstIndex: 4 }
  }), /exceeds geometry index capacity/i);

  const mismatchedRecipe = renderRecipe();
  mismatchedRecipe.vertex.buffers[0].arrayStride = 24;
  const mismatchedLive = await webgpu.CreateRenderPipeline(pipelineDescriptor(), mismatchedRecipe);
  assert.throws(() => webgpu.CreateDraw(mismatchedLive, {
    resources: resources(),
    geometry,
    draw: { indexCount: 3 }
  }), /vertex layouts do not match/i);

  const equivalentInputs = geometryInputs();
  equivalentInputs.vertexBuffers[0].layout.attributes.push({
    shaderLocation: 1,
    offset: 12,
    format: "float32x2"
  });
  const equivalentGeometry = await webgpu.CreateGeometry(equivalentInputs);
  const equivalentRecipe = renderRecipe();
  equivalentRecipe.vertex.buffers = [ {
    arrayStride: 20,
    attributes: [
      { shaderLocation: 1, offset: 12, format: "float32x2" },
      { shaderLocation: 0, offset: 0, format: "float32x3" }
    ]
  } ];
  const equivalentLive = await webgpu.CreateRenderPipeline(pipelineDescriptor(), equivalentRecipe);
  assert.doesNotThrow(() => webgpu.CreateDraw(equivalentLive, {
    resources: resources(),
    geometry: equivalentGeometry,
    draw: { indexCount: 3 }
  }));
  equivalentGeometry.Destroy();

  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 0, firstIndex: 0x100000000 }
  }), /firstIndex must be a GPUSize32 value/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 1, baseVertex: 0x80000000 }
  }), /baseVertex must be a GPUSignedOffset32 value/i);

  const other = fakeDevice("other-geometry-device");
  const otherDevice = new CjsWebGPUDevice({
    device: other.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const otherLive = await otherDevice.CreateRenderPipeline(pipelineDescriptor(), recipe);
  assert.throws(() => otherDevice.CreateDraw(otherLive, {
    resources: resources(),
    geometry,
    draw: { indexCount: 3 }
  }), /geometry belongs to another device/i);

  geometry.Destroy();
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { indexCount: 3 }
  }), /geometry is destroyed/i);
});

test("CjsWebGPUDevice rejects stale geometry after device recreation", async () =>
{
  const first = fakeDevice("stale-geometry-first");
  const second = fakeDevice("stale-geometry-second");
  const adapter = { requestDevice: async () => second.device };
  const webgpu = new CjsWebGPUDevice({
    gpu: { requestAdapter: async () => adapter },
    adapter,
    device: first.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const inputs = geometryInputs();
  delete inputs.indexBuffer;
  const geometry = await webgpu.CreateGeometry(inputs);
  await webgpu.Recreate();

  const recipe = renderRecipe();
  recipe.vertex.buffers = geometry.vertexBufferLayouts;
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), recipe);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    geometry,
    draw: { vertexCount: 3 }
  }), /stale device generation 1/i);
  geometry.Destroy();
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 1);
});

test("CjsWebGPUDevice owns explicit 2D texture uploads and unwraps them for bindings", async () =>
{
  const fake = fakeDevice("texture");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE,
    textureUsage: TEXTURE_USAGE
  });
  const inputs = textureInputs();
  const expectedFirstByte = inputs.data[0];
  const texturePromise = webgpu.CreateTexture(inputs);
  inputs.data[0] = 0;
  const texture = await texturePromise;
  assert.equal(Object.isFrozen(texture), true);
  assert.deepEqual({
    width: texture.width,
    height: texture.height,
    format: texture.format,
    isSRGB: texture.isSRGB,
    dimension: texture.dimension,
    mipLevelCount: texture.mipLevelCount
  }, {
    width: 2,
    height: 2,
    format: "rgba8unorm",
    isSRGB: false,
    dimension: "2d",
    mipLevelCount: 1
  });
  const textureCall = fake.device.calls.find(([ kind ]) => kind === "createTexture");
  assert.deepEqual(textureCall[1], {
    label: "test texture",
    size: { width: 2, height: 2, depthOrArrayLayers: 1 },
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: "2d",
    format: "rgba8unorm",
    usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST
  });
  const write = fake.device.calls.find(([ kind ]) => kind === "writeTexture");
  assert.equal(write[2][0], expectedFirstByte);
  assert.deepEqual(write[3], { offset: 0, bytesPerRow: 8, rowsPerImage: 2 });
  assert.deepEqual(write[4], { width: 2, height: 2, depthOrArrayLayers: 1 });
  const view = fake.device.calls.find(([ kind ]) => kind === "createTextureView")[2];

  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const rawResources = resources();
  rawResources.set("sampled-resource:0:0", texture);
  const rawDraw = webgpu.CreateDraw(live, {
    resources: rawResources,
    draw: { vertexCount: 3 }
  });
  const rawBindGroup = fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").at(-1)[1];
  assert.equal(rawBindGroup.entries.find((entry) => entry.binding === 5).resource, view);

  const inputsForBindingSet = bindingSetInputs();
  inputsForBindingSet.resources.set("sampled-resource:0:0", texture);
  const bindingSet = webgpu.CreateBindingSet(live, inputsForBindingSet);
  const bindingDraw = webgpu.CreateDraw(live, { bindingSet, draw: { vertexCount: 3 } });
  const bindingGroup = fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").at(-1)[1];
  assert.equal(bindingGroup.entries.find((entry) => entry.binding === 5).resource, view);

  const defaultedPipeline = pipelineDescriptor();
  defaultedPipeline.bindGroups[0].bindings[1].layout = { texture: {} };
  const defaultedLive = await webgpu.CreateRenderPipeline(defaultedPipeline, renderRecipe());
  const defaultedResources = resources();
  defaultedResources.set("sampled-resource:0:0", texture);
  const defaultedDraw = webgpu.CreateDraw(defaultedLive, {
    resources: defaultedResources,
    draw: { vertexCount: 3 }
  });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").at(-1)[1]
    .entries.find((entry) => entry.binding === 5).resource, view);

  const incompatibleResources = resources();
  incompatibleResources.set("sampler:0:0", texture);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: incompatibleResources,
    draw: { vertexCount: 3 }
  }), /sampler:0:0 cannot bind an engine texture/i);

  texture.Destroy();
  texture.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, rawDraw), /draw texture is destroyed/i);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, bindingDraw), /draw binding set texture is destroyed/i);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, defaultedDraw), /draw texture is destroyed/i);
  assert.throws(() => bindingSet.Update(new Map([
    [ "uniform-buffer:0:1", new Float32Array(16) ]
  ])), /binding set texture is destroyed/i);
  bindingSet.Destroy();
});

test("CjsWebGPUDevice preserves linear and sRGB QuadV5 texture bytes", async () =>
{
  const fake = fakeDevice("texture-formats");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const fixtures = [
    { format: "rgba8unorm", bytes: new Uint8Array([ 255, 0, 0, 255 ]) },
    { format: "rgba8unorm-srgb", bytes: new Uint8Array([ 255, 255, 255, 255 ]) },
    { format: "rgba8unorm", bytes: new Uint8Array([ 128, 0, 0, 255 ]) }
  ];
  const textures = [];
  for (const [ index, fixture ] of fixtures.entries())
  {
    textures.push(await webgpu.CreateTexture({
      label: `QuadV5 fixture ${index}`,
      width: 1,
      height: 1,
      format: fixture.format,
      bytesPerRow: 4,
      data: fixture.bytes
    }));
  }

  const descriptors = fake.device.calls.filter(([ kind ]) => kind === "createTexture").map((call) => call[1]);
  assert.deepEqual(descriptors.map(({ format }) => format), fixtures.map(({ format }) => format));
  assert.equal(descriptors.every((descriptor) => !Object.hasOwn(descriptor, "viewFormats")), true);
  assert.deepEqual(textures.map(({ isSRGB }) => isSRGB), [ false, true, false ]);
  const uploads = fake.device.calls.filter(([ kind ]) => kind === "writeTexture");
  assert.deepEqual(uploads.map((call) => Array.from(call[2])), fixtures.map(({ bytes }) => Array.from(bytes)));
  assert.equal(uploads.every((call) => call[3].bytesPerRow === 4 && call[3].rowsPerImage === 1), true);

  textures.forEach((texture) => texture.Destroy());
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 3);
});

test("CjsWebGPUDevice texture validation and native error scopes fail closed", async () =>
{
  const fake = fakeDevice("texture-errors");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const badFormat = textureInputs();
  badFormat.format = "bc1-rgba-unorm";
  await assert.rejects(webgpu.CreateTexture(badFormat), /not supported by the uncompressed 2D adapter/i);
  const shortRow = textureInputs();
  shortRow.bytesPerRow = 4;
  await assert.rejects(webgpu.CreateTexture(shortRow), /must contain 8 active bytes/i);
  const shortData = textureInputs();
  shortData.data = shortData.data.slice(0, 12);
  await assert.rejects(webgpu.CreateTexture(shortData), /must be exactly 16 bytes/i);
  const badWidth = textureInputs();
  badWidth.width = 0;
  await assert.rejects(webgpu.CreateTexture(badWidth), /width must be a positive GPUSize32/i);

  fake.device.limits = { maxTextureDimension2D: 1 };
  await assert.rejects(webgpu.CreateTexture(textureInputs()), /exceed device maxTextureDimension2D 1/i);
  fake.device.limits = {};
  fake.device.validationErrors.push({ message: "invalid native texture" });
  await assert.rejects(webgpu.CreateTexture(textureInputs()), /texture validation failed: invalid native texture/i);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);

  fake.device.validationErrors.push(null, { message: "texture out of memory" });
  await assert.rejects(webgpu.CreateTexture(textureInputs()), /texture allocation failed: texture out of memory/i);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 2);

  fake.device.validationErrors.push(
    { message: "invalid after failed allocation" },
    { message: "causal texture out of memory" }
  );
  await assert.rejects(
    webgpu.CreateTexture(textureInputs()),
    /texture allocation failed: causal texture out of memory/i
  );

  const popFake = fakeDevice("texture-pop-order");
  const firstPop = deferred();
  let popCount = 0;
  popFake.device.popErrorScope = () =>
  {
    popFake.device.calls.push([ "popErrorScope" ]);
    popCount += 1;
    return popCount === 1 ? firstPop.promise : Promise.resolve(null);
  };
  const popDevice = new CjsWebGPUDevice({
    device: popFake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const pendingTexture = popDevice.CreateTexture(textureInputs());
  await Promise.resolve();
  assert.equal(popCount, 2);
  firstPop.resolve(null);
  const completedTexture = await pendingTexture;
  completedTexture.Destroy();
});

test("CjsWebGPUDevice rejects foreign and stale texture handles", async () =>
{
  const first = fakeDevice("texture-owner");
  const second = fakeDevice("texture-foreign");
  const recreated = fakeDevice("texture-recreated");
  const owner = new CjsWebGPUDevice({
    gpu: { requestAdapter: async () => ({ requestDevice: async () => recreated.device }) },
    device: first.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const foreign = new CjsWebGPUDevice({
    device: second.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const texture = await owner.CreateTexture(textureInputs());
  const live = await foreign.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const values = resources();
  values.set("sampled-resource:0:0", texture);
  assert.throws(() => foreign.CreateDraw(live, {
    resources: values,
    draw: { vertexCount: 3 }
  }), /texture belongs to another device/i);

  await owner.Recreate();
  const ownerLive = await owner.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  assert.throws(() => owner.CreateDraw(ownerLive, {
    resources: values,
    draw: { vertexCount: 3 }
  }), /stale device generation 1/i);
  texture.Destroy();
});

test("CjsWebGPUDevice normalizes, caches, unwraps, and logically releases samplers", async () =>
{
  const fake = fakeDevice("sampler");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const inputs = samplerInputs();
  const firstPromise = webgpu.CreateSampler(inputs);
  inputs.magFilter = "nearest";
  const secondPromise = webgpu.CreateSampler({
    label: "same sampler, different label",
    addressModeU: "repeat",
    addressModeV: "mirror-repeat",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 8,
    maxAnisotropy: 4
  });
  const [ first, second ] = await Promise.all([ firstPromise, secondPromise ]);

  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual({
    label: first.label,
    addressModeU: first.addressModeU,
    addressModeV: first.addressModeV,
    addressModeW: first.addressModeW,
    magFilter: first.magFilter,
    minFilter: first.minFilter,
    mipmapFilter: first.mipmapFilter,
    lodMinClamp: first.lodMinClamp,
    lodMaxClamp: first.lodMaxClamp,
    maxAnisotropy: first.maxAnisotropy,
    isComparison: first.isComparison,
    isFiltering: first.isFiltering
  }, {
    label: "test sampler",
    addressModeU: "repeat",
    addressModeV: "mirror-repeat",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 8,
    maxAnisotropy: 4,
    isComparison: false,
    isFiltering: true
  });
  const samplerCalls = fake.device.calls.filter(([ kind ]) => kind === "createSampler");
  assert.equal(samplerCalls.length, 1);
  assert.deepEqual(samplerCalls[0][1], {
    label: "test sampler",
    addressModeU: "repeat",
    addressModeV: "mirror-repeat",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 8,
    maxAnisotropy: 4
  });
  const nativeSampler = samplerCalls[0][2];

  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const directResources = resources();
  directResources.set("sampler:0:0", first);
  const directDraw = webgpu.CreateDraw(live, { resources: directResources, draw: { vertexCount: 3 } });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").at(-1)[1]
    .entries.find((entry) => entry.binding === 8).resource, nativeSampler);

  const inputsForBindingSet = bindingSetInputs();
  inputsForBindingSet.resources.set("sampler:0:0", second);
  const bindingSet = webgpu.CreateBindingSet(live, inputsForBindingSet);
  const bindingDraw = webgpu.CreateDraw(live, { bindingSet, draw: { vertexCount: 3 } });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").at(-1)[1]
    .entries.find((entry) => entry.binding === 8).resource, nativeSampler);

  first.Destroy();
  first.Destroy();
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, directDraw), /draw sampler is destroyed/i);
  const replacement = await webgpu.CreateSampler({ ...samplerInputs(), label: "after logical release" });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);
  const replacementResources = resources();
  replacementResources.set("sampler:0:0", replacement);
  const replacementDraw = webgpu.CreateDraw(live, {
    resources: replacementResources,
    draw: { vertexCount: 3 }
  });
  assert.doesNotThrow(() => webgpu.EncodeDraw({
    setPipeline() {},
    setBindGroup() {},
    draw() {}
  }, replacementDraw));
  assert.doesNotThrow(() => webgpu.EncodeDraw({
    setPipeline() {},
    setBindGroup() {},
    draw() {}
  }, bindingDraw));
  second.Destroy();
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, bindingDraw), /draw binding set sampler is destroyed/i);
  assert.throws(() => bindingSet.Update(new Map([
    [ "uniform-buffer:0:1", new Float32Array(16) ]
  ])), /binding set sampler is destroyed/i);
  replacement.Destroy();
  bindingSet.Destroy();
});

test("CjsWebGPUDevice enforces WebGPU sampler binding compatibility", async () =>
{
  const fake = fakeDevice("sampler-layouts");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const nearest = await webgpu.CreateSampler({ label: "nearest" });
  const nearestExplicit = await webgpu.CreateSampler({
    label: "explicit defaults",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
    lodMinClamp: 0,
    lodMaxClamp: 32,
    maxAnisotropy: 1
  });
  const linear = await webgpu.CreateSampler({ label: "linear", minFilter: "linear" });
  const comparison = await webgpu.CreateSampler({ label: "comparison", compare: "less" });
  const comparisonLinear = await webgpu.CreateSampler({
    label: "filtered comparison",
    compare: "less-equal",
    minFilter: "linear"
  });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 4);
  const liveFor = async (type) =>
  {
    const descriptor = pipelineDescriptor();
    descriptor.bindGroups[0].bindings[2].layout = {
      sampler: type === "default" ? {} : { type }
    };
    return webgpu.CreateRenderPipeline(descriptor, renderRecipe());
  };
  const filteringLive = await liveFor("default");
  const nonFilteringLive = await liveFor("non-filtering");
  const comparisonLive = await liveFor("comparison");
  const drawWith = (live, sampler) =>
  {
    const values = resources();
    values.set("sampler:0:0", sampler);
    return webgpu.CreateDraw(live, { resources: values, draw: { vertexCount: 3 } });
  };

  assert.doesNotThrow(() => drawWith(filteringLive, nearest));
  assert.doesNotThrow(() => drawWith(filteringLive, linear));
  assert.throws(() => drawWith(filteringLive, comparison), /incompatible with the filtering sampler layout/i);
  assert.doesNotThrow(() => drawWith(nonFilteringLive, nearest));
  assert.throws(() => drawWith(nonFilteringLive, linear), /incompatible with the non-filtering sampler layout/i);
  assert.throws(() => drawWith(nonFilteringLive, comparison), /incompatible with the non-filtering sampler layout/i);
  assert.doesNotThrow(() => drawWith(comparisonLive, comparison));
  assert.doesNotThrow(() => drawWith(comparisonLive, comparisonLinear));
  assert.throws(() => drawWith(comparisonLive, nearest), /incompatible with the comparison sampler layout/i);
  assert.throws(() => drawWith(filteringLive, comparisonLinear), /incompatible with the filtering sampler layout/i);

  const wrongKind = resources();
  wrongKind.set("sampled-resource:0:0", nearest);
  wrongKind.set("sampler:0:0", linear);
  assert.throws(() => webgpu.CreateDraw(filteringLive, {
    resources: wrongKind,
    draw: { vertexCount: 3 }
  }), /sampled-resource:0:0 cannot bind an engine sampler/i);

  nearest.Destroy();
  nearestExplicit.Destroy();
  linear.Destroy();
  comparison.Destroy();
  comparisonLinear.Destroy();
});

test("CjsWebGPUDevice canonicalizes sampler LODs and anisotropy before caching", async () =>
{
  const fake = fakeDevice("sampler-canonical");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const rounded = await webgpu.CreateSampler({
    label: "rounded lod",
    lodMinClamp: 0.100000001,
    lodMaxClamp: 0.1
  });
  const roundedEquivalent = await webgpu.CreateSampler({
    label: "rounded lod equivalent",
    lodMinClamp: Math.fround(0.1),
    lodMaxClamp: Math.fround(0.1)
  });
  assert.equal(rounded.lodMinClamp, Math.fround(0.1));
  assert.equal(rounded.lodMaxClamp, Math.fround(0.1));
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);

  const negativeZero = await webgpu.CreateSampler({ label: "negative zero", lodMinClamp: -0 });
  const defaults = await webgpu.CreateSampler({ label: "defaults" });
  assert.equal(Object.is(negativeZero.lodMinClamp, -0), false);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 2);

  const maximumAnisotropy = await webgpu.CreateSampler({
    label: "maximum anisotropy",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    maxAnisotropy: 65535
  });
  await assert.rejects(webgpu.CreateSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    maxAnisotropy: 65536
  }), /maxAnisotropy must be an integer from 1 through 65535/i);
  assert.equal(maximumAnisotropy.maxAnisotropy, 65535);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 3);

  rounded.Destroy();
  roundedEquivalent.Destroy();
  negativeZero.Destroy();
  defaults.Destroy();
  maximumAnisotropy.Destroy();
});

test("CjsWebGPUDevice validates sampler descriptors and does not cache native failures", async () =>
{
  const fake = fakeDevice("sampler-errors");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  await assert.rejects(webgpu.CreateSampler({ unknown: true }), /sampler has unsupported unknown/i);
  await assert.rejects(webgpu.CreateSampler(new Date()), /sampler options must be a plain object/i);
  await assert.rejects(webgpu.CreateSampler({ addressModeU: "border" }), /addressModeU has unsupported border/i);
  await assert.rejects(webgpu.CreateSampler({ minFilter: null }), /minFilter has unsupported null/i);
  await assert.rejects(webgpu.CreateSampler({ compare: null }), /compare has unsupported null/i);
  await assert.rejects(webgpu.CreateSampler({ compare: "sometimes" }), /compare has unsupported sometimes/i);
  await assert.rejects(webgpu.CreateSampler({ lodMinClamp: -1 }), /lodMinClamp must be nonnegative/i);
  await assert.rejects(webgpu.CreateSampler({ lodMinClamp: 4, lodMaxClamp: 3 }), /lodMaxClamp must be at least/i);
  await assert.rejects(webgpu.CreateSampler({ lodMaxClamp: Number.NaN }), /lodMaxClamp must be finite/i);
  await assert.rejects(webgpu.CreateSampler({ lodMaxClamp: 1e100 }), /lodMaxClamp must fit a finite float32/i);
  await assert.rejects(webgpu.CreateSampler({ maxAnisotropy: 0 }), /maxAnisotropy must be an integer/i);
  await assert.rejects(webgpu.CreateSampler({ maxAnisotropy: 1.5 }), /maxAnisotropy must be an integer/i);
  await assert.rejects(webgpu.CreateSampler({ maxAnisotropy: 2 }), /anisotropy requires linear/i);

  fake.device.validationErrors.push({ message: "invalid native sampler" });
  await assert.rejects(webgpu.CreateSampler(samplerInputs()), /sampler validation failed: invalid native sampler/i);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);
  const recovered = await webgpu.CreateSampler(samplerInputs());
  const cached = await webgpu.CreateSampler({ ...samplerInputs(), label: "cached after recovery" });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 2);

  fake.device.samplerError = new Error("native sampler rejected synchronously");
  await assert.rejects(webgpu.CreateSampler({ label: "sync failure", minFilter: "linear" }), /rejected synchronously/i);
  fake.device.samplerError = null;
  assert.equal(
    fake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").length,
    fake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length
  );
  recovered.Destroy();
  cached.Destroy();
});

test("CjsWebGPUDevice rejects foreign and stale sampler handles and resets the cache", async () =>
{
  const first = fakeDevice("sampler-owner");
  const second = fakeDevice("sampler-foreign");
  const recreated = fakeDevice("sampler-recreated");
  const owner = new CjsWebGPUDevice({
    gpu: { requestAdapter: async () => ({ requestDevice: async () => recreated.device }) },
    device: first.device,
    shaderStage: SHADER_STAGE
  });
  const foreign = new CjsWebGPUDevice({ device: second.device, shaderStage: SHADER_STAGE });
  const sampler = await owner.CreateSampler(samplerInputs());
  const foreignLive = await foreign.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const values = resources();
  values.set("sampler:0:0", sampler);
  assert.throws(() => foreign.CreateDraw(foreignLive, {
    resources: values,
    draw: { vertexCount: 3 }
  }), /sampler belongs to another device/i);

  await owner.Recreate();
  const ownerLive = await owner.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  assert.throws(() => owner.CreateDraw(ownerLive, {
    resources: values,
    draw: { vertexCount: 3 }
  }), /stale device generation 1/i);
  const replacement = await owner.CreateSampler(samplerInputs());
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);
  assert.equal(recreated.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);
  sampler.Destroy();
  replacement.Destroy();
});

test("CjsWebGPUDevice maps and publishes already-selected sampler state", async () =>
{
  const fake = fakeDevice("sampler-prepare-pipeline");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const pipeline = webgpu.CreateSamplerPreparePipeline({
    samplerKey: "sampler:0:0",
    bundleLabel: "prepared material sampler",
    mappingStageName: "map-material-sampler",
    publicationStageName: "publish-material-sampler",
    adapterKey: "webgpu:sampler"
  });
  const selected = {
    payloadType: "webgpu-sampler",
    label: "selected material sampler",
    addressModeU: "repeat",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 8.1,
    maxAnisotropy: 4
  };

  assert.equal(Object.isFrozen(pipeline), true);
  assert.equal(Object.isFrozen(pipeline.stages), true);
  assert.deepEqual(pipeline.stages.map((stage) => stage.name), [
    "map-material-sampler",
    "publish-material-sampler"
  ]);
  const callsBeforeMapping = fake.device.calls.length;
  const mapped = pipeline.stages[0].prepare(selected);
  assert.equal(fake.device.calls.length, callsBeforeMapping);
  assert.equal(Object.isFrozen(mapped), true);
  assert.equal(Object.isFrozen(mapped.samplers), true);
  assert.equal(Object.isFrozen(mapped.samplers["sampler:0:0"]), true);
  assert.deepEqual(mapped.samplers["sampler:0:0"], {
    label: "selected material sampler",
    addressModeU: "repeat",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: Math.fround(8.1),
    maxAnisotropy: 4
  });

  const resource = adapterResourceSlot();
  assert.equal(await pipeline.stages[1].prepare(mapped, { resource }), undefined);
  const first = resource.GetAdapterResource("webgpu:sampler");
  assert.equal(first.samplers["sampler:0:0"].isFiltering, true);

  const equivalent = pipeline.stages[0].prepare({ ...selected, label: "same effective state" });
  await pipeline.stages[1].prepare(equivalent, { resource });
  const second = resource.GetAdapterResource("webgpu:sampler");
  assert.notEqual(second, first);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);
  second.Destroy();
});

test("CjsWebGPUDevice sampler prepare mapper fails closed without selecting policy", () =>
{
  const fake = fakeDevice("sampler-prepare-validation");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const stage = webgpu.CreateSamplerPrepareStage({ samplerKey: "main" });
  const selected = {
    payloadType: "webgpu-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
    lodMinClamp: 0,
    lodMaxClamp: 32,
    maxAnisotropy: 1
  };
  const nearest = stage.prepare(selected);
  assert.equal(nearest.samplers.main.minFilter, "nearest");
  assert.equal(nearest.samplers.main.maxAnisotropy, 1);
  const comparison = stage.prepare({ ...selected, compare: "less-equal" });
  assert.equal(comparison.samplers.main.compare, "less-equal");

  assert.throws(() => stage.prepare(new Date()), /payload must be a plain object/i);
  assert.throws(() => stage.prepare({}), /payloadType must be webgpu-sampler/i);
  assert.throws(() => stage.prepare({ ...selected, unknown: true }), /payload has unsupported unknown/i);
  assert.throws(
    () => stage.prepare({
      ...selected,
      addressU: 1,
      mipFilter: 2,
      mipLODBias: 0,
      borderColor: [ 0, 0, 0, 0 ]
    }),
    /payload has unsupported addressU/i
  );
  assert.throws(
    () => stage.prepare({ ...selected, addressModeU: 1 }),
    /addressModeU has unsupported 1/i
  );
  const missing = { ...selected };
  delete missing.addressModeW;
  assert.throws(() => stage.prepare(missing), /must provide addressModeW/i);
  assert.throws(
    () => stage.prepare({ ...selected, maxAnisotropy: 2 }),
    /anisotropy requires linear/i
  );
  assert.throws(() => webgpu.CreateSamplerPrepareStage(), /samplerKey must be a non-empty string/i);
  assert.throws(
    () => webgpu.CreateSamplerPrepareStage({ samplerKey: "main", bundleLabel: "" }),
    /bundleLabel must be a non-empty string/i
  );
  assert.throws(
    () => webgpu.CreateSamplerPreparePipeline({ samplerKey: "main", unknown: true }),
    /unsupported unknown/i
  );
});

test("CjsWebGPUDevice maps canonical RGBA8 through an ordered publication pipeline", async () =>
{
  const fake = fakeDevice("rgba8-prepare-pipeline");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const pipeline = webgpu.CreateRgba8TexturePreparePipeline({
    textureKey: "sampled-resource:0:0",
    bundleLabel: "prepared albedo",
    mappingStageName: "map-albedo-rgba8",
    publicationStageName: "publish-albedo-webgpu",
    adapterKey: "webgpu:albedo"
  });

  assert.equal(Object.isFrozen(pipeline), true);
  assert.equal(Object.isFrozen(pipeline.stages), true);
  assert.deepEqual(pipeline.stages.map((stage) => stage.name), [
    "map-albedo-rgba8",
    "publish-albedo-webgpu"
  ]);

  const pixels = decodedRgba8Inputs({
    strideBytes: 12,
    data: new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0,
      0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  });
  const callsBeforeMapping = fake.device.calls.length;
  const mapped = pipeline.stages[0].prepare(pixels, {});
  assert.equal(fake.device.calls.length, callsBeforeMapping);
  assert.equal(Object.isFrozen(mapped), true);
  assert.equal(Object.isFrozen(mapped.textures), true);
  assert.equal(Object.isFrozen(mapped.textures["sampled-resource:0:0"]), true);
  assert.equal(mapped.label, "prepared albedo");
  assert.deepEqual(mapped.textures["sampled-resource:0:0"], {
    width: 2,
    height: 2,
    format: "rgba8unorm-srgb",
    bytesPerRow: 12,
    data: pixels.data
  });

  const resource = adapterResourceSlot();
  assert.equal(await pipeline.stages[1].prepare(mapped, { resource }), undefined);
  const bundle = resource.GetAdapterResource("webgpu:albedo");
  assert.equal(bundle.textures["sampled-resource:0:0"].format, "rgba8unorm-srgb");
  assert.equal(bundle.textures["sampled-resource:0:0"].isSRGB, true);
  bundle.Destroy();
});

test("CjsWebGPUDevice RGBA8 mapper preserves linear bytes and fails closed on unsupported payloads", () =>
{
  const fake = fakeDevice("rgba8-prepare-validation");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const stage = webgpu.CreateRgba8TexturePrepareStage({
    textureKey: "main",
    bundleLabel: "linear texture"
  });
  const linear = decodedRgba8Inputs({ colorSpace: "linear", alphaMode: "opaque" });
  const mapped = stage.prepare(linear);
  assert.equal(mapped.textures.main.format, "rgba8unorm");
  assert.equal(mapped.textures.main.data, linear.data);
  assert.equal(stage.textureKey, "main");

  const without = (key) =>
  {
    const value = decodedRgba8Inputs();
    delete value[key];
    return value;
  };
  const cases = [
    [ without("sourceFormat"), /sourceFormat must be a non-empty string/i ],
    [ decodedRgba8Inputs({ payloadType: "raw" }), /payloadType must be rgba/i ],
    [ decodedRgba8Inputs({ containerOnly: true }), /containerOnly must be false/i ],
    [ decodedRgba8Inputs({ isDecoded: false }), /isDecoded must be true/i ],
    [ decodedRgba8Inputs({ rgbaDecodeSupported: false }), /rgbaDecodeSupported must be true/i ],
    [ decodedRgba8Inputs({ width: 0 }), /width must be a positive GPUSize32/i ],
    [ decodedRgba8Inputs({ height: 0 }), /height must be a positive GPUSize32/i ],
    [ decodedRgba8Inputs({ pixelFormat: "rgba32float" }), /pixelFormat must be rgba8unorm/i ],
    [ decodedRgba8Inputs({ data: new Float32Array(16) }), /data must be a Uint8Array/i ],
    [ decodedRgba8Inputs({ strideBytes: 4 }), /strideBytes must contain 8 active bytes/i ],
    [ decodedRgba8Inputs({ strideBytes: 10 }), /align to the RGBA8 texel size/i ],
    [ decodedRgba8Inputs({ data: new Uint8Array(15) }), /data must be exactly 16 bytes/i ],
    [ decodedRgba8Inputs({ origin: "bottom-left" }), /origin must be top-left/i ],
    [ decodedRgba8Inputs({ colorSpace: "unknown" }), /colorSpace must be srgb or linear/i ],
    [ decodedRgba8Inputs({ alphaMode: "premultiplied" }), /alphaMode must be straight or opaque/i ],
    [ { ...decodedRgba8Inputs(), faces: [] }, /unsupported faces/i ]
  ];
  for (const [ value, pattern ] of cases) assert.throws(() => stage.prepare(value), pattern);

  assert.throws(() => webgpu.CreateRgba8TexturePrepareStage(), /textureKey must be a non-empty string/i);
  assert.throws(() => webgpu.CreateRgba8TexturePrepareStage(new Date()), /must be a plain object/i);
  assert.throws(
    () => webgpu.CreateRgba8TexturePrepareStage({ textureKey: "main", bundleLabel: "" }),
    /bundleLabel must be a non-empty string/i
  );
  assert.throws(
    () => webgpu.CreateRgba8TexturePreparePipeline({ textureKey: "main", unknown: true }),
    /unsupported unknown/i
  );
});

test("CjsWebGPUDevice atomically realizes and owns keyed prepared resource bundles", async () =>
{
  const fake = fakeDevice("resource-bundle");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE,
    textureUsage: TEXTURE_USAGE
  });
  const bundle = await webgpu.CreateResourceBundle({
    label: "prepared QuadV5",
    geometries: { main: geometryInputs() },
    textures: { "sampled-resource:0:0": textureInputs() },
    samplers: {
      "sampler:0:0": samplerInputs(),
      equivalent: { ...samplerInputs(), label: "equivalent sampler state" }
    }
  });

  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(Object.isFrozen(bundle.geometries), true);
  assert.equal(Object.isFrozen(bundle.textures), true);
  assert.equal(Object.isFrozen(bundle.samplers), true);
  assert.equal(bundle.label, "prepared QuadV5");
  assert.equal(bundle.generation, 1);
  assert.deepEqual(Object.keys(bundle.geometries), [ "main" ]);
  assert.deepEqual(Object.keys(bundle.textures), [ "sampled-resource:0:0" ]);
  assert.deepEqual(Object.keys(bundle.samplers), [ "sampler:0:0", "equivalent" ]);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createSampler").length, 1);

  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const values = resources();
  values.set("sampled-resource:0:0", bundle.textures["sampled-resource:0:0"]);
  values.set("sampler:0:0", bundle.samplers["sampler:0:0"]);
  const draw = webgpu.CreateDraw(live, {
    resources: values,
    geometry: bundle.geometries.main,
    draw: { indexCount: 3 }
  });
  const pass = {
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer() {},
    setIndexBuffer() {},
    drawIndexed() {}
  };
  webgpu.EncodeDraw(pass, draw);

  bundle.Destroy();
  bundle.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
  assert.throws(() => webgpu.EncodeDraw(pass, draw), /(geometry|texture) is destroyed/i);
});

test("CjsWebGPUDevice resource bundles await all children and roll back every fulfilled allocation", async () =>
{
  const early = fakeDevice("resource-bundle-early-failure");
  const earlyWebgpu = new CjsWebGPUDevice({
    device: early.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  await assert.rejects(earlyWebgpu.CreateResourceBundle({
    textures: {
      invalid: { ...textureInputs(), width: 0 },
      laterValid: textureInputs()
    }
  }), /width must be a positive GPUSize32/i);
  assert.equal(early.device.calls.filter(([ kind ]) => kind === "createTexture").length, 1);
  assert.equal(early.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);

  const late = fakeDevice("resource-bundle-late-failure");
  late.device.textureError = new Error("late texture creation failed");
  const lateWebgpu = new CjsWebGPUDevice({
    device: late.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE,
    textureUsage: TEXTURE_USAGE
  });
  await assert.rejects(lateWebgpu.CreateResourceBundle({
    geometries: { main: geometryInputs() },
    textures: { failing: textureInputs() }
  }), /late texture creation failed/i);
  assert.equal(late.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);

  const recovered = fakeDevice("resource-bundle-queue-recovery");
  const createTexture = recovered.device.createTexture.bind(recovered.device);
  let textureAttempts = 0;
  recovered.device.createTexture = (descriptor) =>
  {
    textureAttempts += 1;
    if (textureAttempts === 1) throw new Error("first queued texture failed");
    return createTexture(descriptor);
  };
  const recoveredWebgpu = new CjsWebGPUDevice({
    device: recovered.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  await assert.rejects(recoveredWebgpu.CreateResourceBundle({
    textures: {
      failing: textureInputs(),
      laterValid: textureInputs()
    }
  }), /first queued texture failed/i);
  assert.equal(textureAttempts, 2);
  assert.equal(recovered.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
});

test("CjsWebGPUDevice resource bundles reject mixed generations and clean old and new allocations", async () =>
{
  const first = fakeDevice("resource-bundle-generation-one");
  const second = fakeDevice("resource-bundle-generation-two");
  const scopeEntered = deferred();
  const releaseScope = deferred();
  const popErrorScope = first.device.popErrorScope.bind(first.device);
  let popCount = 0;
  first.device.popErrorScope = async () =>
  {
    popCount += 1;
    if (popCount === 1)
    {
      scopeEntered.resolve();
      await releaseScope.promise;
    }
    return popErrorScope();
  };
  const webgpu = new CjsWebGPUDevice({
    gpu: { requestAdapter: async () => ({ requestDevice: async () => second.device }) },
    device: first.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE,
    textureUsage: TEXTURE_USAGE
  });
  const pending = webgpu.CreateResourceBundle({
    geometries: { oldGeneration: geometryInputs() },
    textures: { queuedAfterRecreate: textureInputs() }
  });
  await scopeEntered.promise;
  await webgpu.Recreate();
  releaseScope.resolve();
  await assert.rejects(pending, /stale device generation 1/i);
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 2);
  assert.equal(second.device.calls.filter(([ kind ]) => kind === "createTexture").length, 1);
  assert.equal(second.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
});

test("CjsWebGPUDevice publishes prepared bundles through one guarded adapter slot", async () =>
{
  const fake = fakeDevice("resource-prepare-stage");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const stage = webgpu.CreateResourcePrepareStage({
    name: "publish-webgpu-texture",
    adapterKey: "webgpu:test"
  });
  const resource = adapterResourceSlot();
  const firstPayload = { textures: { main: textureInputs() } };
  assert.equal(Object.isFrozen(stage), true);
  assert.equal(stage.name, "publish-webgpu-texture");
  assert.equal(stage.adapterKey, "webgpu:test");
  assert.equal(await stage.prepare(firstPayload, { resource }), undefined);
  const first = resource.GetAdapterResource("webgpu:test");
  assert.equal(first.textures.main.width, 2);
  assert.equal(resource.history.length, 1);

  assert.equal(await stage.prepare({ textures: { main: textureInputs() } }, { resource }), undefined);
  const second = resource.GetAdapterResource("webgpu:test");
  assert.notEqual(second, first);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
  second.Destroy();

  const failingResource = adapterResourceSlot();
  failingResource.setError = new Error("adapter publication failed");
  await assert.rejects(
    stage.prepare({ textures: { main: textureInputs() } }, { resource: failingResource }),
    /adapter publication failed/i
  );
  assert.equal(failingResource.GetAdapterResource("webgpu:test"), null);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 3);
});

test("CjsWebGPUDevice prepare-stage commits destroy the bundle actually displaced", async () =>
{
  const fake = fakeDevice("resource-prepare-concurrent");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const stage = webgpu.CreateResourcePrepareStage();
  const resource = adapterResourceSlot();
  const firstPrepare = stage.prepare({
    label: "first concurrent bundle",
    textures: { main: textureInputs() }
  }, { resource });
  const secondPrepare = stage.prepare({
    label: "second concurrent bundle",
    textures: { main: textureInputs() }
  }, { resource });
  await Promise.all([ firstPrepare, secondPrepare ]);

  const publications = resource.history.filter(([ key ]) => key === "webgpu");
  assert.equal(publications.length, 2);
  assert.notEqual(publications[0][1], publications[1][1]);
  assert.equal(resource.GetAdapterResource("webgpu"), publications[1][1]);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
  publications[1][1].Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 2);
});

test("CjsWebGPUDevice prepare-stage failures restore an existing adapter bundle", async () =>
{
  const fake = fakeDevice("resource-prepare-rollback");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const stage = webgpu.CreateResourcePrepareStage();
  const resource = adapterResourceSlot();
  await stage.prepare({ textures: { main: textureInputs() } }, { resource });
  const previous = resource.GetAdapterResource("webgpu");

  resource.setThenError = new Error("setter failed after mutation");
  await assert.rejects(
    stage.prepare({ textures: { main: textureInputs() } }, { resource }),
    /setter failed after mutation/i
  );
  assert.equal(resource.GetAdapterResource("webgpu"), previous);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);

  resource.ignoreSet = true;
  await assert.rejects(
    stage.prepare({ textures: { main: textureInputs() } }, { resource }),
    /did not publish the candidate bundle/i
  );
  assert.equal(resource.GetAdapterResource("webgpu"), previous);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 2);
  previous.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 3);
});

test("CjsWebGPUDevice prepare stage replaces and cleans a stale-generation bundle", async () =>
{
  const first = fakeDevice("resource-stage-generation-one");
  const second = fakeDevice("resource-stage-generation-two");
  const webgpu = new CjsWebGPUDevice({
    gpu: { requestAdapter: async () => ({ requestDevice: async () => second.device }) },
    device: first.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const stage = webgpu.CreateResourcePrepareStage();
  const resource = adapterResourceSlot();
  await stage.prepare({ textures: { main: textureInputs() } }, { resource });
  const stale = resource.GetAdapterResource("webgpu");
  assert.equal(stale.generation, 1);

  await webgpu.Recreate();
  await stage.prepare({ textures: { main: textureInputs() } }, { resource });
  const current = resource.GetAdapterResource("webgpu");
  assert.equal(current.generation, 2);
  assert.notEqual(current, stale);
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
  current.Destroy();
  assert.equal(second.device.calls.filter(([ kind ]) => kind === "destroyTexture").length, 1);
});

test("CjsWebGPUDevice resource publication descriptors and ownership fail closed", async () =>
{
  const ownerFake = fakeDevice("resource-owner");
  const foreignFake = fakeDevice("resource-foreign");
  const owner = new CjsWebGPUDevice({
    device: ownerFake.device,
    shaderStage: SHADER_STAGE,
    textureUsage: TEXTURE_USAGE
  });
  const foreign = new CjsWebGPUDevice({ device: foreignFake.device, shaderStage: SHADER_STAGE });

  await assert.rejects(owner.CreateResourceBundle({}), /must contain at least one/i);
  await assert.rejects(owner.CreateResourceBundle(new Date()), /must be a plain object/i);
  await assert.rejects(owner.CreateResourceBundle({ unknown: true }), /unsupported unknown/i);
  await assert.rejects(owner.CreateResourceBundle({ textures: null }), /textures must be a plain object/i);
  await assert.rejects(owner.CreateResourceBundle({ textures: new Date() }), /textures must be a plain object/i);
  await assert.rejects(owner.CreateResourceBundle({ textures: { "": textureInputs() } }), /keys must be non-empty/i);
  assert.throws(() => owner.CreateResourcePrepareStage(new Date()), /must be a plain object/i);
  assert.throws(() => owner.CreateResourcePrepareStage({ unknown: true }), /unsupported unknown/i);
  assert.throws(() => owner.CreateResourcePrepareStage({ adapterKey: "" }), /adapterKey must be a non-empty string/i);

  const bundle = await owner.CreateResourceBundle({ textures: { main: textureInputs() } });
  assert.throws(() => foreign.DestroyResourceBundle(bundle), /belongs to another device/i);
  const stage = owner.CreateResourcePrepareStage();
  await assert.rejects(stage.prepare({ textures: { main: textureInputs() } }, {}), /prepare context must provide a resource/i);
  const occupied = adapterResourceSlot();
  occupied.values.set("webgpu", { Destroy() {} });
  await assert.rejects(
    stage.prepare({ textures: { main: textureInputs() } }, { resource: occupied }),
    /is not an engine-owned resource bundle/i
  );
  bundle.Destroy();
});

test("CjsWebGPUDevice owns validated uniform buffers through opaque binding sets", async () =>
{
  const fake = fakeDevice("binding-set");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const data = new Float32Array(16);
  data[3] = 7;
  const inputs = bindingSetInputs(data);
  const bindingSet = webgpu.CreateBindingSet(live, inputs);
  assert.equal(Object.isFrozen(bindingSet), true);
  assert.equal(bindingSet.generation, 1);

  const bufferCall = fake.device.calls.find(([ kind ]) => kind === "createBuffer");
  assert.deepEqual(bufferCall[1], {
    label: "Main.pass0.uniform-buffer:0:1",
    size: 64,
    usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
  });
  const writes = fake.device.calls.filter(([ kind ]) => kind === "writeBuffer");
  assert.equal(writes.length, 1);
  assert.equal(new Float32Array(writes[0][3].buffer)[3], 7);
  const bindGroupCalls = fake.device.calls.filter(([ kind ]) => kind === "createBindGroup");
  assert.equal(bindGroupCalls.length, 1);
  assert.deepEqual(bindGroupCalls[0][1].entries.map((entry) => entry.binding), [ 3, 5, 8 ]);
  assert.equal(bindGroupCalls[0][1].entries[0].resource.buffer, bufferCall[2]);
  assert.equal(bindGroupCalls[0][1].entries[1].resource, inputs.resources.get("sampled-resource:0:0"));

  const draw = webgpu.CreateDraw(live, { bindingSet, draw: { vertexCount: 3 } });
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createBindGroup").length, 1);
  const update = new Float32Array(16);
  update[5] = 11;
  assert.equal(bindingSet.Update(new Map([ [ "uniform-buffer:0:1", update ] ])), bindingSet);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "writeBuffer").length, 2);

  bindingSet.Destroy();
  bindingSet.Destroy();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 1);
  assert.throws(() => bindingSet.Update(new Map([ [ "uniform-buffer:0:1", update ] ])), /binding set is destroyed/i);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, draw), /draw binding set is destroyed/i);
  assert.equal(typeof inputs.resources.get("sampled-resource:0:0").destroy, "undefined");
});

test("CjsWebGPUDevice binding sets fail closed and clean partial allocations", async () =>
{
  const fake = fakeDevice("binding-set-errors");
  const webgpu = new CjsWebGPUDevice({
    device: fake.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const valid = bindingSetInputs();

  assert.throws(() => webgpu.CreateBindingSet(live, {
    uniformData: new Map(),
    resources: valid.resources
  }), /missing uniform data uniform-buffer:0:1/i);
  assert.throws(() => webgpu.CreateBindingSet(live, {
    uniformData: new Map([ [ "uniform-buffer:0:1", new Float32Array(15) ] ]),
    resources: valid.resources
  }), /at least 64 bytes/i);
  assert.throws(() => webgpu.CreateBindingSet(live, {
    uniformData: new Map([ [ "uniform-buffer:0:1", [] ] ]),
    resources: valid.resources
  }), /must be an ArrayBufferView/i);
  const missingExternal = new Map(valid.resources);
  missingExternal.delete("sampler:0:0");
  assert.throws(() => webgpu.CreateBindingSet(live, {
    uniformData: valid.uniformData,
    resources: missingExternal
  }), /missing caller resource sampler:0:0/i);
  assert.throws(() => webgpu.CreateBindingSet(live, {
    uniformData: new Map([ ...valid.uniformData, [ "uniform-buffer:0:99", new Float32Array(16) ] ]),
    resources: valid.resources
  }), /unexpected uniform data uniform-buffer:0:99/i);

  fake.device.bindGroupError = new Error("bind group rejected");
  assert.throws(() => webgpu.CreateBindingSet(live, valid), /bind group rejected/i);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 1);
  fake.device.bindGroupError = null;

  const bindingSet = webgpu.CreateBindingSet(live, valid);
  assert.throws(() => webgpu.CreateDraw(live, {
    bindingSet,
    resources: resources(),
    draw: { vertexCount: 3 }
  }), /exactly one of bindingSet or resources/i);
  const otherLive = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  assert.throws(() => webgpu.CreateDraw(otherLive, {
    bindingSet,
    draw: { vertexCount: 3 }
  }), /another live pipeline/i);
  bindingSet.Destroy();
});

test("CjsWebGPUDevice rejects incomplete or non-canonical live recipes", async () =>
{
  const fake = fakeDevice();
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  await assert.rejects(webgpu.CreateRenderPipeline(pipelineDescriptor(), {}), /recipe\.vertex\.buffers must be an array/i);

  const dynamic = pipelineDescriptor();
  dynamic.bindGroups[0].bindings[0].dynamic = true;
  await assert.rejects(webgpu.PreparePipeline(dynamic), /dynamic offsets/i);

  const unknownVisibility = pipelineDescriptor();
  unknownVisibility.bindGroups[0].bindings[0].visibility = [ "geometry" ];
  await assert.rejects(webgpu.PreparePipeline(unknownVisibility), /unsupported geometry visibility/i);

  const duplicateIdentity = pipelineDescriptor();
  duplicateIdentity.bindGroups[0].bindings[1].resourceKind = "uniform-buffer";
  duplicateIdentity.bindGroups[0].bindings[1].registerIndex = 1;
  await assert.rejects(webgpu.PreparePipeline(duplicateIdentity), /duplicates uniform-buffer:0:1/i);

  const prepared = await webgpu.PreparePipeline(pipelineDescriptor());
  const live = await webgpu.CreateRenderPipeline(prepared, renderRecipe());
  const missing = resources();
  missing.delete("sampler:0:0");
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: missing,
    draw: { vertexCount: 3 }
  }), /missing resource sampler:0:0/i);
});

test("CjsWebGPUDevice reports compilation/validation failures with balanced error scopes", async () =>
{
  const compileFake = fakeDevice("compile-error");
  compileFake.device.compilation.set("Main.pass0.vertex", [ { type: "error", message: "bad vertex", lineNum: 7 } ]);
  const compileDevice = new CjsWebGPUDevice({ device: compileFake.device, shaderStage: SHADER_STAGE });
  await assert.rejects(compileDevice.PreparePipeline(pipelineDescriptor()), /vertex WGSL diagnostics: bad vertex/i);
  assert.equal(compileFake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").length, 1);
  assert.equal(compileFake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length, 1);

  const validationFake = fakeDevice("validation-error");
  validationFake.device.validationErrors.push({ message: "bad layout" });
  const validationDevice = new CjsWebGPUDevice({ device: validationFake.device, shaderStage: SHADER_STAGE });
  await assert.rejects(validationDevice.PreparePipeline(pipelineDescriptor()), /preparation validation failed: bad layout/i);
  assert.equal(validationFake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").length, 1);
  assert.equal(validationFake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length, 1);
});

test("CjsWebGPUDevice serializes device-wide validation scopes and snapshots descriptors", async () =>
{
  const fake = fakeDevice("concurrent");
  const gate = deferred();
  fake.device.compilationWaits.set("Main.pass0.vertex", gate);
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const firstDescriptor = pipelineDescriptor();
  const first = webgpu.PreparePipeline(firstDescriptor);
  await Promise.resolve();
  await Promise.resolve();
  const second = webgpu.PreparePipeline(pipelineDescriptor());
  await Promise.resolve();
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").length, 1);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length, 1);
  const firstPop = fake.device.calls.findIndex(([ kind ]) => kind === "popErrorScope");
  const firstCompilation = fake.device.calls.findIndex(([ kind ]) => kind === "getCompilationInfo");
  assert(firstPop < firstCompilation, "the device-wide scope must be popped before awaiting compilation info");

  firstDescriptor.shaderModules[0].wgsl = "mutated after preparation began";
  firstDescriptor.bindGroups[0].bindings[0].layout.buffer.minBindingSize = 999;
  gate.resolve();
  const [ firstPrepared, secondPrepared ] = await Promise.all([ first, second ]);
  assert.equal(firstPrepared.generation, 1);
  assert.equal(secondPrepared.generation, 1);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "pushErrorScope").length, 2);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "popErrorScope").length, 2);
  assert.equal(fake.device.calls.filter(([ kind ]) => kind === "createShaderModule")[0][1].code.includes("mutated"), false);
  assert.equal(fake.device.calls.find(([ kind ]) => kind === "createBindGroupLayout")[1].entries[0].buffer.minBindingSize, 64);
});

test("CjsWebGPUDevice pops render-pipeline validation scope before awaiting async creation", async () =>
{
  const fake = fakeDevice("pipeline-scope");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const prepared = await webgpu.PreparePipeline(pipelineDescriptor());
  const gate = deferred();
  fake.device.pipelineWait = gate;
  const creation = webgpu.CreateRenderPipeline(prepared, renderRecipe());
  await Promise.resolve();
  await Promise.resolve();
  const pipelineCall = fake.device.calls.findIndex(([ kind ]) => kind === "createRenderPipelineAsync");
  const followingPop = fake.device.calls.findIndex((entry, index) => index > pipelineCall && entry[0] === "popErrorScope");
  assert(pipelineCall >= 0);
  assert(followingPop > pipelineCall, "pipeline scope must pop while async creation is still pending");
  gate.resolve();
  await creation;
});

test("CjsWebGPUDevice preserves zero-count draws and immutable validated draw snapshots", async () =>
{
  const fake = fakeDevice("zero-draw");
  const webgpu = new CjsWebGPUDevice({ device: fake.device, shaderStage: SHADER_STAGE });
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const vertexBuffer = { kind: "originalVertexBuffer" };
  const vertexEntry = { slot: 0, buffer: vertexBuffer, offset: 0 };
  const draw = webgpu.CreateDraw(live, {
    resources: resources(),
    vertexBuffers: [ vertexEntry ],
    draw: { vertexCount: 0, instanceCount: 0, firstVertex: 0, firstInstance: 0 }
  });
  vertexEntry.slot = 4;
  vertexEntry.buffer = { kind: "mutatedBuffer" };
  const calls = [];
  webgpu.EncodeDraw({
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer(...args) { calls.push([ "vertex", ...args ]); },
    draw(...args) { calls.push([ "draw", ...args ]); }
  }, draw);
  assert.deepEqual(calls[0], [ "vertex", 0, vertexBuffer, 0 ]);
  assert.deepEqual(calls[1], [ "draw", 0, 0, 0, 0 ]);

  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    indexBuffer: { buffer: {}, format: "uint16" },
    draw: { vertexCount: 3 }
  }), /non-indexed draw cannot include an index buffer/i);
  assert.throws(() => webgpu.CreateDraw(live, {
    resources: resources(),
    draw: { indexCount: "six" }
  }), /indexCount must be a GPUSize32 value/i);
});

test("CjsWebGPUDevice invalidates stale objects across recreation and device loss", async () =>
{
  const first = fakeDevice("first");
  const second = fakeDevice("second");
  const adapter = { requestDevice: async () => second.device };
  const gpu = { requestAdapter: async () => adapter };
  const webgpu = new CjsWebGPUDevice({
    gpu,
    adapter,
    device: first.device,
    shaderStage: SHADER_STAGE,
    bufferUsage: BUFFER_USAGE
  });
  const live = await webgpu.CreateRenderPipeline(pipelineDescriptor(), renderRecipe());
  const draw = webgpu.CreateDraw(live, { resources: resources(), draw: { vertexCount: 3 } });
  const bindingSet = webgpu.CreateBindingSet(live, bindingSetInputs());

  await webgpu.Recreate();
  assert.equal(webgpu.GetGeneration(), 2);
  assert.throws(() => webgpu.CreateDraw(live, { resources: resources(), draw: { vertexCount: 3 } }), /stale device generation 1/i);
  assert.throws(() => webgpu.EncodeDraw({ setPipeline() {} }, draw), /stale device generation 1/i);
  assert.throws(() => bindingSet.Update(new Map([ [ "uniform-buffer:0:1", new Float32Array(16) ] ])), /stale device generation 1/i);
  bindingSet.Destroy();
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroyBuffer").length, 1);
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroy").length, 1);

  second.lost.resolve({ reason: "unknown", message: "test loss" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(webgpu.IsLost(), true);
  assert.equal(webgpu.GetLostInfo().message, "test loss");
  assert.throws(() => webgpu.GetDevice(), /device is lost/i);
});

test("CjsWebGPUDevice cannot be resurrected by an in-flight recreation", async () =>
{
  const first = fakeDevice("destroy-race-first");
  const acquired = fakeDevice("destroy-race-acquired");
  const adapterGate = deferred();
  const gpu = { requestAdapter: async () => adapterGate.promise };
  const webgpu = new CjsWebGPUDevice({ gpu, device: first.device, shaderStage: SHADER_STAGE });
  const recreation = webgpu.Recreate();
  await Promise.resolve();
  webgpu.Destroy();
  adapterGate.resolve({ requestDevice: async () => acquired.device });
  await assert.rejects(recreation, /recreation was superseded/i);
  assert.equal(webgpu.IsReady(), false);
  assert.throws(() => webgpu.GetDevice(), /device is destroyed/i);
  assert.equal(first.device.calls.filter(([ kind ]) => kind === "destroy").length, 1);
  assert.equal(acquired.device.calls.filter(([ kind ]) => kind === "destroy").length, 1);
});

test("CjsWebGPUDevice lets only the latest overlapping recreation commit", async () =>
{
  const initial = fakeDevice("overlap-initial");
  const older = fakeDevice("overlap-older");
  const newer = fakeDevice("overlap-newer");
  const olderAdapterGate = deferred();
  let requestCount = 0;
  const gpu = {
    requestAdapter: async () =>
    {
      requestCount += 1;
      if (requestCount === 1) return olderAdapterGate.promise;
      return { requestDevice: async () => newer.device };
    }
  };
  const webgpu = new CjsWebGPUDevice({ gpu, device: initial.device, shaderStage: SHADER_STAGE });
  const firstRecreation = webgpu.Recreate();
  await Promise.resolve();
  const secondRecreation = webgpu.Recreate();
  await secondRecreation;
  olderAdapterGate.resolve({ requestDevice: async () => older.device });
  await assert.rejects(firstRecreation, /recreation was superseded/i);
  assert.equal(webgpu.GetDevice(), newer.device);
  assert.equal(webgpu.GetGeneration(), 2);
  assert.equal(older.device.calls.filter(([ kind ]) => kind === "destroy").length, 1);
  assert.equal(newer.device.calls.filter(([ kind ]) => kind === "destroy").length, 0);
});

test("CjsWebGPUDevice.Request keeps adapter policy explicit and reports unavailable WebGPU", async () =>
{
  await assert.rejects(CjsWebGPUDevice.Request({ gpu: null, shaderStage: SHADER_STAGE }), /WebGPU is unavailable/i);
  await assert.rejects(CjsWebGPUDevice.Request({
    gpu: { requestAdapter: async () => null },
    shaderStage: SHADER_STAGE
  }), /requestAdapter returned null/i);

  const fake = fakeDevice("requested");
  const adapterOptions = { powerPreference: "low-power" };
  const deviceDescriptor = { label: "explicit device" };
  const seen = [];
  const adapter = {
    async requestDevice(value)
    {
      seen.push([ "device", value ]);
      return fake.device;
    }
  };
  const gpu = {
    async requestAdapter(value)
    {
      seen.push([ "adapter", value ]);
      return adapter;
    }
  };
  const webgpu = await CjsWebGPUDevice.Request({ gpu, adapterOptions, deviceDescriptor, shaderStage: SHADER_STAGE });
  assert.deepEqual(seen, [ [ "adapter", adapterOptions ], [ "device", deviceDescriptor ] ]);
  assert.equal(webgpu.GetAdapter(), adapter);
  assert.equal(webgpu.GetDevice(), fake.device);
});
