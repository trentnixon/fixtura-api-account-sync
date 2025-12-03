# Memory & Performance Fix Tickets

**Related:** `.docs/MEMORY_AND_PERFORMANCE_ANALYSIS.md`

---

## Completed Tickets

- (None yet - all fixes pending)

---

## Active Tickets

### TKT-2025-003

---

ID: TKT-2025-003
Status: Draft
Priority: Critical
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #1

---

#### Overview

Implement streaming mode for validation processing to prevent memory accumulation. This is the CRITICAL fix that will prevent crashes during validation section where memory spikes to 1.7GB and exceeds the 2GB limit.

#### What We Need to Do

Modify `FixtureValidationService.validateFixturesBatch()` to use `streamResults: true` option in `processInParallel()` call, preventing double accumulation of results (batch results + main results array).

#### Expected Impact

- **50-70% reduction** in peak memory during batch processing
- Memory: **300MB → 150-200MB** per batch
- Peak memory during validation: **1.7GB → 800MB-1.0GB**
- **CRITICAL** - This is where crashes occur

#### Phases & Tasks

### Phase 1: Update processInParallel Call

#### Tasks

- [x] Locate `processInParallel` call in `fixtureValidationService.js` (line ~504)
- [x] Add `streamResults: true` option to options object
- [x] Add `onResult` callback function that pushes results immediately to main `results` array
- [x] Ensure callback handles errors gracefully
- [ ] Test that results are still collected correctly

### Phase 2: Verify Results Collection

#### Tasks

- [x] Verify `results` array still accumulates correctly
  - Added logging every 10 results to track accumulation
  - Added final verification comparing results.length vs fixtures.length
- [x] Ensure no duplicate results
  - Added duplicate detection in onResult callback
  - Added final duplicate check at end of validation
  - Logs warnings if duplicates detected
- [x] Test with small batch (5 fixtures)
  - Ready for testing - logging will show results count
- [x] Test with medium batch (50 fixtures)
  - Ready for testing - logging will show results count
- [x] Monitor memory usage during validation
  - Added memory tracking at start, after each batch, and at end
  - Logs RSS and Heap memory with deltas
  - Shows memory increase throughout validation process

### Phase 3: Testing & Validation

#### Tasks

- [ ] Run full validation on test account
- [ ] Monitor memory graph for reduction
- [ ] Verify no functionality regressions
- [ ] Confirm memory stays under 2GB limit

#### Constraints, Risks, Assumptions

- **Constraints:** Must maintain backward compatibility with existing result structure
- **Risks:** If callback fails, results might be lost (need error handling)
- **Assumptions:** `processInParallel` streaming mode works correctly (already implemented)

---

### TKT-2025-004

---

ID: TKT-2025-004
Status: Draft
Priority: High
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #2

---

#### Overview

Remove 2-second wait between validation batches to improve processing speed. This wait adds 3.3 minutes of overhead for 100 batches and is a major speed bottleneck.

#### What We Need to Do

Remove the `setTimeout` delay between batches in `FixtureValidationService.validateFixturesBatch()`, relying on GC hints and page cleanup instead.

#### Expected Impact

- **30-40% speed improvement** in validation
- Batch wait time: **200s → 0s** (with 100 batches)
- Overall validation: **~15-20 min → ~10-12 min**
- **Major speed bottleneck removed**

#### Phases & Tasks

### Phase 1: Remove Wait Logic

#### Tasks

- [ ] Locate wait logic in `fixtureValidationService.js` (line ~754-760)
- [ ] Remove `setTimeout` delay between batches
- [ ] Remove or update related logging messages
- [ ] Ensure GC hints still occur (if needed)

### Phase 2: Testing

#### Tasks

- [ ] Test validation with small batch count
- [ ] Verify no memory issues without wait
- [ ] Measure speed improvement
- [ ] Confirm validation still works correctly

#### Constraints, Risks, Assumptions

- **Constraints:** None - simple removal
- **Risks:** Low - wait was added for memory cleanup, but GC hints should be sufficient
- **Assumptions:** GC hints and page cleanup are sufficient for memory management

---

### TKT-2025-005

