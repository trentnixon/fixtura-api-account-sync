# Validation Endpoint Specification

**Purpose:** Create a lightweight API endpoint specifically for fixture validation that returns only minimal required data, enabling incremental processing and reducing memory usage.

---

## Context: What We're Doing

### Current Problem

**Validation Process:**
1. Fetch ALL fixtures from database (via existing endpoint)
2. Accumulate ALL fixtures in memory (~5-10KB per fixture with populated teams)
3. Process ALL fixtures through validation (Puppeteer URL checks)
4. Memory spike: 1000 fixtures × 5KB = **5-10MB** of unnecessary data

**Memory Impact:**
- Current endpoint returns full fixture objects with populated `teams` relationships
- We only need 3 fields: `id`, `gameID`, `urlToScoreCard`
- **95-98% of fetched data is unused** during validation
- All fixtures accumulate in memory before validation starts

### Goal

Create a dedicated endpoint that:
- Returns **only** the 3 fields needed for validation
- Supports **batching/pagination** to process incrementally
- Reduces memory usage by **95-98%**
- Enables incremental processing (fetch → validate → clear → repeat)

---

## Endpoint Specification

### Endpoint Details

**Route:** `/api/fixtures/validation` (or similar)
**Method:** `GET`
**Purpose:** Fetch fixtures for validation with minimal data and batching support

---

## Request Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `teamIds` | `number[]` | Array of team database IDs | `[1, 2, 3, 4, 5]` |
| `fromDate` | `string` (ISO 8601) | Start date (inclusive) | `"2025-12-03T00:00:00.000Z"` |
| `toDate` | `string` (ISO 8601) | End date (inclusive) | `"2025-12-17T23:59:59.999Z"` |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number for pagination |
| `pageSize` | `number` | `100` | Number of fixtures per page |
| `sportType` | `string` | (required) | Sport type filter (Cricket, Hockey, AFL, Netball, Basketball) |

---

## Response Format

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 12345,
      "gameID": "game-abc-123",
      "urlToScoreCard": "/game-centre/12345/scorecard"
    },
    {
      "id": 12346,
      "gameID": "game-def-456",
      "urlToScoreCard": "/game-centre/12346/scorecard"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 100,
      "pageCount": 5,
      "total": 450
    },
    "filters": {
      "teamIds": [1, 2, 3, 4, 5],
      "fromDate": "2025-12-03T00:00:00.000Z",
      "toDate": "2025-12-17T23:59:59.999Z",
      "sportType": "Cricket"
    }
  }
}
```

### Response Fields

**Data Array Items:**
- `id` (number, required): Fixture database ID
- `gameID` (string, required): Unique game identifier
- `urlToScoreCard` (string, nullable): URL path to scorecard (relative or absolute)

**Meta Object:**
- `pagination.page` (number): Current page number
- `pagination.pageSize` (number): Items per page
- `pagination.pageCount` (number): Total number of pages
- `pagination.total` (number): Total fixtures matching filters

---

## Query Examples

### Example 1: Basic Request (First Page)

```
GET /api/fixtures/validation?teamIds[]=1&teamIds[]=2&teamIds[]=3&fromDate=2025-12-03T00:00:00.000Z&toDate=2025-12-17T23:59:59.999Z&sportType=Cricket&page=1&pageSize=100
```

### Example 2: Paginated Request (Page 2)

```
GET /api/fixtures/validation?teamIds[]=1&teamIds[]=2&teamIds[]=3&fromDate=2025-12-03T00:00:00.000Z&toDate=2025-12-17T23:59:59.999Z&sportType=Cricket&page=2&pageSize=100
```

### Example 3: Small Batch (For Testing)

```
GET /api/fixtures/validation?teamIds[]=1&fromDate=2025-12-03T00:00:00.000Z&toDate=2025-12-17T23:59:59.999Z&sportType=Cricket&page=1&pageSize=10
```

---

## Filtering Logic

### Date Range Filter
- Only return fixtures where `dayOne >= fromDate AND dayOne <= toDate`
- Default range: Today to Today + 14 days

### Team Filter
- Only return fixtures where `teams.id IN [teamIds]`
- Support multiple team IDs (array)

### Sport Type Filter
- Filter by sport type to use correct endpoint:
  - Cricket → `game-meta-datas`
  - Hockey → `game-data-hockeys`
  - AFL → `game-data-afls`
  - Netball → `game-data-netballs`
  - Basketball → `game-data-basketballs`

---

## Data Requirements

### Fields to Return (ONLY these 3)

1. **`id`** (number)
   - Database fixture ID
   - Used for tracking and result storage

2. **`gameID`** (string)
   - Unique game identifier
   - Used for tracking and comparison

3. **`urlToScoreCard`** (string, nullable)
   - URL path to scorecard page
   - Can be relative (`/game-centre/12345/scorecard`) or absolute (`https://www.playhq.com/...`)
   - Used to navigate to page for validation
   - Can be `null` if no URL exists

### Fields to EXCLUDE

**Do NOT return:**
- `teams` (populated relationship)
- `attributes` (full object)
- `dayOne`, `date`, `round`, `status`
- `teamHome`, `teamAway`, `ground`, `time`
- Any other fixture properties

**Reason:** We only validate URLs, we don't need any other fixture data.

---

## Pagination Requirements

### Why Pagination is Critical

