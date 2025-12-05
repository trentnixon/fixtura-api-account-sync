# GAMES Stage Performance Optimization Plan

**Current Issue**: Processing takes 2 hours (should be ~30 minutes)
**Date**: 2025-01-XX
**Status**: Planning Phase

---

## 🔍 Root Cause Analysis

### Current Bottleneck: Sequential API Calls

**Problem Flow**:
```
100 teams × 5 fixtures × 3 API calls = 1,500 sequential API calls
├─ API call 1: getTeamsIds() per fixture
├─ API call 2: checkIfGameExists() per fixture
└─ API call 3: createGame() or updateGame() per fixture
```

**Time Breakdown** (estimated):
- Scraping: ~10-15 minutes (parallel, concurrency=2)
- API calls: ~75-90 minutes (sequential, blocking)
- **Total: ~85-105 minutes** (matches observed 2 hours)

### Key Issues Identified

1. **Per-team assignment forced ON** (`|| true` hardcoded)
   - Location: `gameDataProcessor.js` lines 223, 707, 815
   - Impact: Makes API calls immediately after each team scrapes
   - Result: Blocks parallel processing

2. **Sequential API calls within batches**
   - Location: `assignGameData.js` line 39 (`for (const game of batch)`)
   - Impact: Even batched fixtures processed one-by-one
   - Result: No parallelization of API calls

3. **Low concurrency for teams**
   - Current: `PARALLEL_TEAMS_CONCURRENCY = 2`
   - Impact: Only 2 teams scrape in parallel
   - Result: Underutilized resources

4. **Triple nested loops**
   - Teams loop → Fixtures loop → API calls loop
   - All sequential, no parallelization

---

## 🎯 Optimization Strategy

### Phase 1: Disable Per-Team Assignment (CRITICAL - Immediate Impact)

**Goal**: Accumulate fixtures and assign in larger batches

**Changes Required**:
1. Remove `|| true` from `gameDataProcessor.js` lines 223, 707, 815
2. Change default to `false` (only enable if explicitly set)
3. Let fixtures accumulate during scraping phase
4. Assign all fixtures in larger batches after scraping completes

**Expected Impact**:
- **Reduces API calls from 1,500 to ~15-30 batches**
- **Time savings: 60-75 minutes**
- **New total: ~20-30 minutes**

**Files to Modify**:
- `dataProcessing/processors/gameDataProcessor.js` (3 locations)
- `dataProcessing/scrapeCenter/GameData/getGameData.js` (1 location)

**Risk**: Low - Code already handles batch assignment path

---

### Phase 2: Parallelize API Calls in Assignment (HIGH Impact)

**Goal**: Process multiple fixtures simultaneously during assignment

**Changes Required**:
1. Modify `assignGameData.js` → `processBatch()` method
2. Use `processInParallel()` utility to process fixtures concurrently
3. Add concurrency limit (e.g., 5-10 concurrent API calls)
4. Batch team ID lookups (if API supports it)

**Expected Impact**:
- **Reduces assignment time by 70-80%**
- **Time savings: 15-20 minutes**
- **New total: ~15-20 minutes**

**Files to Modify**:
- `dataProcessing/assignCenter/assignGameData.js`
- `dataProcessing/assignCenter/games/GameCrud.js` (if batch endpoints exist)

**Risk**: Medium - Need to ensure API can handle concurrent requests

**Implementation Approach**:
```javascript
// Instead of:
for (const game of batch) {
  await processGame(game); // Sequential
}

// Use:
await processInParallel(batch, async (game) => {
  await processGame(game);
}, 5); // 5 concurrent API calls
```

---

### Phase 3: Increase Team Concurrency (MEDIUM Impact)

**Goal**: Process more teams in parallel during scraping

**Changes Required**:
1. Increase `PARALLEL_TEAMS_CONCURRENCY` from 2 to 4-5
2. Ensure page pool size matches new concurrency
3. Monitor memory usage (may need adjustment)

**Expected Impact**:
- **Reduces scraping time by 40-50%**
- **Time savings: 5-7 minutes**
- **New total: ~10-15 minutes**

**Files to Modify**:
- `dataProcessing/puppeteer/constants.js`
- Environment variable: `PARALLEL_TEAMS_CONCURRENCY=4`

**Risk**: Medium - May increase memory usage, need to monitor

**Note**: Only increase if memory allows (currently optimized for 2GB server)

---

### Phase 4: Batch Team ID Lookups (OPTIONAL - If API Supports)

**Goal**: Reduce API calls by batching team ID lookups

**Changes Required**:
1. Collect all unique team IDs from fixtures first
2. Make single batch API call to get all team IDs
3. Create lookup map for fixture processing
4. Use map during fixture assignment

**Expected Impact**:
- **Reduces API calls by ~50%** (if many fixtures share teams)
- **Time savings: 5-10 minutes** (depends on team overlap)

**Files to Modify**:
- `dataProcessing/assignCenter/games/GameCrud.js`
- `dataProcessing/assignCenter/assignGameData.js`

**Risk**: High - Requires API endpoint support for batch lookups

**Prerequisite**: Verify API supports batch team ID lookup endpoint

---

## 📊 Expected Results

### Current Performance
- **Time**: ~120 minutes (2 hours)
- **API Calls**: 1,500 sequential
- **Concurrency**: 2 teams parallel

### After Phase 1 (Disable Per-Team Assignment)
- **Time**: ~25-35 minutes
- **API Calls**: ~30 batches (sequential)
- **Concurrency**: 2 teams parallel
- **Improvement**: **70-75% faster**

