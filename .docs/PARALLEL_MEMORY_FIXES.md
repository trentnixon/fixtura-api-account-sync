# Parallel Processing Memory Management Fixes

**Context:** Memory jumped from ~900MB to 2GB+ after adding parallel processing. We need parallel processing but must manage memory better.

**Root Cause:** Parallel processing accumulates full result objects in memory simultaneously across multiple concurrent operations, causing memory to spike.

---

## The Problem

### Memory Multiplication During Parallel Processing

When processing in parallel:

- **3 concurrent operations** × **full fixture objects** = **3x memory usage** during processing
- **All results accumulated** before processing completes = **peak memory spike**
- **Results from multiple batches accumulated** = **memory grows linearly**

**Example:**

- Processing 100 teams with concurrency=3
- Each team returns ~10 fixtures × 5KB = 50KB per team
- 3 teams processing simultaneously = 150KB in memory
- But results accumulate: 100 teams × 50KB = **5MB accumulated**
- Plus all the intermediate data structures = **much more**

---

## Critical Fixes

### Fix #1: Stream Results During Parallel Processing (HIGHEST IMPACT)

**Problem:** `processInParallel` accumulates ALL results in arrays before returning. With 3 concurrent operations, this means 3x memory usage.

**Location:** `dataProcessing/utils/parallelUtils.js`

**Current Code:**

```javascript
const results = []; // Line 79
// ...
results.push({ item, index, result, success: true }); // Line 112
// ...
return {
  results: results
    .map((r) => (r.success ? r.result : null))
    .filter((r) => r !== null),
  // ... returns ALL accumulated results
};
```

**Fix:** Add streaming option to process results as they complete, not accumulate:

```javascript
async function processInParallel(
  items,
  processor,
  concurrency = 3,
  options = {}
) {
  const {
    continueOnError = true,
    logProgress = false,
    context = "parallel",
    streamResults = false, // NEW: Stream results instead of accumulating
    onResult = null, // NEW: Callback for each result
  } = options;

  // ... existing setup code ...

  const results = [];
  const errors = [];
  let activeCount = 0;

  // Create promises with streaming support
  const promises = items.map((item, index) =>
    limit(async () => {
      try {
        const result = await processor(item, index);

        // MEMORY FIX: Stream result immediately if streaming enabled
        if (streamResults && onResult) {
          // Process result immediately, don't accumulate
          await onResult(result, index, item);
          return { item, index, result, success: true };
        }

        // Otherwise accumulate (backward compatibility)
        results.push({ item, index, result, success: true });
        return { item, index, result, success: true };
      } catch (error) {
        // ... error handling ...
      }
    })
  );

  await Promise.all(promises);

  // If streaming, results array will be empty/minimal
  // Return summary only
  return {
    results: streamResults
      ? []
      : results
          .map((r) => (r.success ? r.result : null))
          .filter((r) => r !== null),
    errors,
    summary: {
      /* ... */
    },
  };
}
```

**Usage in GameDataProcessor:**

```javascript
// Instead of accumulating all fixtures
const scrapedFixtureIds = new Set();

const { summary } = await processInParallel(
  teamsBatch,
  async (team, index) => {
    // ... process team ...
    return gameData;
  },
  concurrency,
  {
    streamResults: true, // Enable streaming
    onResult: async (gameData, index, team) => {
      // MEMORY FIX: Process result immediately, extract IDs only
      if (gameData && Array.isArray(gameData)) {
        gameData.forEach((fixture) => {
          if (fixture.gameID) {
            scrapedFixtureIds.add(fixture.gameID);
          }
        });
      }
      // Don't accumulate full objects
    },
  }
);
```

**Memory Savings:** ~50-70% reduction during parallel processing (processes results as they complete, not all at once)

---

### Fix #2: Reduce Result Object Size During Parallel Processing

**Problem:** Each result contains full fixture objects with all properties. With parallel processing, multiple full objects exist simultaneously.

**Location:** `dataProcessing/scrapeCenter/GameData/getGameData.js` and `dataProcessing/services/fixtureValidationService.js`

**Current Code:**

```javascript
// Returns full fixture objects
return gameData.flat().filter((match) => match !== null);
```

**Fix:** Extract only essential data immediately:

```javascript
// In GameDataFetcher or processor
async (team, index) => {
  const gameData = await gameDataFetcher.fetchGameData();
  const fixtures = gameData.flat().filter((match) => match !== null);

  // MEMORY FIX: Extract only essential fields immediately
  const minimalFixtures = fixtures.map((fixture) => ({
    gameID: fixture.gameID,
    id: fixture.id,
    // Only include fields needed for comparison/assignment
    // Don't store full objects
  }));

  return minimalFixtures;
};
```