**Current Problem:**
- Fetch ALL fixtures → accumulate in memory → validate
- Memory spike: 1000 fixtures × 5KB = 5-10MB

**With Pagination:**
- Fetch page 1 (100 fixtures) → validate → clear
- Fetch page 2 (100 fixtures) → validate → clear
- Memory: Only 100 fixtures × 200 bytes = 20KB at any time

**Memory Savings:**
- Before: 5-10MB for 1000 fixtures
- After: 20KB per page (50-250x reduction)

### Pagination Behavior

1. **Default page size:** 100 fixtures per page
2. **Page numbering:** Start at 1 (not 0)
3. **Total count:** Include total fixture count in response
4. **Empty pages:** Return empty `data: []` array if page exceeds total
5. **Consistent ordering:** Use consistent sort order (e.g., by `id` ASC) so pagination is reliable

---

## Error Responses

### 400 Bad Request

```json
{
  "error": {
    "message": "Invalid request parameters",
    "details": {
      "teamIds": "teamIds must be an array",
      "fromDate": "fromDate must be a valid ISO 8601 date"
    }
  }
}
```

### 404 Not Found

```json
{
  "error": {
    "message": "No fixtures found matching criteria"
  }
}
```

### 500 Internal Server Error

```json
{
  "error": {
    "message": "Internal server error",
    "code": "INTERNAL_ERROR"
  }
}
```

---

## Implementation Notes

### Performance Considerations

1. **No populate:** Do NOT populate `teams` relationship (saves significant memory)
2. **Selective fields:** Only select `id`, `gameID`, `urlToScoreCard` fields
3. **Indexing:** Ensure `dayOne` and `teams.id` are indexed for fast queries
4. **Query optimization:** Use efficient WHERE clauses, avoid N+1 queries

### Data Format

**Strapi Response Format:**
```json
{
  "data": [
    {
      "id": 12345,
      "attributes": {
        "gameID": "game-abc-123",
        "urlToScoreCard": "/game-centre/12345/scorecard"
      }
    }
  ],
  "meta": { ... }
}
```

**OR Flattened Format (Preferred):**
```json
{
  "data": [
    {
      "id": 12345,
      "gameID": "game-abc-123",
      "urlToScoreCard": "/game-centre/12345/scorecard"
    }
  ],
  "meta": { ... }
}
```

**Note:** If using Strapi format, we'll flatten it in our code. Flattened format is preferred to avoid extra processing.

---

## Usage Example (Client Side)

### Incremental Processing Pattern

```javascript
// Process fixtures incrementally (fetch → validate → clear)
let page = 1;
const pageSize = 100;
let hasMore = true;

while (hasMore) {
  // Fetch one page
  const response = await fetch(
    `/api/fixtures/validation?teamIds[]=1&teamIds[]=2&fromDate=...&toDate=...&page=${page}&pageSize=${pageSize}`
  );
  const { data, meta } = await response.json();

  // Validate this page
  const results = await validateFixtures(data);

  // Process results immediately
  await processValidationResults(results);

  // Clear data from memory
  data = null;
  results = null;

  // Check if more pages
  hasMore = page < meta.pagination.pageCount;
  page++;
}
```

**Memory Impact:**
- Only 100 fixtures in memory at any time
- Memory cleared after each page
- Total memory: ~20KB instead of 5-10MB

---

## Benefits

### Memory Reduction

| Metric | Current | With New Endpoint |
|--------|---------|-------------------|
| Data per fixture | 5-10KB | 200 bytes |
| 1000 fixtures | 5-10MB | 200KB |
| With pagination | N/A | 20KB per page |
| **Reduction** | - | **95-98%** |

### Performance Benefits

1. **Faster API responses** (less data to serialize/transfer)
2. **Lower memory usage** (only essential data)
3. **Incremental processing** (fetch → validate → clear)
4. **Scalability** (can handle 10,000+ fixtures without memory issues)

---

## Migration Path

### Phase 1: Create New Endpoint
- Create `/api/fixtures/validation` endpoint
- Return only `id`, `gameID`, `urlToScoreCard`
- Support pagination

### Phase 2: Update Client Code
- Modify `GameCRUD.getFixturesForTeams()` to use new endpoint
- Implement incremental processing (fetch → validate → clear)
- Remove `populate: ["teams"]` from old endpoint usage

### Phase 3: Testing
- Test with small batches (10 fixtures)
- Test with medium batches (100 fixtures)
- Test with large batches (1000+ fixtures)
- Monitor memory usage

---

## Questions for CMS Team

1. **Can we create a dedicated endpoint** `/api/fixtures/validation`?
2. **Can we return only 3 fields** (`id`, `gameID`, `urlToScoreCard`)?
3. **Can we support pagination** (page, pageSize)?
4. **Can we avoid populating relationships** (no `teams`)?
5. **What's the maximum page size** we should support?
6. **Can we use consistent ordering** for reliable pagination?

---

## Summary

**What We Need:**
- Endpoint: `/api/fixtures/validation`
- Returns: Only `id`, `gameID`, `urlToScoreCard`
- Supports: Pagination (page, pageSize)
- Filters: `teamIds[]`, `fromDate`, `toDate`, `sportType`

**Why:**
- Reduce memory usage by 95-98%
- Enable incremental processing
- Prevent memory spikes during validation
- Scale to handle large fixture counts

**Impact:**
- Current: 5-10MB for 1000 fixtures
- New: 20KB per page (50-250x reduction)

