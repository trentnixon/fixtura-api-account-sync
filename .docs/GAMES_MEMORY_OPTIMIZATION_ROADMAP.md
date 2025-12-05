# Games Memory Optimization - Roadmap

## Overview

This roadmap outlines the memory optimization strategy for games processing, addressing the critical memory blowout issue that was causing process failures on larger associations.

---

## Phase 1: Immediate Fixes ✅ COMPLETED

### 1.1 Streaming Assignment

**Status**: ✅ **COMPLETED**

**Objective**: Prevent fixture accumulation by assigning immediately after scraping.

**Changes**:

- Implemented streaming assignment in category isolation mode
- Implemented streaming assignment in standard processing mode
- Removed `allScrapedGameData` accumulation array
- Only track fixture IDs (minimal memory footprint)

**Impact**:

- Eliminates memory accumulation of thousands of fixtures
- Memory usage stays constant instead of growing linearly

**Files Modified**:

- `dataProcessing/processors/gameDataProcessor.js`

---

### 1.2 Reduced Batch Sizes

**Status**: ✅ **COMPLETED**

**Objective**: Reduce memory spikes by using smaller batches and sequential processing.

**Changes**:

- Reduced default batch size: `5` → `3`
- Reduced default concurrency: `2` → `1` (sequential)
- Made configurable via environment variables

**Impact**:

- Smaller memory footprint per batch
- No parallel memory spikes
- More predictable memory usage

**Configuration**:

```bash
GAME_DATA_BATCH_SIZE=3          # Default: 3
GAME_DATA_BATCH_CONCURRENCY=1  # Default: 1
```

---

### 1.3 Memory Cleanup

**Status**: ✅ **COMPLETED**

**Objective**: Prevent memory leaks by cleaning up resources between batches.

**Changes**:

- Page pool cleanup every 5 batches (standard mode)
- GC hints after every assignment batch
- Browser restart if memory is high (category isolation mode)

**Impact**:

- Prevents memory leaks from accumulating
- Helps free memory between batches

---

## Phase 2: Monitoring & Validation 🔄 IN PROGRESS

### 2.1 Memory Monitoring

**Status**: 🔄 **IN PROGRESS**

**Objective**: Monitor memory usage in production to validate fixes.

**Tasks**:

- [ ] Set up memory tracking for games processing
- [ ] Log memory stats at key stages
- [ ] Create alerts for memory thresholds
- [ ] Monitor memory patterns over time

**Metrics to Track**:

- Peak memory usage per association size
- Memory growth rate
- Memory cleanup effectiveness
- Process completion rate

---

### 2.2 Production Testing

**Status**: 🔄 **IN PROGRESS**

**Objective**: Validate fixes work in production environment.

**Test Scenarios**:

- [ ] Small association (< 100 teams)
- [ ] Medium association (100-500 teams)
- [ ] Large association (500-1000+ teams)
- [ ] Very large association (1000+ teams)

**Success Criteria**:

- Memory stays under 1.5GB
- Process completes without OOM errors
- No performance degradation

---

## Phase 3: Advanced Optimizations 📋 PLANNED

### 3.1 Adaptive Batch Sizing

**Status**: 📋 **PLANNED**

**Objective**: Dynamically adjust batch sizes based on memory pressure.

**Proposed Changes**:

- Monitor memory usage during processing
- Reduce batch size if memory is high
- Increase batch size if memory is low
- Use memory thresholds to trigger adjustments

**Implementation**:

```javascript
// Pseudo-code
if (memoryTracker.isMemoryHigh()) {
  batchSize = Math.max(1, Math.floor(batchSize * 0.7));
  batchConcurrency = 1;
} else if (memoryTracker.isMemoryLow()) {
  batchSize = Math.min(5, Math.floor(batchSize * 1.2));
  batchConcurrency = Math.min(2, batchConcurrency + 1);
}
```

**Benefits**:

- Optimal memory usage
- Better performance when memory allows
- Automatic adaptation to system resources

---

### 3.2 Page Pool Management

**Status**: 📋 **PLANNED**

**Objective**: Better management of Puppeteer page pool to reduce memory.

**Proposed Changes**:

- Limit page pool size based on memory
- Close unused pages more aggressively
- Restart browser more frequently if memory is high
- Monitor page pool memory usage

**Implementation**:

- Add page pool size limits
- Implement page pool cleanup strategy
- Add memory-aware page pool management

---

### 3.3 Browser Instance Management

**Status**: 📋 **PLANNED**

**Objective**: Better management of browser instances to reduce memory.

**Proposed Changes**:

- Restart browser more frequently
- Monitor browser memory usage
- Close browser between categories if memory is high
- Use browser memory limits

