# Folder Overview

This folder contains data processing services including CRUD operations, data services, and processing tracking. These modules provide service-layer functionality for data processing operations.

## Files

- `CRUDoperations.js`: CRUD operations for data entities
- `dataService.js`: Data service layer functionality
- `processingTracker.js`: Tracks data processing progress and status
- `fixtureValidationService.js`: Validates fixture URLs for 404 errors
- `fixtureComparisonService.js`: Compares scraped fixtures with database fixtures
- `fixtureDeletionService.js`: Handles deletion of invalid or missing fixtures

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Data processing utilities

## Dependencies

- Internal: Data processing utilities
- External:
  - Winston (logging)
