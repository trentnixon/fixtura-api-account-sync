# Integration Testing Guide

This guide explains how to run the integration tests for parallel processing functionality.

## Available Tests

### 1. Parallel Competitions Processing

Tests parallel processing of competitions across multiple associations.

**Test File:** `__tests__/testParallelCompetitions.js`

**Usage:**

```bash
# Test with a club (parallel processing across multiple associations)
node __tests__/testParallelCompetitions.js <clubId> club

# Test with a single association (sequential processing)
node __tests__/testParallelCompetitions.js <associationId> association
```

**Examples:**

```bash
# Test club with multiple associations (parallel)
node __tests__/testParallelCompetitions.js 27988 club

# Test single association (sequential)
node __tests__/testParallelCompetitions.js 2760 association
```

**What it tests:**

- Parallel processing of multiple associations
- Page pool allocation and release
- Performance improvement (speedup calculation)
- Memory usage tracking
- Competition data accuracy

---

### 2. Parallel Game Data Processing

Tests parallel processing of game data across multiple teams.

**Test File:** `__tests__/integration/testParallelGameData.js`

**Usage:**

```bash
node __tests__/integration/testParallelGameData.js <clubId>
```

**Example:**

```bash
# Test with club ID 27958 (should have teams)
node __tests__/integration/testParallelGameData.js 27958
```

**What it tests:**

- Parallel processing of multiple teams
- Page pool allocation and release
- Performance improvement (speedup calculation)
- Memory usage tracking
- Game data accuracy

**Requirements:**

- Club must have teams associated with it
- Teams must have valid URLs

---

### 3. Parallel Fixture Validation

Tests parallel validation of fixture URLs.

**Test File:** `__tests__/integration/testParallelFixtureValidation.js`

**Usage:**

```bash
node __tests__/integration/testParallelFixtureValidation.js [count]
```

**Examples:**

```bash
# Test with 10 fixtures (default)
node __tests__/integration/testParallelFixtureValidation.js

# Test with 20 fixtures
node __tests__/integration/testParallelFixtureValidation.js 20

# Test with 5 fixtures
node __tests__/integration/testParallelFixtureValidation.js 5
```

**What it tests:**

- Parallel validation of multiple fixtures
- Page pool allocation and release
- Performance improvement (speedup calculation)
- Memory usage tracking
- Validation accuracy

**Note:** Uses mock/test fixture URLs. Real fixtures would need to be fetched from the database.

---

## Using the Test Runner

The test runner provides a convenient way to run integration tests:

**Test Runner:** `__tests__/integration/runIntegrationTests.js`

**Usage:**

```bash
# Show usage information
node __tests__/integration/runIntegrationTests.js

# Run competitions test
node __tests__/integration/runIntegrationTests.js competitions <clubId> [type]

# Run game data test
node __tests__/integration/runIntegrationTests.js gamedata <clubId>

# Run validation test
node __tests__/integration/runIntegrationTests.js validation [count]
```

**Examples:**

```bash
# Run competitions test (club mode)
node __tests__/integration/runIntegrationTests.js competitions 27988 club

# Run competitions test (association mode)
node __tests__/integration/runIntegrationTests.js competitions 2760 association

# Run game data test
node __tests__/integration/runIntegrationTests.js gamedata 27958

# Run validation test (10 fixtures)
node __tests__/integration/runIntegrationTests.js validation 10
```

---

## Test Output

All tests provide detailed output including:

1. **Configuration Display**

   - Concurrency settings
   - Page pool size
   - Number of items to process

2. **Processing Results**

   - Total items processed
   - Success/failure counts
   - Sample results

3. **Performance Analysis**

   - Estimated sequential time
   - Actual parallel time
   - Speedup factor (e.g., 3x faster)
   - Time saved

4. **Memory Usage**

   - RSS memory
   - Heap memory
   - Operation count

5. **Test Summary**
   - Pass/fail status
   - Cleanup confirmation

---

## Prerequisites

Before running tests, ensure:

1. **Environment Variables** are set in `.env`:

   ```bash
   FIXTURA_TOKEN=your_token_here
   NODE_ENV=development
   # Optional: Configure parallel processing
   PARALLEL_PAGE_POOL_SIZE=3
   PARALLEL_COMPETITIONS_CONCURRENCY=3
   PARALLEL_TEAMS_CONCURRENCY=3
   PARALLEL_VALIDATION_CONCURRENCY=5
   ```

2. **API Server** is running (for fetching club/association data)

3. **Proxy Configuration** is set (if using proxies)

4. **Valid IDs** are available:
   - Club IDs with associations (for competitions test)
   - Club IDs with teams (for game data test)

---

## Finding Test IDs

### Finding a Club ID with Multiple Associations

```bash
# Use the helper script
node __tests__/findClubWithAssociation.js <associationId>

# Example: Find a club that includes association 2760
node __tests__/findClubWithAssociation.js 2760
```

### Finding a Club ID with Teams

- Check your database/API for clubs that have teams
- Or use a known club ID from your system

---

## Troubleshooting

### Test Fails with "Club not found"

- Verify the club ID exists in your database
- Check API connection and credentials

### Test Fails with "No associations/teams found"

- The club may not have the required data
- Try a different club ID

### Test Shows 1.00x Speedup

- This is expected for single association/team tests
- Parallel processing only shows speedup with multiple items
- Use a club with multiple associations/teams to see real speedup

### Memory Warnings

- Normal for parallel processing (uses more memory)
- Monitor RSS and heap usage
- Adjust `PARALLEL_PAGE_POOL_SIZE` if memory is constrained

### Proxy Errors

- Check proxy configuration in `.env`
- Verify proxy credentials are correct
- Some tests may work without proxy (set `usePuppeteer: false` in test)

---

## Expected Results

### Successful Test Run

- ✅ All items processed successfully
- ✅ Speedup > 1.0x (for multiple items)
- ✅ Memory usage within reasonable limits
- ✅ No errors in processing
- ✅ Cleanup completed successfully

### Performance Expectations

- **3x speedup** with 3 concurrent items (default)
- **5x speedup** with 5 concurrent items (if configured)
- Speedup may vary based on:
  - Network conditions
  - Proxy performance
  - Page load times
  - Server resources

---

## Next Steps

After running integration tests:

1. **Review Performance**: Check if speedup meets expectations
2. **Adjust Configuration**: Tune concurrency levels if needed
3. **Monitor Memory**: Ensure memory usage is acceptable
4. **Test in Production**: Run with real production data
5. **Move to Phase 7.3**: Performance testing with different concurrency levels