**Implementation**:

- Add browser restart triggers based on memory
- Monitor browser memory usage
- Implement browser lifecycle management

---

### 3.4 Data Structure Optimization

**Status**: 📋 **PLANNED**

**Objective**: Optimize data structures to reduce memory footprint.

**Proposed Changes**:

- Use more memory-efficient data structures
- Minimize object creation
- Reuse objects where possible
- Use streaming for large datasets

**Areas to Optimize**:

- Fixture data structures
- Team data structures
- Category mapping structures
- Batch result structures

---

## Phase 4: Performance Optimization 📋 FUTURE

### 4.1 Parallel Processing Optimization

**Status**: 📋 **FUTURE**

**Objective**: Optimize parallel processing to balance memory and performance.

**Proposed Changes**:

- Use worker threads for CPU-intensive tasks
- Implement better parallel processing strategies
- Optimize batch concurrency based on resources
- Use async/await more efficiently

---

### 4.2 Caching Strategy

**Status**: 📋 **FUTURE**

**Objective**: Implement caching to reduce redundant processing.

**Proposed Changes**:

- Cache scraped fixture data
- Cache team data
- Cache competition data
- Implement cache invalidation strategy

---

## Configuration Guide

### Environment Variables

#### Batch Configuration

```bash
# Batch size (default: 3)
GAME_DATA_BATCH_SIZE=3

# Batch concurrency (default: 1)
GAME_DATA_BATCH_CONCURRENCY=1

# Assignment batch size (default: 10)
GAME_DATA_ASSIGNMENT_BATCH_SIZE=10
```

#### Category Isolation

```bash
# Enable category isolation (default: false)
ISOLATE_BY_CATEGORY=true

# Test specific category
TEST_CATEGORY_ID=123
TEST_CATEGORY_NAME="Competition Name"
```

#### Memory Management

```bash
# Enable memory tracking (if available)
# Memory tracking is automatic if MemoryTracker is provided
```

---

## Performance Targets

### Memory Usage Targets

- **Small Association** (< 100 teams): < 500MB
- **Medium Association** (100-500 teams): < 1GB
- **Large Association** (500-1000 teams): < 1.5GB
- **Very Large Association** (1000+ teams): < 2GB

### Process Completion Targets

- **Success Rate**: > 99%
- **OOM Errors**: < 1%
- **Average Memory**: < 1GB

---

## Risk Assessment

### Low Risk ✅

- Streaming assignment (backward compatible)
- Reduced batch sizes (configurable)
- Memory cleanup (non-breaking)

### Medium Risk ⚠️

- Adaptive batch sizing (needs testing)
- Page pool management (needs validation)
- Browser instance management (needs monitoring)

### High Risk 🔴

- Major data structure changes (breaking changes)
- Parallel processing changes (performance impact)
- Caching strategy (complexity)

---

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Memory Usage**: Peak memory < 1.5GB for large associations
2. **Process Completion**: > 99% success rate
3. **OOM Errors**: < 1% failure rate
4. **Performance**: No significant performance degradation

### Monitoring Dashboard

- Real-time memory usage
- Process completion rate
- Error rate by association size
- Memory trends over time

---

## Timeline

### Phase 1: Immediate Fixes ✅

- **Start**: 2025-12-05
- **End**: 2025-12-05
- **Status**: COMPLETED

### Phase 2: Monitoring & Validation 🔄

- **Start**: 2025-12-05
- **End**: 2025-12-12 (estimated)
- **Status**: IN PROGRESS

### Phase 3: Advanced Optimizations 📋

- **Start**: 2025-12-12 (estimated)
- **End**: 2025-12-26 (estimated)
- **Status**: PLANNED

### Phase 4: Performance Optimization 📋

- **Start**: 2026-01-01 (estimated)
- **End**: TBD
- **Status**: FUTURE

---

## Dependencies

### External Dependencies

- Node.js memory management
- Puppeteer browser instances
- Strapi API performance
- System resources

### Internal Dependencies

- MemoryTracker service
- PuppeteerManager service
- ProcessingTracker service
- Logger service

---

## Related Documentation

- `.docs/GAMES_PROCESSING_ANALYSIS_AND_RECOMMENDATIONS.md`
- `.docs/GAMES_MEMORY_TEST_STAGES.md`
- `.docs/GAMES_MEMORY_OPTIMIZATION_TICKET.md`

---

## Notes

- All changes are backward compatible
- Environment variables allow fine-tuning
- Monitoring is critical for validation
- Future optimizations depend on production data

---

**Last Updated**: 2025-12-05
**Next Review**: 2025-12-12