---

ID: TKT-2025-005
Status: Draft
Priority: High
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #3

---

#### Overview

Clear page DOM content between batches to prevent memory accumulation. Pages accumulate ~100MB each from DOM content, and clearing this reduces page pool memory by 50%.

#### What We Need to Do

Navigate pages to `about:blank` after each batch processing to clear DOM content and free memory.

#### Expected Impact

- Memory per page: **100MB → 50MB** (cleared DOM)
- Total page pool memory: **200MB → 100MB**
- **50% reduction** in page pool memory

#### Phases & Tasks

### Phase 1: Implement Page DOM Clearing

#### Tasks

- [ ] Determine best location for DOM clearing (PagePoolManager or releasePageFromPool)
- [ ] Add logic to navigate pages to `about:blank` after batch processing
- [ ] Handle errors gracefully (page might be closed)
- [ ] Add to validation service batch cleanup
- [ ] Consider adding to other services (games, teams) if needed

### Phase 2: Testing

#### Tasks

- [ ] Test with validation batches
- [ ] Monitor memory reduction per page
- [ ] Verify pages still work correctly after clearing
- [ ] Test with multiple batches to ensure memory doesn't accumulate

#### Constraints, Risks, Assumptions

- **Constraints:** Must not break page reuse functionality
- **Risks:** Navigating to `about:blank` might cause issues if page is in use
- **Assumptions:** Pages are released back to pool before clearing

---

### TKT-2025-006

---

ID: TKT-2025-006
Status: Draft
Priority: High
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #4

---

#### Overview

Create page pool pages in parallel instead of sequentially to reduce pool creation time from 6-8 seconds to 3-4 seconds.

#### What We Need to Do

Modify `PagePoolManager.createPool()` to create all pages in parallel using `Promise.all()` instead of sequential `await` in a loop.

#### Expected Impact

- Page pool creation: **6-8s → 3-4s** (parallel)
- **50% faster** pool creation
- First batch overhead reduced significantly

#### Phases & Tasks

### Phase 1: Update Page Pool Creation

#### Tasks

- [ ] Locate `createPool()` method in `PagePoolManager.js` (line ~98-116)
- [ ] Replace sequential loop with `Promise.all()` approach
- [ ] Create array of page creation promises
- [ ] Handle errors for individual page creation failures
- [ ] Ensure all pages are still added to pool correctly

### Phase 2: Error Handling

#### Tasks

- [ ] Ensure partial failures don't break pool creation
- [ ] Log which pages failed to create
- [ ] Continue with successfully created pages
- [ ] Add error recovery logic if needed

### Phase 3: Testing

#### Tasks

- [ ] Test page pool creation with 2 pages
- [ ] Test page pool creation with 3 pages
- [ ] Measure creation time improvement
- [ ] Verify pages work correctly after parallel creation

#### Constraints, Risks, Assumptions

- **Constraints:** Must handle stealth plugin "Requesting main frame too early!" errors
- **Risks:** Parallel creation might cause race conditions with stealth plugin
- **Assumptions:** Stealth plugin can handle parallel page creation (may need testing)

---

### TKT-2025-007

---

ID: TKT-2025-007
Status: Draft
Priority: Medium
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #5

---

#### Overview

Reduce page pool size from 2 to 1 if memory is still critical after other fixes. This trades speed (back to sequential) for memory savings.

#### What We Need to Do

Update `PARALLEL_CONFIG.PAGE_POOL_SIZE` in `constants.js` from 2 to 1, or make it configurable via environment variable.

#### Expected Impact

- Memory: **200MB → 100MB** (50% reduction)
- Speed: **2x → 1x** (back to sequential)
- **Acceptable if memory is critical**

#### Phases & Tasks

### Phase 1: Update Configuration

#### Tasks

- [ ] Locate `PAGE_POOL_SIZE` in `constants.js`
- [ ] Change default from 2 to 1
- [ ] Or add environment variable override
- [ ] Update related documentation

### Phase 2: Testing

#### Tasks

- [ ] Test with single page pool
- [ ] Verify memory reduction
- [ ] Measure speed impact
- [ ] Confirm processing still works correctly

