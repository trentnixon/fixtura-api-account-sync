# Games Memory Optimization - Action Plan

## Current State ✅

We've already implemented:
- ✅ Streaming assignment (assign immediately after batch)
- ✅ Reduced batch sizes (3 teams default)
- ✅ Sequential processing (concurrency: 1)
- ✅ Memory cleanup (every 5 batches)

## Additional Optimizations Needed 🔧

### Priority 1: Assign Fixtures Immediately After Each Team (CRITICAL)

**Current Problem**:
- We wait for entire batch (3 teams) to complete before assigning
- 3 teams × 5 fixtures = 15 fixtures accumulate before assignment

**Solution**: Assign fixtures immediately after scraping each team

**Impact**:
- Reduces fixture accumulation from 15 fixtures → 5 fixtures per assignment
- Memory stays even lower

**Implementation**:
```javascript
// In getGameData.js → processGamesBatch()
// Instead of returning all fixtures, assign immediately:

async (team, index) => {
  const gameData = await gameDataFetcher.fetchGameData();

  // NEW: Assign immediately after scraping this team
  if (gameData && gameData.length > 0) {
    await assignFixturesImmediately(gameData, dataObj);
  }

  // Return only IDs for tracking
  return gameData.map(f => f.gameID);
}
```

**Files to Modify**:
- `dataProcessing/scrapeCenter/GameData/getGameData.js`
- `dataProcessing/processors/gameDataProcessor.js`

---

### Priority 2: Reduce Fixture Object Size (HIGH)

**Current Problem**:
- Each fixture object contains ~15 fields
- Some fields are large (dateRangeObj, finalDaysPlay)
- All fields kept in memory until assignment

**Solution**: Strip unnecessary fields immediately after scraping

**Impact**:
- Reduces fixture size from ~1KB → ~500 bytes
- 50% memory reduction per fixture

**Implementation**:
```javascript
// In GameDataFetcher.js → extractMatchDetails()
// Return minimal fixture object:

return {
  // Essential fields only
  gameID: scoreCardInfo?.gameID,
  teamHomeID: teams?.[0]?.id,
  teamAwayID: teams?.[1]?.id,
  grade: [this.gradeID],
  round,
  date,
  dayOne: dateObj,
  status,
  // Remove: dateRangeObj, finalDaysPlay, urlToScoreCard (if not needed)
};
```

**Files to Modify**:
- `dataProcessing/scrapeCenter/GameData/GameDataFetcher.js`

---

### Priority 3: Process Teams One at a Time for Large Associations (HIGH)

**Current Problem**:
- Batch size of 3 still accumulates fixtures
- For large associations, even 3 teams can be too much

**Solution**:
- Detect large associations (team count > threshold)
- Use batch size = 1 for large associations
- Or enable category isolation automatically

**Impact**:
- Eliminates batch-level accumulation
- Memory stays at absolute minimum

**Implementation**:
```javascript
// In gameDataProcessor.js → process()
const teams = this.dataObj.TEAMS;
const isLargeAssociation = teams.length > 500;

// Auto-enable category isolation for large associations
if (isLargeAssociation && !this.options.isolateByCategory) {
  logger.info("[GAMES] Large association detected - auto-enabling category isolation");
  this.options.isolateByCategory = true;
}

// Or use batch size = 1 for large associations
const batchSize = isLargeAssociation
  ? 1  // Process one team at a time
  : parseInt(process.env.GAME_DATA_BATCH_SIZE || "3", 10);
```

**Files to Modify**:
- `dataProcessing/processors/gameDataProcessor.js`

---

### Priority 4: Reduce Assignment Batch Size (MEDIUM)

**Current Problem**:
- Assignment batch size = 10 fixtures
- Still accumulates 10 fixtures before assigning

**Solution**: Reduce assignment batch size to 5 or even 1

**Impact**:
- Lower memory footprint during assignment
- More frequent GC opportunities

**Implementation**:
```javascript
// In gameDataProcessor.js
const assignmentBatchSize = parseInt(
  process.env.GAME_DATA_ASSIGNMENT_BATCH_SIZE || "5",  // Reduced from 10
  10
);

// Or even smaller for large associations:
const assignmentBatchSize = isLargeAssociation
  ? 1  // Assign one at a time
  : 5; // Default: 5
```

**Files to Modify**:
- `dataProcessing/processors/gameDataProcessor.js`

---

### Priority 5: Memory-Aware Processing (MEDIUM)

**Current Problem**:
- Fixed batch sizes regardless of memory pressure
- No adaptation to current memory usage

**Solution**: Dynamically adjust batch sizes based on memory usage

