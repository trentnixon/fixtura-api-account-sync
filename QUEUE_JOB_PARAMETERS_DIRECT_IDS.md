# Queue Job Parameters for Direct ID Processing Queues

This document outlines the `syncClubDirect` and `syncAssociationDirect` Redis Bull queues and how to add jobs to them from Strapi CMS.

---

## Overview

The direct ID processing queues allow you to process club or association data directly using their organization IDs, without requiring an associated user account. These queues bypass the account lookup step and use a pseudo/sudo admin account ID internally to satisfy data structure requirements.

**Key Features:**

- ✅ Processes organizations directly by ID (no account lookup needed)
- ✅ Full processing pipeline (competitions, teams, games, validation, cleanup)
- ✅ Uses pseudo admin account ID internally (configured via `ADMIN_ACCOUNT_ID` env var)
- ✅ Skips account status updates (`isSetup`, `isUpdating` not modified)
- ✅ Notifications sent via Slack/webhook (not CMS account endpoints)
- ✅ All existing processing stages work as-is

---

## Flow

1. **Admin FE Button** → User clicks button in admin interface
2. **Admin FE** → Sends HTTP request to Strapi CMS endpoint with org ID
3. **Strapi CMS** → Receives request, validates org data
4. **Strapi CMS** → Adds job to Redis Bull queue (`syncClubDirect` or `syncAssociationDirect`)
5. **Worker** → Picks up job, processes org data directly, sends Slack notification
6. **Slack/Webhook** → Receives completion/failure notification

---

# `syncClubDirect` Queue

## Queue Details

### Queue Name

```
syncClubDirect
```

### Queue Purpose

- Processes club data directly using club ID (bypasses account lookup)
- Fetches club details directly from CMS
- Processes competitions (scrapes and assigns)
- Processes teams (scrapes and assigns)
- Processes games (scrapes and assigns)
- Creates data collections and tracking entries
- Uses pseudo admin account ID internally
- Sends Slack/webhook notifications (not CMS account endpoints)

---

## Required Job Data Structure

When adding a job to the `syncClubDirect` queue from Strapi, the job data must follow this structure:

```javascript
{
  getSync: {
    ID: <number>,           // Required: Club ID (integer)
    PATH: <string>          // Required: Must be "CLUB"
  }
}
```

---

## Parameters

### Required Fields

| Field          | Type     | Description              | Example  |
| -------------- | -------- | ------------------------ | -------- |
| `getSync.ID`   | `number` | The club ID to process   | `27958`  |
| `getSync.PATH` | `string` | Must be exactly `"CLUB"` | `"CLUB"` |

---

## Example Job Data

```javascript
{
  getSync: {
    ID: 27958,
    PATH: "CLUB"
  }
}
```

---

## Strapi Implementation

### Step 1: Create Strapi Endpoint

Create a new endpoint in Strapi that receives the request from the Admin FE:

```javascript
// Example: src/api/club/controllers/club.js

async processClubDirect(ctx) {
  try {
    const { clubId } = ctx.request.body;

    // Validate input
    if (!clubId) {
      return ctx.badRequest('Missing required field: clubId');
    }

    // Validate club exists
    const club = await strapi.entityService.findOne('api::club.club', clubId);
    if (!club) {
      return ctx.badRequest(`Club with ID ${clubId} not found`);
    }

    // Prepare job data
    const jobData = {
      getSync: {
        ID: parseInt(clubId),
        PATH: "CLUB"
      }
    };

    // Add job to Redis Bull queue
    const { syncClubDirect } = require('../../../path/to/queueConfig');
    await syncClubDirect.add(jobData);

    return ctx.send({
      success: true,
      message: 'Club direct processing job queued successfully',
      clubId: clubId
    });
  } catch (error) {
    ctx.throw(500, `Error queueing club direct processing: ${error.message}`);
  }
}
```

### Step 2: Add Route

```javascript
// Example: src/api/club/routes/club.js

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/club/process-direct",
      handler: "club.processClubDirect",
      config: {
        policies: [], // Add auth policies as needed
      },
    },
  ],
};
```

---

# `syncAssociationDirect` Queue

## Queue Details

### Queue Name

```
syncAssociationDirect
```

### Queue Purpose

- Processes association data directly using association ID (bypasses account lookup)
- Fetches association details directly from CMS
- Processes competitions (scrapes and assigns)
- Processes teams (scrapes and assigns)
- Processes games (scrapes and assigns)
- Creates data collections and tracking entries
- Uses pseudo admin account ID internally
- Sends Slack/webhook notifications (not CMS account endpoints)

---

## Required Job Data Structure

When adding a job to the `syncAssociationDirect` queue from Strapi, the job data must follow this structure:

```javascript
{
  getSync: {
    ID: <number>,           // Required: Association ID (integer)
    PATH: <string>          // Required: Must be "ASSOCIATION"
  }
}
```

---

## Parameters

### Required Fields

