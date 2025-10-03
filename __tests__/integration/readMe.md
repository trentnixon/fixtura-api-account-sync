# Folder Overview

This folder contains integration tests for the scraper functionality. These tests run actual scrapers against known entities and validate the results against expected data to ensure scraping accuracy and detect website structure changes.

## Files

- `runAllTests.js`: **Complete integration test suite** ✅
- `cronScheduler.js`: **Integration test runner** (runs on startup) ✅
- `fixtures/`: Core test data fixtures (hardcodedTestEntities.js, testUrls.js)
- `helpers/`: Essential test utilities (TestLogger, TestResultsSaver, TestEnvironment, TestFetcher)
- `logs/`: Daily test execution logs
- `Tickets.md`: Detailed planning and tracking for integration tests
- `COMPLETION_SUMMARY.md`: Project completion summary
- `CLEANUP_SUMMARY.md`: Cleanup documentation
- `UNUSED_CODE_ANALYSIS.md`: Analysis of unused code and cleanup documentation

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Main scraper modules, Puppeteer, Jest
- Consumed by: CI/CD pipeline, development workflow

## Dependencies

- Internal:
  - `api/Puppeteer/` modules for scraping functionality
  - `dataProcessing/` modules for data processing
  - `src/utils/` for logging and utilities
- External:
  - Jest (testing framework)
  - Puppeteer (browser automation)
  - Supertest (HTTP testing)
  - Real websites for scraping validation

## Test Strategy

### Known Entities for Testing

- **Casey-Cardinia Cricket Association**: Association ID 427, 3 competitions
- **Dandenong District Cricket Association**: Association ID 0, 1 active competition
- **DDCA Senior Competition**: 10 teams, 82 games, active competition with real data

### Test Types

1. **✅ Data Accuracy Tests**: Validate scraped data matches expected results
2. **✅ Structure Validation**: Ensure data format and schema consistency
3. **✅ Regression Tests**: Detect website structure changes
4. **✅ Performance Tests**: Measure scraping speed and resource usage
5. **✅ CMS Read-Only Tests**: Ensure no production data writes during testing

### Test Execution

- **✅ Complete Integration Test Suite**: `node __tests__/integration/runAllTests.js`
- **✅ Real Website Testing**: Against live PlayHQ websites
- **✅ Data Validation**: 106 items scraped successfully (4 competitions + 20 teams + 82 games)
- **✅ Error Handling**: Robust failure management and recovery
- **✅ CMS Safety**: Read-only mode prevents production data writes
- **✅ Strapi Integration**: Automatic test result storage and reporting

### Current Status

**✅ PRODUCTION READY**: All integration tests working perfectly

- **Total Duration**: 71.8 seconds
- **Success Rate**: 100% (5/5 phases passed)
- **Items Scraped**: 106 total items
- **CMS Operations**: 20 read operations, 0 write operations
- **Strapi Integration**: Results saved to collection ID 14