**Impact**:
- Automatically reduces batch size when memory is high
- Prevents memory spikes

**Implementation**:
```javascript
// In gameDataProcessor.js → process()
let batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "3", 10);

// Check memory before processing
if (this.options.memoryTracker) {
  const stats = this.options.memoryTracker.getCurrentStats();

  // Reduce batch size if memory is high
  if (stats.rss > 500 * 1024 * 1024) { // > 500MB
    batchSize = Math.max(1, Math.floor(batchSize * 0.5)); // Reduce by 50%
    logger.warn(`[GAMES] Memory is high (${stats.rss.toFixed(2)} MB) - reducing batch size to ${batchSize}`);
  }

  // Increase batch size if memory is low
  if (stats.rss < 300 * 1024 * 1024) { // < 300MB
    batchSize = Math.min(5, Math.floor(batchSize * 1.2)); // Increase by 20%
  }
}
```

**Files to Modify**:
- `dataProcessing/processors/gameDataProcessor.js`

---

### Priority 6: Clear Fixture References More Aggressively (LOW)

**Current Problem**:
- Fixtures cleared after assignment batch completes
- Could clear immediately after each fixture assignment

**Solution**: Clear fixture reference immediately after assignment

**Impact**:
- Faster memory release
- Lower peak memory

**Implementation**:
```javascript
// In assignGameData.js → processBatch()
for (const game of batch) {
  await this.processGame(game);

  // NEW: Clear game reference immediately
  game = null;

  // Force GC after every 5 games
  if (global.gc && (index % 5 === 0)) {
    global.gc();
  }
}
```

**Files to Modify**:
- `dataProcessing/assignCenter/assignGameData.js`

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. ✅ **Assign fixtures immediately after each team** (Priority 1)
   - **Impact**: High
   - **Effort**: Medium
   - **Risk**: Low

2. ✅ **Reduce fixture object size** (Priority 2)
   - **Impact**: High
   - **Effort**: Low
   - **Risk**: Low (need to verify which fields are required)

### Phase 2: High-Impact Optimizations
3. ✅ **Process teams one at a time for large associations** (Priority 3)
   - **Impact**: High
   - **Effort**: Low
   - **Risk**: Low

4. ✅ **Reduce assignment batch size** (Priority 4)
   - **Impact**: Medium
   - **Effort**: Low
   - **Risk**: Low

### Phase 3: Advanced Optimizations
5. ✅ **Memory-aware processing** (Priority 5)
   - **Impact**: Medium
   - **Effort**: Medium
   - **Risk**: Medium (needs testing)

6. ✅ **Aggressive reference clearing** (Priority 6)
   - **Impact**: Low
   - **Effort**: Low
   - **Risk**: Low

---

## Expected Results

### Current (After Streaming Assignment):
- Small association: ~200MB peak ✅
- Large association: ~400MB peak ⚠️

### After Priority 1-2 Fixes:
- Small association: ~150MB peak ✅
- Large association: ~250MB peak ✅

### After All Fixes:
- Small association: ~100MB peak ✅
- Large association: ~200MB peak ✅

---

## Testing Plan

### Test Scenarios:
1. **Small Association** (< 100 teams)
   - Verify memory stays under 200MB
   - Verify process completes successfully

2. **Medium Association** (100-500 teams)
   - Verify memory stays under 300MB
   - Verify process completes successfully

3. **Large Association** (500-1000 teams)
   - Verify memory stays under 400MB
   - Verify process completes successfully

4. **Very Large Association** (1000+ teams)
   - Verify memory stays under 500MB
   - Verify process completes successfully

### Metrics to Monitor:
- Peak memory usage
- Memory growth rate
- Process completion time
- Error rate

---

## Configuration Options

### New Environment Variables:

```bash
# Auto-enable category isolation for large associations
GAMES_AUTO_CATEGORY_ISOLATION=true
GAMES_LARGE_ASSOCIATION_THRESHOLD=500

# Per-team assignment (most aggressive)
GAMES_ASSIGN_PER_TEAM=true

# Reduced fixture fields
GAMES_MINIMAL_FIXTURE_FIELDS=true

# Memory-aware processing
GAMES_MEMORY_AWARE_PROCESSING=true
GAMES_MEMORY_HIGH_THRESHOLD_MB=500
GAMES_MEMORY_LOW_THRESHOLD_MB=300
```

---

## Rollback Plan

If issues occur:
1. Revert Priority 1 changes (per-team assignment)
2. Revert Priority 2 changes (fixture size reduction)
3. Restore default batch sizes
4. Disable memory-aware processing

---

**Created**: 2025-12-05
**Status**: Ready for Implementation