| Field          | Type     | Description                     | Example         |
| -------------- | -------- | ------------------------------- | --------------- |
| `getSync.ID`   | `number` | The association ID to process   | `3292`          |
| `getSync.PATH` | `string` | Must be exactly `"ASSOCIATION"` | `"ASSOCIATION"` |

---

## Example Job Data

```javascript
{
  getSync: {
    ID: 3292,
    PATH: "ASSOCIATION"
  }
}
```

---

## Strapi Implementation

### Step 1: Create Strapi Endpoint

Create a new endpoint in Strapi that receives the request from the Admin FE:

```javascript
// Example: src/api/association/controllers/association.js

async processAssociationDirect(ctx) {
  try {
    const { associationId } = ctx.request.body;

    // Validate input
    if (!associationId) {
      return ctx.badRequest('Missing required field: associationId');
    }

    // Validate association exists
    const association = await strapi.entityService.findOne('api::association.association', associationId);
    if (!association) {
      return ctx.badRequest(`Association with ID ${associationId} not found`);
    }

    // Prepare job data
    const jobData = {
      getSync: {
        ID: parseInt(associationId),
        PATH: "ASSOCIATION"
      }
    };

    // Add job to Redis Bull queue
    const { syncAssociationDirect } = require('../../../path/to/queueConfig');
    await syncAssociationDirect.add(jobData);

    return ctx.send({
      success: true,
      message: 'Association direct processing job queued successfully',
      associationId: associationId
    });
  } catch (error) {
    ctx.throw(500, `Error queueing association direct processing: ${error.message}`);
  }
}
```

### Step 2: Add Route

```javascript
// Example: src/api/association/routes/association.js

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/association/process-direct",
      handler: "association.processAssociationDirect",
      config: {
        policies: [], // Add auth policies as needed
      },
    },
  ],
};
```

---

## Admin FE Request Format

### For Club Direct Processing

The Admin FE should send a POST request to Strapi with the following structure:

```javascript
// Example: Admin FE button onClick handler

const handleProcessClubDirect = async (clubId) => {
  try {
    const response = await fetch("/api/club/process-direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add auth headers as needed
      },
      body: JSON.stringify({
        clubId: clubId, // number
      }),
    });

    const result = await response.json();
    if (result.success) {
      // Show success message
      console.log("Club direct processing job queued successfully");
    }
  } catch (error) {
    // Handle error
    console.error("Error queueing club direct processing:", error);
  }
};
```

### For Association Direct Processing

```javascript
// Example: Admin FE button onClick handler

const handleProcessAssociationDirect = async (associationId) => {
  try {
    const response = await fetch("/api/association/process-direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add auth headers as needed
      },
      body: JSON.stringify({
        associationId: associationId, // number
      }),
    });

    const result = await response.json();
    if (result.success) {
      // Show success message
      console.log("Association direct processing job queued successfully");
    }
  } catch (error) {
    // Handle error
    console.error("Error queueing association direct processing:", error);
  }
};
```

---

## Validation

Strapi should validate:

- ✅ `clubId` / `associationId` must be present and a valid number
- ✅ Organization must exist in CMS before queueing

The worker queue handler also validates:

- ✅ `getSync.ID` must be present (non-null, non-undefined)
- ✅ `getSync.PATH` must be exactly `"CLUB"` or `"ASSOCIATION"` (depending on queue)
- ✅ PATH must match the queue type (CLUB for `syncClubDirect`, ASSOCIATION for `syncAssociationDirect`)

If validation fails, the job will be rejected with an error logged.

---

## What Happens After Job is Added

1. **Job is queued** in Redis Bull queue (`syncClubDirect` or `syncAssociationDirect`)
2. **Worker picks up** the job from the queue
3. **Worker processes** the full org sync:
   - Fetches org data directly from CMS (bypasses account lookup)
   - Uses pseudo admin account ID internally (from `ADMIN_ACCOUNT_ID` env var)
   - **Processes competitions** (scrapes and assigns)
   - **Processes teams** (scrapes and assigns)
   - **Processes games** (scrapes and assigns)
   - **Creates data collections** and tracking entries (linked to pseudo admin account)
   - **Validates fixtures** (checks URL validity)
   - **Cleans up fixtures** (removes invalid/missing fixtures)
4. **Worker sends Slack/webhook notification** when complete via `notifyDirectOrgProcessing(orgId, orgType, "completed")`
5. **Job finishes** - no account status updates, no CMS account endpoint notifications

---

## Environment Configuration

The direct ID processing queues require the following environment variable:

```bash
ADMIN_ACCOUNT_ID=436  # Pseudo/sudo admin account ID used internally
```

This account ID is used internally to satisfy data structure requirements but:

- **Does NOT** trigger account updates
- **Does NOT** send CMS account notifications
- **Only used** for data collection linking and logging

---

## Notification Mechanism

Unlike account-based queues, direct ID processing queues use **Slack/webhook notifications** instead of CMS account endpoints.