### After Phase 2 (Parallelize API Calls)
- **Time**: ~15-20 minutes
- **API Calls**: ~30 batches (5 concurrent)
- **Concurrency**: 2 teams parallel
- **Improvement**: **85-90% faster**

### After Phase 3 (Increase Concurrency)
- **Time**: ~10-15 minutes
- **API Calls**: ~30 batches (5 concurrent)
- **Concurrency**: 4-5 teams parallel
- **Improvement**: **90-95% faster**

### Target Performance
- **Time**: ~10-15 minutes (down from 120 minutes)
- **Improvement**: **90-95% reduction**
- **Status**: ✅ Meets 30-minute target

---

## 🚀 Implementation Priority

### Priority 1: CRITICAL (Do First)
1. ✅ **Phase 1: Disable Per-Team Assignment**
   - Impact: 70-75% improvement
   - Risk: Low
   - Effort: 15 minutes
   - **DO THIS FIRST**

### Priority 2: HIGH (Do Second)
2. ✅ **Phase 2: Parallelize API Calls**
   - Impact: Additional 15-20% improvement
   - Risk: Medium
   - Effort: 1-2 hours
   - **DO THIS SECOND**

### Priority 3: MEDIUM (Do Third)
3. ⚠️ **Phase 3: Increase Concurrency**
   - Impact: Additional 5-10% improvement
   - Risk: Medium (memory)
   - Effort: 30 minutes
   - **DO THIS THIRD** (if memory allows)

### Priority 4: OPTIONAL (Do Last)
4. ⚠️ **Phase 4: Batch Team ID Lookups**
   - Impact: Additional 5-10% improvement
   - Risk: High (API dependency)
   - Effort: 2-3 hours
   - **ONLY IF API SUPPORTS IT**

---

## 📝 Implementation Checklist

### Phase 1: Disable Per-Team Assignment
- [ ] Remove `|| true` from `gameDataProcessor.js` line 223
- [ ] Remove `|| true` from `gameDataProcessor.js` line 707
- [ ] Remove `|| true` from `gameDataProcessor.js` line 815
- [ ] Update `getGameData.js` line 21 to default to `false`
- [ ] Test with small account (10-20 teams)
- [ ] Verify fixtures accumulate correctly
- [ ] Verify batch assignment works
- [ ] Test with medium account (50-100 teams)
- [ ] Monitor memory usage
- [ ] Measure performance improvement

### Phase 2: Parallelize API Calls
- [ ] Review `processInParallel` utility capabilities
- [ ] Modify `assignGameData.js` → `processBatch()` method
- [ ] Add concurrency parameter (start with 3, test, increase)
- [ ] Test API rate limits (ensure no throttling)
- [ ] Test with small batch (10 fixtures)
- [ ] Test with medium batch (50 fixtures)
- [ ] Test with large batch (100+ fixtures)
- [ ] Monitor API response times
- [ ] Monitor error rates
- [ ] Measure performance improvement

### Phase 3: Increase Concurrency
- [ ] Check current memory usage during processing
- [ ] Increase `PARALLEL_TEAMS_CONCURRENCY` to 4
- [ ] Update page pool size to match
- [ ] Test with small account
- [ ] Monitor memory spikes
- [ ] Test with medium account
- [ ] If stable, increase to 5
- [ ] Measure performance improvement

### Phase 4: Batch Team ID Lookups (Optional)
- [ ] Check if API has batch team lookup endpoint
- [ ] If yes, implement batch lookup
- [ ] Create team ID map
- [ ] Update fixture processing to use map
- [ ] Test and measure improvement

---

## ⚠️ Risks & Mitigation

### Risk 1: Memory Increase
**Mitigation**:
- Monitor memory after Phase 1
- Only proceed with Phase 3 if memory allows
- Keep batch sizes reasonable

### Risk 2: API Rate Limiting
**Mitigation**:
- Start with low concurrency (3-5)
- Monitor API response times
- Implement backoff if throttling detected

### Risk 3: Race Conditions
**Mitigation**:
- Use existing `processInParallel` utility (already tested)
- Ensure API handles concurrent requests correctly
- Test thoroughly before production

---

## 📈 Success Metrics

### Primary Metric
- **Target**: Process account in ≤30 minutes
- **Current**: ~120 minutes
- **After Phase 1**: ~25-35 minutes ✅
- **After Phase 2**: ~15-20 minutes ✅✅
- **After Phase 3**: ~10-15 minutes ✅✅✅

### Secondary Metrics
- API call count reduction: 1,500 → ~30 batches
- Memory usage: Monitor for increases
- Error rate: Should remain <1%
- Success rate: Should remain >99%

---

## 🔄 Rollback Plan

If issues occur:
1. **Phase 1 Rollback**: Re-add `|| true` to restore per-team assignment
2. **Phase 2 Rollback**: Remove parallelization, restore sequential processing
3. **Phase 3 Rollback**: Reduce concurrency back to 2

All changes are reversible via environment variables or code revert.

---

## 📚 Related Documentation

- `.docs/GAMES_MEMORY_OPTIMIZATION_PLAN.md` - Memory optimization context
- `.docs/GAMES_PROCESSING_ANALYSIS_AND_RECOMMENDATIONS.md` - Current architecture
- `dataProcessing/puppeteer/constants.js` - Concurrency configuration

---

**Next Steps**: Start with Phase 1 (disable per-team assignment) for immediate 70-75% improvement.

