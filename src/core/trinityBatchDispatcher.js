const MAX_GPU_SIZE_32 = 0xffffffff;

const TOPOLOGIES = Object.freeze({
  1: "point-list",
  2: "line-list",
  3: "line-strip",
  4: "triangle-list",
  5: "triangle-strip"
});

const PREPARED_BATCHES = new WeakMap();
const PREPARED_ACCUMULATORS = new WeakMap();
const PREPARED_BATCH_MAPS = new WeakMap();

function fail(message)
{
  const error = new Error(`CjsWebGPUTrinityBatchDispatcher: ${message}`);
  error.code = "CJS_WEBGPU_TRINITY_BATCH_INVALID";
  throw error;
}

function gpuSize32(value, name)
{
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_GPU_SIZE_32)
  {
    fail(`batch ${name} must be a GPUSize32 value`);
  }
  return value;
}

function signedBaseVertex(value)
{
  const bits = gpuSize32(value, "baseVertexLocation");
  return bits > 0x7fffffff ? bits - 0x100000000 : bits;
}

function batchDraw(batch, indexed)
{
  const count = gpuSize32(batch.indexCountPerInstance, "indexCountPerInstance");
  const instanceCount = gpuSize32(batch.instanceCount, "instanceCount");
  const first = gpuSize32(batch.startIndexLocation, "startIndexLocation");
  const firstInstance = gpuSize32(batch.startInstanceLocation, "startInstanceLocation");
  if (indexed)
  {
    return Object.freeze({
      indexCount: count,
      instanceCount,
      firstIndex: first,
      baseVertex: signedBaseVertex(batch.baseVertexLocation),
      firstInstance
    });
  }
  return Object.freeze({
    vertexCount: count,
    instanceCount,
    firstVertex: first,
    firstInstance
  });
}

function pipelineRecipe(recipe, topology)
{
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe))
  {
    fail("ResolveMaterial must return a pipeline recipe");
  }
  const primitive = recipe.primitive ?? {};
  if (!primitive || typeof primitive !== "object" || Array.isArray(primitive))
  {
    fail("resolved pipeline primitive recipe must be an object");
  }
  if (primitive.topology !== undefined && primitive.topology !== topology)
  {
    fail(`batch topology ${topology} conflicts with resolved pipeline topology ${primitive.topology}`);
  }
  return {
    ...recipe,
    primitive: {
      ...primitive,
      topology
    }
  };
}

/**
 * Provisional engine-side adapter for the duck-typed `Tr2RenderBatch` shape.
 *
 * Trinity supplies transient CPU references and draw arguments. Injected
 * composition hooks resolve those references to WebGPU-owned material,
 * geometry, and binding objects without importing runtime-trinity here.
 */
export class CjsWebGPUTrinityBatchDispatcher
{
  #webgpu;

  #hooks;

  /**
   * @param {object} webgpu CjsWebGPUDevice-compatible boundary.
   * @param {object} hooks Backend composition hooks.
   * @param {Function} hooks.ResolveMaterial Resolves batch material to
   *   { pipeline, recipe, prepareOptions? }.
   * @param {Function} hooks.ResolveGeometry Resolves geometrySource to
   *   { geometry, indexed }.
   * @param {Function} hooks.ResolveBindings Resolves batch/object data to
   *   { uniformData, resources }.
   */
  constructor(webgpu, hooks = {})
  {
    for (const method of [
      "PreparePipeline",
      "CreateRenderPipeline",
      "CreateBindingSet",
      "CreateDraw",
      "EncodeDraw"
    ])
    {
      if (typeof webgpu?.[method] !== "function")
      {
        fail(`webgpu boundary requires ${method}`);
      }
    }
    for (const hook of [ "ResolveMaterial", "ResolveGeometry", "ResolveBindings" ])
    {
      if (typeof hooks?.[hook] !== "function")
      {
        fail(`composition hooks require ${hook}`);
      }
    }
    this.#webgpu = webgpu;
    this.#hooks = hooks;
  }

