# Folder Overview

This folder contains modular components for fixture validation processing. These components were extracted from `fixtureValidationProcessor.js` to improve maintainability, testability, and code organization.

## Files

- `memoryTracker.js`: Memory tracking and logging utilities for monitoring memory usage during validation
- `resultAggregator.js`: Handles aggregation of validation results, storing only invalid fixtures to minimize memory usage
- `fixtureProcessor.js`: Manages fetching and processing fixtures page by page with memory optimization
- `validationHelpers.js`: Utility functions for common validation tasks (team ID extraction, logging, etc.)

## Relations

- **Parent folder**: [`../../readMe.md`](../../readMe.md)
- **Consumed by**: `../../fixtureValidationProcessor.js` (main processor class)
- **Key dependencies**:
  - `../../../puppeteer/memoryUtils` (for memory statistics)
  - `../../../src/utils/logger` (for logging)
  - `../../assignCenter/games/GameCrud` (via fixtureProcessor)
  - `../../services/fixtureValidationService` (via fixtureProcessor)

## Component Relationships

### Flow Diagram

```
fixtureValidationProcessor.js (Main)
    │
    ├── MemoryTracker (Static utilities)
    │   ├── logInitialMemory() ──┐
    │   ├── logPageMemory()       │── Used throughout process
    │   └── logFinalMemory() ───┘
    │
    ├── ValidationHelpers (Static utilities)
    │   ├── getTeamIds() ──────────── Used at start
    │   ├── logValidationSummary() ─── Used at end
    │   ├── logReturnSummary() ────── Used at end
    │   └── createEmptyResult() ────── Used for empty cases
    │
    ├── FixtureProcessor (Instance)
    │   ├── calculateDateRange() ───── Used once at start
    │   ├── fetchPage() ────────────── Called in loop
    │   ├── validatePage() ──────────── Called in loop
    │   ├── clearPageData() ─────────── Called in loop
    │   └── hintGarbageCollection() ── Called periodically in loop
    │
    └── ResultAggregator (Instance)
        ├── processPageResults() ───── Called in loop
        ├── getResults() ────────────── Called once at end
        ├── getFixturesArray() ──────── Called once at end
        └── getStats() ──────────────── Called for logging
```

### Component Responsibilities

#### MemoryTracker
- **Purpose**: Centralized memory tracking and logging
- **Type**: Static utility class (no instance needed)
- **Key Methods**:
  - `getMemoryStats()`: Retrieves current memory statistics
  - `logInitialMemory()`: Logs memory state at process start
  - `logPageMemory()`: Logs memory after each page processing
  - `logFinalMemory()`: Logs final memory state with deltas
- **Memory Impact**: None (only reads and logs)

#### ResultAggregator
- **Purpose**: Accumulates validation results, storing only invalid fixtures
- **Type**: Instance class (maintains state across pages)
- **Key Methods**:
  - `processPageResults()`: Processes page results, stores only invalid fixtures
  - `getResults()`: Returns all aggregated results
  - `getFixturesArray()`: Returns fixtures array for comparison service
  - `getStats()`: Returns statistics for logging
- **Memory Impact**: Stores only invalid fixtures (typically <10% of total)
- **Memory Optimization**: Uses `Set` and `Map` for efficient storage, only stores invalid fixtures

#### FixtureProcessor
- **Purpose**: Handles fetching and processing fixtures page by page
- **Type**: Instance class (uses injected dependencies)
- **Dependencies**: `GameCRUD`, `FixtureValidationService`, `concurrencyLimit`
- **Key Methods**:
  - `calculateDateRange()`: Calculates date range (today to +14 days)
  - `fetchPage()`: Fetches one page of fixtures from API
  - `validatePage()`: Validates fixtures using Puppeteer
  - `clearPageData()`: Clears arrays to free memory
  - `hintGarbageCollection()`: Hints GC every 3 pages
- **Memory Impact**: Processes 25 fixtures per page, clears immediately after

#### ValidationHelpers
- **Purpose**: Utility functions for common validation tasks
- **Type**: Static utility class (no instance needed)
- **Key Methods**:
  - `getTeamIds()`: Extracts team IDs from dataObj
  - `logValidationSummary()`: Logs summary of invalid fixtures
  - `logReturnSummary()`: Logs return summary
  - `createEmptyResult()`: Creates empty result object
- **Memory Impact**: None (pure utility functions)

## Processing Flow

1. **Initialization** (`fixtureValidationProcessor.process()`)
   - `MemoryTracker.logInitialMemory()` - Log initial memory state
   - `ValidationHelpers.getTeamIds()` - Extract team IDs
   - Create `FixtureProcessor` instance
   - Create `ResultAggregator` instance
   - `FixtureProcessor.calculateDateRange()` - Calculate date range

