# 📁 Tickets.md – Competitions Module

This file is used for **feature-level planning and tracking** for the competitions scraping module.
Each ticket must follow a consistent structure so it can be easily read by both humans and LLMs.

---

## Completed Tickets

- (No completed tickets yet - tickets will be listed here as they are completed)

---

## Active Tickets

### TKT-2025-007

---

ID: TKT-2025-007
Status: In Progress
Priority: High
Owner: (TBD)
Created: 2025-12-03
Updated: 2025-12-03
Related: Bug-Fix-Competitions-001

## Overview

Critical bug where association IDs are incorrectly passed to `fetchDataForClub()` method, causing 404 errors when processing associations. The code attempts to fetch `clubs/{associationId}` instead of using the correct `fetchDataForAssociation()` method.

## What We Need to Do

Fix the `GetCompetitions` class to correctly handle both club and association account types by checking `ACCOUNTTYPE` and calling the appropriate CRUD method.

## Phases & Tasks

### Phase 1: Identify and Fix the Bug

#### Tasks

- [x] Update `processClubCompetitions()` method in `getCompetitions.js` to check `this.ACCOUNTTYPE` before calling CRUD methods
- [x] Replace `fetchDataForClub(this.AccountID)` with conditional logic:
  - If `ACCOUNTTYPE === "ASSOCIATION"` → use `fetchDataForAssociation(this.AccountID)`
  - If `ACCOUNTTYPE === "CLUB"` → use `fetchDataForClub(this.AccountID)`
- [x] Update `setup()` method (line 165) with the same conditional logic
- [ ] Consider renaming `processClubCompetitions()` to `processCompetitions()` since it handles both types (deferred - method name change would require updates in other files)

### Phase 2: Validation and Testing

#### Tasks

- [ ] Test with association account type to ensure no 404 errors occur
- [ ] Test with club account type to ensure existing functionality still works
- [ ] Verify that associations are correctly fetched and processed
- [ ] Check logs to confirm correct API endpoints are being called

## Constraints, Risks, Assumptions

- **Constraints**: None identified
- **Risks**:
  - Changing method names may require updates in other files that reference `processClubCompetitions()`
  - Need to ensure backward compatibility with existing club processing flows
- **Assumptions**:
  - `ACCOUNTTYPE` is reliably set to either "CLUB" or "ASSOCIATION"
  - `CRUDOperations.fetchDataForAssociation()` method exists and works correctly

## Error Details

**Error Location**: `dataProcessing/scrapeCenter/Competitions/getCompetitions.js`

- Line 48: `processClubCompetitions()` method
- Line 165: `setup()` method

**Error Message**:

```
Failed to fetch data from clubs/3023?populate[0]=teams&populate[1]=competitions&populate[2]=associations&populate[3]=associations.competitions&populate[4]=club_to_competitions. Status: 404
```

**Root Cause**: Association ID (3023) is being passed to `fetchDataForClub()`, which attempts to fetch from `/api/clubs/3023` endpoint. Since 3023 is an association ID, not a club ID, Strapi returns 404 Not Found.

---

## Summaries of Completed Tickets

(No completed tickets yet - summaries will be added here as tickets are completed)