  /**
   * Resolves and validates one transient Trinity batch into a generation-bound
   * WebGPU draw. External geometry and resources remain owned by their
   * resolvers; the returned handle owns only its binding set.
   */
  async Prepare(batch)
  {
    if (!batch || typeof batch !== "object") fail("batch must be an object");
    if (batch.material === null || batch.material === undefined) fail("batch material is required");
    if (batch.geometrySource === null || batch.geometrySource === undefined)
    {
      fail("batch geometrySource is required");
    }
    const topology = TOPOLOGIES[batch.topology];
    if (!topology) fail(`batch topology ${batch.topology} is unsupported`);

    const material = await this.#hooks.ResolveMaterial(batch.material, batch);
    if (!material || typeof material !== "object" || material.pipeline == null)
    {
      fail("ResolveMaterial must return a pipeline and recipe");
    }
    const geometry = await this.#hooks.ResolveGeometry(batch.geometrySource, batch);
    if (!geometry || typeof geometry !== "object" || geometry.geometry == null
      || typeof geometry.indexed !== "boolean")
    {
      fail("ResolveGeometry must return geometry and an indexed boolean");
    }

    const prepared = await this.#webgpu.PreparePipeline(
      material.pipeline,
      material.prepareOptions ?? { warningsAsErrors: true }
    );
    const livePipeline = await this.#webgpu.CreateRenderPipeline(
      prepared,
      pipelineRecipe(material.recipe, topology)
    );
    const bindings = await this.#hooks.ResolveBindings(batch, livePipeline);
    if (!bindings || typeof bindings !== "object")
    {
      fail("ResolveBindings must return uniformData and resources");
    }

    let bindingSet = null;
    try
    {
      bindingSet = this.#webgpu.CreateBindingSet(livePipeline, {
        uniformData: bindings.uniformData,
        resources: bindings.resources
      });
      const draw = this.#webgpu.CreateDraw(livePipeline, {
        bindingSet,
        geometry: geometry.geometry,
        draw: batchDraw(batch, geometry.indexed)
      });
      const handle = Object.freeze({
        batch,
        prepared,
        livePipeline,
        bindingSet,
        draw
      });
      PREPARED_BATCHES.set(handle, {
        owner: this,
        destroyed: false
      });
      return handle;
    }
    catch (error)
    {
      bindingSet?.Destroy?.();
      throw error;
    }
  }

  /** Encodes one prepared batch into the supplied render pass. */
  Encode(pass, handle)
  {
    const state = PREPARED_BATCHES.get(handle);
    if (!state || state.owner !== this) fail("prepared batch belongs to another dispatcher");
    if (state.destroyed) fail("prepared batch is destroyed");
    this.#webgpu.EncodeDraw(pass, handle.draw);
  }

  /** Releases the prepared batch's owned binding set. */
  Destroy(handle)
  {
    const state = PREPARED_BATCHES.get(handle);
    if (!state || state.owner !== this) fail("prepared batch belongs to another dispatcher");
    if (state.destroyed) return;
    state.destroyed = true;
    handle.bindingSet.Destroy();
  }

  /**
   * Snapshots and prepares the ordinary batch vector of one finalized
   * TriRenderBatchAccumulator-compatible object. GDPR batches remain rejected
   * until their grouped state-sharing contract is implemented.
   */
  async PrepareAccumulator(accumulator)
  {
    if (!accumulator || typeof accumulator.GetGdprBatches !== "function"
      || typeof accumulator.GetBatches !== "function")
    {
      fail("accumulator requires GetGdprBatches and GetBatches");
    }
    const gdprBatches = accumulator.GetGdprBatches();
    const batches = accumulator.GetBatches();
    if (!Array.isArray(gdprBatches) || !Array.isArray(batches))
    {
      fail("accumulator batch getters must return arrays");
    }
    if (gdprBatches.length)
    {
      fail("GDPR batch dispatch is not implemented");
    }
    if (typeof accumulator.GetBatchCount === "function"
      && accumulator.GetBatchCount() !== batches.length)
    {
      fail("accumulator batch count does not match its batch vectors");
    }

    const preparedBatches = [];
    try
    {
      for (const batch of batches)
      {
        preparedBatches.push(await this.Prepare(batch));
      }
      const handle = Object.freeze({
        accumulator,
        batches: Object.freeze(preparedBatches.slice())
      });
      PREPARED_ACCUMULATORS.set(handle, {
        owner: this,
        destroyed: false
      });
      return handle;
    }
    catch (error)
    {
      for (let index = preparedBatches.length - 1; index >= 0; index -= 1)
      {
        this.Destroy(preparedBatches[index]);
      }
      throw error;
    }
  }

  /** Encodes every ordinary prepared batch in accumulator order. */
  EncodeAccumulator(pass, handle)
  {
    const state = PREPARED_ACCUMULATORS.get(handle);
    if (!state || state.owner !== this) fail("prepared accumulator belongs to another dispatcher");
    if (state.destroyed) fail("prepared accumulator is destroyed");
    for (const batch of handle.batches)
    {
      this.Encode(pass, batch);
    }
  }

  /** Releases every binding set owned by a prepared accumulator. */
  DestroyAccumulator(handle)
  {
    const state = PREPARED_ACCUMULATORS.get(handle);
    if (!state || state.owner !== this) fail("prepared accumulator belongs to another dispatcher");
    if (state.destroyed) return;
    state.destroyed = true;
    for (let index = handle.batches.length - 1; index >= 0; index -= 1)
    {
      this.Destroy(handle.batches[index]);
    }
  }

  /**
   * Snapshots and prepares every accumulator in one
   * TriRenderBatchMap-compatible object without interpreting batch-type
   * meaning or selecting render passes.
   */
  async PrepareBatchMap(batchMap)
  {
    if (!batchMap || typeof batchMap.GetBatchTypes !== "function"
      || typeof batchMap.GetAccumulator !== "function")
    {
      fail("batch map requires GetBatchTypes and GetAccumulator");
    }
    const batchTypes = batchMap.GetBatchTypes();
    if (!Array.isArray(batchTypes)) fail("batch map GetBatchTypes must return an array");
    const seen = new Set();
    for (const batchType of batchTypes)
    {
      if (!Number.isInteger(batchType) || batchType < 0)
      {
        fail("batch map types must be non-negative integers");
      }
      if (seen.has(batchType)) fail(`batch map duplicates batch type ${batchType}`);
      seen.add(batchType);
    }

    const entries = [];
    try
    {
      for (const batchType of batchTypes)
      {
        const accumulator = batchMap.GetAccumulator(batchType);
        if (!accumulator) fail(`batch map has no accumulator for type ${batchType}`);
        entries.push(Object.freeze({
          batchType,
          accumulator: await this.PrepareAccumulator(accumulator)
        }));
      }
      const preparedCount = entries.reduce(
        (count, entry) => count + entry.accumulator.batches.length,
        0
      );
      if (typeof batchMap.GetBatchCount === "function"
        && batchMap.GetBatchCount() !== preparedCount)
      {
        fail("batch map count does not match its accumulators");
      }
      const handle = Object.freeze({
        batchMap,
        entries: Object.freeze(entries.slice())
      });
      PREPARED_BATCH_MAPS.set(handle, {
        owner: this,
        destroyed: false,
        entries: new Map(entries.map((entry) => [ entry.batchType, entry ]))
      });
      return handle;
    }
    catch (error)
    {
      for (let index = entries.length - 1; index >= 0; index -= 1)
      {
        this.DestroyAccumulator(entries[index].accumulator);
      }
      throw error;
    }
  }

  /**
   * Encodes one prepared batch type into a caller-selected compatible render
   * pass.
   */
  EncodeBatchType(pass, handle, batchType)
  {
    const state = PREPARED_BATCH_MAPS.get(handle);
    if (!state || state.owner !== this) fail("prepared batch map belongs to another dispatcher");
    if (state.destroyed) fail("prepared batch map is destroyed");
    const entry = state.entries.get(batchType);
    if (!entry) fail(`prepared batch map has no batch type ${batchType}`);
    this.EncodeAccumulator(pass, entry.accumulator);
  }

  /** Releases every accumulator and binding set owned by a prepared batch map. */
  DestroyBatchMap(handle)
  {
    const state = PREPARED_BATCH_MAPS.get(handle);
    if (!state || state.owner !== this) fail("prepared batch map belongs to another dispatcher");
    if (state.destroyed) return;
    state.destroyed = true;
    for (let index = handle.entries.length - 1; index >= 0; index -= 1)
    {
      this.DestroyAccumulator(handle.entries[index].accumulator);
    }
  }
}
