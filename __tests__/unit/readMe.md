# Unit Tests for Parallel Processing

This directory contains unit tests for the parallel processing functionality implemented in Phase 1 of the performance optimization project.

## Test Files

### `testPagePool.js`
Tests the page pool functionality in `PuppeteerManager`:
- Creating page pools with different sizes
- Page allocation (round-robin)
- Page release and reuse
- Pool exhaustion handling
- Proxy authentication on pool pages

**Usage:**
```bash
node __tests__/unit/testPagePool.js
```

### `testParallelUtils.js`
Tests the parallel processing utilities:
- Basic parallel processing
- Error handling (some items fail)
- Empty array handling
- Single item handling
- Concurrency limit enforcement
- Success-only wrapper
- Batch processing
- Timing information

**Usage:**
```bash
node __tests__/unit/testParallelUtils.js
```

### `runUnitTests.js`
Test runner that executes all unit tests or specific tests.

**Usage:**
```bash
# Run all tests
node __tests__/unit/runUnitTests.js all

# Run specific test
node __tests__/unit/runUnitTests.js pagepool
node __tests__/unit/runUnitTests.js parallelutils
```

## Running Tests

### Run All Unit Tests
```bash
node __tests__/unit/runUnitTests.js
```

### Run Individual Tests
```bash
node __tests__/unit/testPagePool.js
node __tests__/unit/testParallelUtils.js
```

## Test Coverage

### Phase 7.1: Unit Testing Tasks

- [x] Test `createPagePool()` method
  - [x] Test with different pool sizes (1, 3, 5)
  - [x] Test error handling (page creation failure)
  - [x] Test proxy authentication for all pages
- [x] Test `processInParallel()` utility
  - [x] Test with various concurrency levels
  - [x] Test error handling (some items fail)
  - [x] Test with empty arrays, single items
- [x] Test page pool rotation
  - [x] Verify pages are distributed correctly
  - [x] Test pool exhaustion scenarios

## Expected Results

All tests should pass. Each test file provides detailed output showing:
- Individual test results (✅ PASS / ❌ FAIL)
- Test summary with pass/fail counts
- Success rate percentage

## Dependencies

- `dotenv` - Environment variable loading
- `PuppeteerManager` - Page pool functionality
- `parallelUtils` - Parallel processing utilities
- `logger` - Logging utilities

## Notes

- Tests require a valid `.env` file with proxy configuration
- Tests will create and dispose of browser instances
- Some tests may take a few seconds to complete (simulated delays)

