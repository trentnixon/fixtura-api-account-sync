# Folder Overview

This folder contains the core test data fixtures for integration testing. These fixtures provide stable test data and URLs for validating scraper accuracy without CMS dependencies.

## Files

- `hardcodedTestEntities.js`: Hardcoded club and association data with URLs
- `testUrls.js`: Direct URLs for scraping without CMS dependencies

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Integration test files
- Consumed by: `runAllTests.js` (main test runner)

## Dependencies

- Internal: None (self-contained test data)
- External: None (hardcoded test data)

## Test Data Strategy

### Known Entities

- **Casey-Cardinia Cricket Association (ID: 427)**: Test association with 3 competitions
- **Dandenong District Cricket Association (ID: 0)**: Test association with 1 active competition
- **DDCA Senior Competition**: Active competition with 10 teams and 82 games

### Hardcoded Test Entities (No CMS)

- **Complete entity data**: Names, IDs, URLs, expected data structures
- **Direct URLs**: Predefined URLs for scraping without CMS calls
- **Expected data**: Validated data structures for comparison
- **URL validation**: Pattern matching and structure validation

### Data Validation

- Expected data structures for each entity type
- URL pattern validation
- Data completeness checks
- Format validation (dates, URLs, IDs)

### Maintenance

- Update fixtures when website structure changes
- Keep URLs current and accessible
- Document any data discrepancies
- Regular validation against live data

## Usage Examples

### Hardcoded Entities

```javascript
const hardcodedEntities = require("./fixtures/hardcodedTestEntities");
const testUrls = require("./fixtures/testUrls");

// Access hardcoded entity data
const caseyCardinia = hardcodedEntities.associationCaseyCa;
const dandenong = hardcodedEntities.associationDandenong;

// Access test URLs
const associationUrl = testUrls.caseyCardiniaAssociation.main;
const clubUrl = testUrls.lynbrookClub.main;
```

### Direct URL Access

```javascript
// Get hardcoded URLs for scraping
const associationUrls = testUrls.caseyCardiniaAssociation;
const clubUrls = testUrls.lynbrookClub;
```

## Architecture

The fixture system uses a **simplified approach**:

- **Hardcoded entities** instead of complex fixture builders
- **Direct URLs** instead of CMS-dependent data
- **Self-contained data** for reliable testing
- **Minimal dependencies** for maximum reliability