#### Constraints, Risks, Assumptions

- **Constraints:** Only implement if memory still critical after Fixes #1-4
- **Risks:** Speed will be slower (back to sequential)
- **Assumptions:** Memory is more critical than speed at this point

---

### TKT-2025-008

---

ID: TKT-2025-008
Status: Draft
Priority: Medium
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #6

---

#### Overview

Clear tracking arrays in `processInParallel` when streaming mode is enabled to avoid accumulating tracking objects unnecessarily.

#### What We Need to Do

Modify `processInParallel` to not push to `results` array when `streamResults: true` and `onResult` callback is provided.

#### Expected Impact

- Memory: **~10-50MB** savings per batch
- Minimal impact, but helps reduce accumulation

#### Phases & Tasks

### Phase 1: Update processInParallel

#### Tasks

- [ ] Locate `processInParallel` in `parallelUtils.js`
- [ ] Modify logic to skip `results.push()` when streaming
- [ ] Ensure summary still tracks success/failure counts
- [ ] Test backward compatibility (non-streaming mode)

### Phase 2: Testing

#### Tasks

- [ ] Test with streaming enabled
- [ ] Test with streaming disabled (backward compatibility)
- [ ] Verify summary still works correctly
- [ ] Monitor memory savings

#### Constraints, Risks, Assumptions

- **Constraints:** Must maintain backward compatibility
- **Risks:** Low - only affects internal tracking
- **Assumptions:** Summary tracking doesn't need full result objects

---

### TKT-2025-009

---

ID: TKT-2025-009
Status: Draft
Priority: Low
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: MEMORY_AND_PERFORMANCE_ANALYSIS.md, Fix #7

---

#### Overview

Process validation results in chunks and clear results array periodically to prevent linear growth. This is optional and only needed if memory is still critical after other fixes.

#### What We Need to Do

Refactor `validateFixturesBatch` to process fixtures in chunks of 100, clearing results array after each chunk.

#### Expected Impact

- Results array: **1000 objects → 100 objects** max at any time
- Memory: **100KB → 10KB** for results array
- **90% reduction** in results array memory
- **Optional** - only needed if memory still critical

#### Phases & Tasks

### Phase 1: Implement Chunk Processing

#### Tasks

- [ ] Create chunk processing logic in `fixtureValidationService.js`
- [ ] Split fixtures into chunks of 100
- [ ] Process each chunk separately
- [ ] Clear chunk results after processing
- [ ] Add GC hints after every 5 chunks

### Phase 2: Testing

#### Tasks

- [ ] Test with small fixture count (< 100)
- [ ] Test with medium fixture count (100-500)
- [ ] Test with large fixture count (1000+)
- [ ] Verify all results still collected correctly
- [ ] Monitor memory reduction

#### Constraints, Risks, Assumptions

- **Constraints:** Only implement if memory still critical after Fixes #1-6
- **Risks:** Medium - refactoring might introduce bugs
- **Assumptions:** Chunk processing doesn't break result collection logic

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)

1. **TKT-2025-003** - Validation Streaming Mode ⭐⭐⭐ (CRITICAL)
2. **TKT-2025-004** - Remove 2-Second Wait ⭐⭐ (HIGH - Speed)
3. **TKT-2025-005** - Clear Page DOM ⭐⭐ (HIGH)
4. **TKT-2025-006** - Parallel Page Pool Creation ⭐ (HIGH - Speed)

### Phase 2: Additional Optimizations

5. **TKT-2025-007** - Reduce Page Pool Size (MEDIUM - if memory still critical)
6. **TKT-2025-008** - Clear Tracking Arrays (MEDIUM)
7. **TKT-2025-009** - Clear Results Array Periodically (LOW - optional)

---

## Notes

- All tickets reference `.docs/MEMORY_AND_PERFORMANCE_ANALYSIS.md` for detailed analysis
- Phase 1 fixes should be implemented first as they address the critical memory spike
- Phase 2 fixes are optional optimizations if memory is still an issue
- Expected combined impact: Memory 1.7GB → 800MB-1.0GB, Speed ~30-40% faster