**Memory Savings:** ~60-80% per fixture object (from ~5-10KB to ~200-500 bytes)

---

### Fix #3: Clear Batch Results Immediately After Processing

**Problem:** `processInBatches` accumulates results from all batches in `allResults` array.

**Location:** `dataProcessing/utils/parallelUtils.js` and `dataProcessing/processors/gameDataProcessor.js`

**Current Code:**

```javascript
// In processInBatches
const allResults = [];
// ...
allResults.push(...results); // Accumulates all batches
```

**Fix:** Process and discard batch results immediately:

```javascript
// In GameDataProcessor
async process() {
  const batchSize = 10;
  const scrapedFixtureIds = new Set(); // Only store IDs

  const teamBatches = this.createBatches(this.dataObj.TEAMS, batchSize);

  for (const teamsBatch of teamBatches) {
    const getGameDataObj = new getTeamsGameData({
      ...this.dataObj,
      TEAMS: teamsBatch,
    });

    let scrapedGameData = await getGameDataObj.setup();

    if (!scrapedGameData || scrapedGameData.length === 0) {
      continue;
    }

    // MEMORY FIX: Extract IDs immediately, discard full objects
    scrapedGameData.forEach(fixture => {
      if (fixture.gameID) {
        scrapedFixtureIds.add(fixture.gameID);
      }
    });

    // Assign to CMS (this may create copies, but we clear after)
    const assignGameDataObj = new assignGameData(scrapedGameData, this.dataObj);
    await assignGameDataObj.setup();

    // MEMORY FIX: Clear batch data immediately after processing
    scrapedGameData = null;

    // MEMORY FIX: Force GC hint after every 3 batches
    if (BatchItem % 3 === 0 && global.gc) {
      global.gc();
    }

    BatchItem++;
  }

  // Return only IDs
  return {
    process: true,
    scrapedFixtureIds: Array.from(scrapedFixtureIds),
  };
}
```

**Memory Savings:** ~2-5MB by not accumulating full fixture arrays across batches

---

### Fix #4: Process Validation Results Incrementally

**Problem:** Validation accumulates all results before returning. With parallel processing, multiple validation results exist simultaneously.

**Location:** `dataProcessing/services/fixtureValidationService.js`

**Current Code:**

```javascript
const results = [];
// ...
results.push(...batchResults.results); // Accumulates all batches
```

**Fix:** Process validation results incrementally, store only minimal data:

```javascript
async validateFixturesBatch(fixtures, concurrencyLimit = 5) {
  // MEMORY FIX: Store only minimal result data
  const validationResults = []; // Will contain minimal objects
  const batchSize = concurrencyLimit;
  const batches = [];

  for (let i = 0; i < fixtures.length; i += batchSize) {
    batches.push(fixtures.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      const batchResults = await processInParallel(
        batch,
        async (fixture, i) => {
          // ... validation logic ...
          const result = await this.validateFixtureUrlWithPuppeteer(/* ... */);

          // MEMORY FIX: Return only minimal result data
          return {
            fixtureId: fixture.id || fixture.attributes?.id,
            gameID: fixture.gameID || fixture.attributes?.gameID,
            valid: result.valid,
            statusCode: result.httpStatus,
            // Don't include: full error objects, URLs, response bodies
          };
        },
        concurrency,
        { /* ... */ }
      );

      // MEMORY FIX: Extract minimal data immediately
      const minimalResults = batchResults.results.map(r => ({
        fixtureId: r.fixtureId,
        gameID: r.gameID,
        valid: r.valid,
        statusCode: r.statusCode,
      }));

      validationResults.push(...minimalResults);

      // MEMORY FIX: Clear batch results immediately
      batchResults.results = null;
      batchResults.errors = null;

      // MEMORY FIX: Force GC hint after every 5 batches
      if (batchIndex > 0 && batchIndex % 5 === 0 && global.gc) {
        global.gc();
      }
    } catch (batchError) {
      // ... error handling ...
    }
  }

  return validationResults;
}
```

**Memory Savings:** ~1-2MB by reducing result object sizes and clearing immediately

---

### Fix #5: Reduce Concurrency for Memory-Constrained Environments

**Problem:** Higher concurrency = more simultaneous memory usage. With 2GB limit, we may need to reduce concurrency.

**Location:** `dataProcessing/puppeteer/constants.js`

**Current Code:**

```javascript
const PARALLEL_CONFIG = {
  PAGE_POOL_SIZE: 2, // Already reduced
  COMPETITIONS_CONCURRENCY: 3,
  TEAMS_CONCURRENCY: 3,
  VALIDATION_CONCURRENCY: 5,
};
```