2. **Page Processing Loop** (repeats for each page)
   - `FixtureProcessor.fetchPage()` - Fetch page of fixtures
   - `FixtureProcessor.validatePage()` - Validate fixtures
   - `ResultAggregator.processPageResults()` - Store invalid fixtures only
   - `FixtureProcessor.clearPageData()` - Clear arrays
   - `FixtureProcessor.hintGarbageCollection()` - Hint GC every 3 pages
   - `MemoryTracker.logPageMemory()` - Log memory after page

3. **Finalization**
   - `ResultAggregator.getResults()` - Get aggregated results
   - `ValidationHelpers.logValidationSummary()` - Log summary
   - `ResultAggregator.getFixturesArray()` - Get fixtures for comparison
   - `MemoryTracker.logFinalMemory()` - Log final memory state
   - `ValidationHelpers.logReturnSummary()` - Log return summary

## Memory Optimization Strategy

### Key Optimizations

1. **Only Store Invalid Fixtures**
   - `ResultAggregator` only stores fixtures that failed validation
   - For 10,000 fixtures with 90% valid: stores only ~1,000 invalid fixtures
   - **Memory Savings**: ~90% reduction

2. **Small Page Size**
   - Processes 25 fixtures per page (reduced from 100)
   - Prevents memory spikes from large batches
   - **Memory Savings**: 4x reduction per batch

3. **Immediate Cleanup**
   - `FixtureProcessor.clearPageData()` clears arrays immediately after processing
   - GC hints every 3 pages to encourage garbage collection
   - **Memory Savings**: Prevents accumulation

4. **Minimal Data Storage**
   - Stores only `{ id, gameID }` for invalid fixtures
   - No full fixture objects stored
   - **Memory Savings**: ~95% reduction per fixture

### Memory Flow

```
Initial Memory: ~200MB
    ↓
Page 1 (25 fixtures): +50MB → Process → Clear → ~250MB
    ↓
Page 2 (25 fixtures): +50MB → Process → Clear → ~250MB
    ↓
... (repeats for each page)
    ↓
Final Memory: ~250MB + (invalid fixtures only)
    ↓
Only ~1,000 invalid fixtures stored = ~20MB
    ↓
Total: ~270MB (vs 2GB+ before optimization)
```

## Dependencies

### Internal Dependencies
- `../../../puppeteer/memoryUtils`: Memory statistics utilities
- `../../../src/utils/logger`: Logging utilities
- `../../assignCenter/games/GameCRud`: Fixture fetching (via FixtureProcessor)
- `../../services/fixtureValidationService`: Fixture validation (via FixtureProcessor)

### External Dependencies
- None (all dependencies are internal to the application)

## Usage Example

```javascript
// In fixtureValidationProcessor.js
const MemoryTracker = require("./components/validation/memoryTracker");
const ResultAggregator = require("./components/validation/resultAggregator");
const FixtureProcessor = require("./components/validation/fixtureProcessor");
const ValidationHelpers = require("./components/validation/validationHelpers");

async process() {
  // Initialize
  const initialMemory = MemoryTracker.logInitialMemory(this.dataObj);
  const teamIds = ValidationHelpers.getTeamIds(this.dataObj);

  const fixtureProcessor = new FixtureProcessor(
    this.gameCRUD,
    this.validationService,
    this.concurrencyLimit
  );
  const resultAggregator = new ResultAggregator();

  // Process pages
  while (hasMore) {
    const { pageFixtures } = await fixtureProcessor.fetchPage(...);
    const results = await fixtureProcessor.validatePage(pageFixtures, page);
    resultAggregator.processPageResults(results, pageFixtures);
    fixtureProcessor.clearPageData(pageFixtures, results);
    MemoryTracker.logPageMemory(page, initialMemory, resultAggregator.getStats());
  }

  // Finalize
  const { invalidResults } = resultAggregator.getResults();
  MemoryTracker.logFinalMemory(initialMemory, stats);
  return { results: invalidResults, fixtures: resultAggregator.getFixturesArray() };
}
```

## Testing Considerations

Each component can be tested independently:

- **MemoryTracker**: Test memory logging functions with mock memory stats
- **ResultAggregator**: Test result aggregation logic with sample validation results
- **FixtureProcessor**: Test page fetching and validation with mocked dependencies
- **ValidationHelpers**: Test utility functions with various input scenarios

## Notes

- All components follow single responsibility principle
- Memory optimizations are critical for large associations (10,000+ fixtures)
- Components are stateless where possible (MemoryTracker, ValidationHelpers)
- Stateful components (ResultAggregator, FixtureProcessor) maintain minimal state
- All memory optimizations are documented in code comments

