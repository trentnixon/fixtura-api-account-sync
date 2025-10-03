# Folder Overview

This folder contains the core test helper utilities for integration testing. These helpers provide essential functionality for test execution, logging, and CMS safety.

## Files

- `TestLogger.js`: Detailed step-by-step logging and reporting system
- `TestResultsSaver.js`: Strapi integration for saving test results
- `TestEnvironment.js`: Read-only CMS mode setup and management
- `TestFetcher.js`: CMS operation wrapper with read-only enforcement

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Production scrapers, Strapi CMS
- Consumed by: `runAllTests.js` (main test runner)

## Dependencies

- Internal: Production scraper modules, Strapi CMS
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
  - Strapi API (result storage)

## Core Functions

### Test Logging (`TestLogger.js`)

- Detailed step-by-step test execution logging
- Performance metrics and timing
- Error tracking and reporting
- Comprehensive test reports

### CMS Safety (`TestEnvironment.js` + `TestFetcher.js`)

- Read-only mode enforcement
- CMS operation logging and validation
- Production-safe test environment
- Mock response handling

### Result Storage (`TestResultsSaver.js`)

- Strapi integration for test results
- Automatic test result saving
- Test metadata and performance tracking
- Historical test result storage

## Architecture

The helper system uses a **simplified architecture**:

- **Direct scraper usage** instead of complex wrappers
- **TestFetcher for CMS mocking** instead of multiple mock classes
- **Production services** instead of mocked versions
- **Hardcoded test data** instead of complex fixture builders