**Fix:** Reduce concurrency for memory-constrained environments:

```javascript
const PARALLEL_CONFIG = {
  PAGE_POOL_SIZE: parseInt(process.env.PARALLEL_PAGE_POOL_SIZE || "2", 10),
  // MEMORY FIX: Reduce concurrency for 2GB instances
  COMPETITIONS_CONCURRENCY: parseInt(
    process.env.PARALLEL_COMPETITIONS_CONCURRENCY || "2", // Reduced from 3
    10
  ),
  TEAMS_CONCURRENCY: parseInt(
    process.env.PARALLEL_TEAMS_CONCURRENCY || "2", // Reduced from 3
    10
  ),
  VALIDATION_CONCURRENCY: parseInt(
    process.env.PARALLEL_VALIDATION_CONCURRENCY || "3", // Reduced from 5
    10
  ),
};
```

**Memory Savings:** ~30-40% reduction in peak memory during parallel processing (fewer simultaneous operations)

**Trade-off:** Slightly slower processing, but prevents memory exhaustion

---

### Fix #6: Clear Parallel Processing Intermediate Arrays

**Problem:** `processInParallel` stores results in arrays that persist until all operations complete.

**Location:** `dataProcessing/utils/parallelUtils.js`

**Fix:** Clear intermediate arrays more aggressively:

```javascript
async function processInParallel(/* ... */) {
  const results = [];
  const errors = [];

  // ... processing ...

  // MEMORY FIX: Extract final results immediately
  const finalResults = results
    .map((r) => (r.success ? r.result : null))
    .filter((r) => r !== null);

  // MEMORY FIX: Clear intermediate arrays
  results.length = 0; // Clear array
  errors.length = 0; // Clear array (or keep if needed for return)

  return {
    results: finalResults,
    errors, // Keep errors if needed
    summary,
  };
}
```

**Memory Savings:** ~5-10MB by clearing intermediate arrays immediately

---

### Fix #7: Process Game Data in Smaller Batches

**Problem:** Processing 10 teams at a time accumulates results from all 10 teams before moving to next batch.

**Location:** `dataProcessing/processors/gameDataProcessor.js`

**Current Code:**

```javascript
const batchSize = 10;
```

**Fix:** Reduce batch size and process more incrementally:

```javascript
// MEMORY FIX: Smaller batches for memory-constrained environments
const batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "5", 10); // Reduced from 10

// Or make it dynamic based on memory
const getBatchSize = () => {
  const memUsage = process.memoryUsage();
  const rssMB = memUsage.rss / 1024 / 1024;

  // Reduce batch size if memory is high
  if (rssMB > 1500) {
    return 3; // Very small batches
  } else if (rssMB > 1200) {
    return 5; // Small batches
  }
  return 10; // Normal batches
};

const batchSize = getBatchSize();
```

**Memory Savings:** ~20-30% reduction in peak memory (smaller batches = less accumulation)

---

## Implementation Priority

### Immediate (Critical for 2GB limit):

1. **Fix #5** - Reduce concurrency (quick config change, ~30-40% memory reduction)
2. **Fix #2** - Reduce result object size (~60-80% per object)
3. **Fix #3** - Clear batch results immediately (~2-5MB)

### High Priority:

4. **Fix #1** - Stream results during parallel processing (~50-70% reduction during processing)
5. **Fix #4** - Process validation incrementally (~1-2MB)

### Medium Priority:

6. **Fix #7** - Smaller batches (~20-30% reduction)
7. **Fix #6** - Clear intermediate arrays (~5-10MB)

---

## Combined Impact

**Conservative Estimate:**

- Concurrency reduction: ~30-40% = ~300-400MB savings
- Result size reduction: ~60-80% = ~200-300MB savings
- Batch clearing: ~2-5MB
- **Total: ~500-700MB savings**

**Optimistic Estimate:**

- All fixes combined: ~700-1000MB savings
- Would bring memory from 2GB+ down to **~1-1.3GB**

---

## Testing Strategy

1. **Monitor memory during parallel processing** - Use `process.memoryUsage()` before/during/after parallel operations
2. **Test with large projects** - 100+ teams, 500+ fixtures
3. **Measure peak memory** - Not just average, but peak during parallel operations
4. **Verify functionality** - Ensure parallel processing still works correctly
5. **Compare before/after** - Measure memory usage with each fix applied

---

## Key Insight

**The problem isn't parallel processing itself** - it's **accumulating full result objects during parallel processing**.

**Solution:** Process results incrementally, store only minimal data, and clear intermediate results immediately. This allows parallel processing to continue while keeping memory usage manageable.