### Slack Configuration

Set the following environment variables to enable Slack notifications:

```bash
SlackToken=xoxb-your-slack-token
SLACK_DIRECT_ORG_CHANNEL=#data-account          # Optional, default: #data-account
SLACK_DIRECT_ORG_ERROR_CHANNEL=#data-account-error  # Optional, default: #data-account-error
```

### Notification Format

**Success Notification:**

```
✅ Direct CLUB Processing completed successfully
• Organization ID: 27958
• Organization Type: CLUB
• Timestamp: 2025-11-23T16:13:14.123Z
```

**Failure Notification:**

```
❌ Direct ASSOCIATION Processing failed
• Organization ID: 3292
• Organization Type: ASSOCIATION
• Error: Club not found or could not be fetched...
• Timestamp: 2025-11-23T16:13:14.123Z
```

If Slack is not configured, notifications will be logged only.

---

## Error Handling

### In Strapi

- Validate input parameters
- Validate organization exists in CMS
- Handle Redis connection errors
- Return appropriate HTTP status codes
- Log errors for debugging

### In Worker

If the job fails:

- Error is logged with prominent org ID and org type
- Slack/webhook notification sent (if configured) with error details
- Job status is marked as failed in Bull queue
- **No account operations** are performed

---

## Differences from Account-Based Queues

| Feature               | Account Queues                  | Direct ID Queues                   |
| --------------------- | ------------------------------- | ---------------------------------- |
| **Input**             | Account ID                      | Organization ID (club/association) |
| **Account Lookup**    | Required                        | Bypassed                           |
| **Account Updates**   | Updates `isSetup`, `isUpdating` | Skipped                            |
| **Notifications**     | CMS account endpoint            | Slack/webhook                      |
| **Pseudo Account ID** | Not used                        | Uses `ADMIN_ACCOUNT_ID`            |
| **Data Collections**  | Linked to account               | Linked to pseudo admin account     |

---

## Notes

- **Queue names**: `"syncClubDirect"` and `"syncAssociationDirect"`
- **Jobs are processed asynchronously** by the worker
- **Pseudo account ID** must be configured via `ADMIN_ACCOUNT_ID` env var
- **All processing stages** work as-is (no modifications needed)
- **Account operations are skipped** (no status updates, no CMS account notifications)
- **Ensure Redis connection** is configured correctly in Strapi
- **Slack notifications** are optional but recommended for visibility

---

## Example: Complete Strapi Controllers

### Club Direct Processing Controller

```javascript
// src/api/club/controllers/club.js

"use strict";

const { syncClubDirect } = require("../../../path/to/queueConfig");

module.exports = {
  async processClubDirect(ctx) {
    try {
      const { clubId } = ctx.request.body;

      // Validate input
      if (!clubId) {
        return ctx.badRequest("clubId is required");
      }

      // Validate club exists
      const club = await strapi.entityService.findOne(
        "api::club.club",
        parseInt(clubId)
      );
      if (!club) {
        return ctx.badRequest(`Club with ID ${clubId} not found`);
      }

      // Prepare job data
      const jobData = {
        getSync: {
          ID: parseInt(clubId),
          PATH: "CLUB",
        },
      };

      // Add job to queue
      await syncClubDirect.add(jobData);

      // Log the action
      strapi.log.info(`Club direct processing job queued for club ${clubId}`);

      return ctx.send({
        success: true,
        message: "Club direct processing job queued successfully",
        clubId: parseInt(clubId),
      });
    } catch (error) {
      strapi.log.error("Error queueing club direct processing:", error);
      return ctx.throw(
        500,
        `Error queueing club direct processing: ${error.message}`
      );
    }
  },
};
```

### Association Direct Processing Controller

```javascript
// src/api/association/controllers/association.js

"use strict";

const { syncAssociationDirect } = require("../../../path/to/queueConfig");

module.exports = {
  async processAssociationDirect(ctx) {
    try {
      const { associationId } = ctx.request.body;

      // Validate input
      if (!associationId) {
        return ctx.badRequest("associationId is required");
      }

      // Validate association exists
      const association = await strapi.entityService.findOne(
        "api::association.association",
        parseInt(associationId)
      );
      if (!association) {
        return ctx.badRequest(`Association with ID ${associationId} not found`);
      }

      // Prepare job data
      const jobData = {
        getSync: {
          ID: parseInt(associationId),
          PATH: "ASSOCIATION",
        },
      };

      // Add job to queue
      await syncAssociationDirect.add(jobData);

      // Log the action
      strapi.log.info(
        `Association direct processing job queued for association ${associationId}`
      );

      return ctx.send({
        success: true,
        message: "Association direct processing job queued successfully",
        associationId: parseInt(associationId),
      });
    } catch (error) {
      strapi.log.error("Error queueing association direct processing:", error);
      return ctx.throw(
        500,
        `Error queueing association direct processing: ${error.message}`
      );
    }
  },
};
```
