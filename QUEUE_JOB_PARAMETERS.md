# Queue Job Parameters for `updateAccountOnly` Queue

This document outlines the `updateAccountOnly` Redis Bull queue and how to add jobs to it from Strapi CMS.

---

## Overview

The `updateAccountOnly` queue is a new queue option that allows triggering account updates on-demand. Unlike the full `syncUserAccount` flow, this "slice" only updates account details and does **not** process competitions, teams, or games. It also does **not** hand off to another worker—it completes and notifies the CMS when done.

---

## Flow

1. **Admin FE Button** → User clicks button in admin interface
2. **Admin FE** → Sends HTTP request to Strapi CMS endpoint
3. **Strapi CMS** → Receives request, validates account data
4. **Strapi CMS** → Adds job to Redis Bull `updateAccountOnly` queue
5. **Worker** → Picks up job, processes account update, notifies CMS
6. **CMS** → Receives completion notification

---

## Queue Details

### Queue Name

```
updateAccountOnly
```

### Queue Purpose

- Fetches fresh account data from CMS
- **Processes competitions** (scrapes and assigns)
- **Processes teams** (scrapes and assigns)
- **Processes games** (scrapes and assigns)
- **Creates data collections** and tracking entries
- **Does NOT** hand off to another worker (completes in this worker)

---

## Required Job Data Structure

When adding a job to the `updateAccountOnly` queue from Strapi, the job data must follow this structure:

```javascript
{
  getSync: {
    ID: <number>,           // Required: Account ID (integer)
    PATH: <string>         // Required: Account type - must be "CLUB" or "ASSOCIATION"
  }
}
```

---

## Parameters

### Required Fields

| Field          | Type     | Description                                                | Example  |
| -------------- | -------- | ---------------------------------------------------------- | -------- |
| `getSync.ID`   | `number` | The account ID to update                                   | `123`    |
| `getSync.PATH` | `string` | Account type - must be exactly `"CLUB"` or `"ASSOCIATION"` | `"CLUB"` |

---

## Example Job Data

### For a Club Account:

```javascript
{
  getSync: {
    ID: 456,
    PATH: "CLUB"
  }
}
```

### For an Association Account:

```javascript
{
  getSync: {
    ID: 789,
    PATH: "ASSOCIATION"
  }
}
```

---

## Strapi Implementation

### Step 1: Create Strapi Endpoint

Create a new endpoint in Strapi that receives the request from the Admin FE:

```javascript
// Example: src/api/account/controllers/account.js

async updateAccountOnly(ctx) {
  try {
    const { accountId, accountType } = ctx.request.body;

    // Validate input
    if (!accountId || !accountType) {
      return ctx.badRequest('Missing required fields: accountId and accountType');
    }

    if (accountType !== 'CLUB' && accountType !== 'ASSOCIATION') {
      return ctx.badRequest('accountType must be "CLUB" or "ASSOCIATION"');
    }

    // Prepare job data
    const jobData = {
      getSync: {
        ID: parseInt(accountId),
        PATH: accountType
      }
    };

    // Add job to Redis Bull queue
    const { updateAccountOnly } = require('../../../path/to/queueConfig');
    await updateAccountOnly.add(jobData);

    return ctx.send({
      success: true,
      message: 'Account update job queued successfully',
      accountId: accountId
    });
  } catch (error) {
    ctx.throw(500, `Error queueing account update: ${error.message}`);
  }
}
```

### Step 2: Add Route

```javascript
// Example: src/api/account/routes/account.js

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/account/update-account-only",
      handler: "account.updateAccountOnly",
      config: {
        policies: [], // Add auth policies as needed
      },
    },
  ],
};
```

### Step 3: Access Queue Config

In Strapi, you'll need to access the queue configuration. You have two options:

#### Option A: Import Queue Config Directly

If Strapi has access to the worker's queue config:

```javascript
const {
  updateAccountOnly,
} = require("./path/to/worker/src/config/queueConfig");

// Add job
await updateAccountOnly.add(jobData);
```

#### Option B: Create Queue Instance

If Strapi needs to create its own queue instance:

```javascript
const Queue = require("bull");
const getRedisClient = require("./path/to/worker/src/config/redisConfig");

const updateAccountOnlyQueue = new Queue("updateAccountOnly", {
  createClient: (type) => getRedisClient(type),
});

// Add job
await updateAccountOnlyQueue.add(jobData);
```

---

## Admin FE Request Format

The Admin FE should send a POST request to Strapi with the following structure:

```javascript
// Example: Admin FE button onClick handler

const handleUpdateAccount = async (accountId, accountType) => {
  try {
    const response = await fetch("/api/account/update-account-only", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add auth headers as needed
      },
      body: JSON.stringify({
        accountId: accountId, // number
        accountType: accountType, // "CLUB" or "ASSOCIATION"
      }),
    });

    const result = await response.json();
    if (result.success) {
      // Show success message
      console.log("Account update queued successfully");
    }
  } catch (error) {
    // Handle error
    console.error("Error queueing account update:", error);
  }
};
```

---

## Validation

Strapi should validate:

- ✅ `accountId` must be present and a valid number
- ✅ `accountType` must be exactly `"CLUB"` or `"ASSOCIATION"`

The worker queue handler also validates:

- ✅ `getSync.ID` must be present (non-null, non-undefined)
- ✅ `getSync.PATH` must be exactly `"CLUB"` or `"ASSOCIATION"`

If validation fails, the job will be rejected with an error logged.

---

## What Happens After Job is Added

1. **Job is queued** in Redis Bull `updateAccountOnly` queue
2. **Worker picks up** the job from the queue
3. **Worker processes** the full account sync:
   - Fetches fresh account data from CMS (via `reSyncData()`)
   - **Processes competitions** (scrapes and assigns to account)
   - **Processes teams** (scrapes and assigns to competitions)
   - **Processes games** (scrapes and assigns to teams)
   - **Creates data collections** and tracking entries
4. **Worker notifies CMS** when complete via `notifyCMSAccountSync(accountId, "completed")`
5. **Job finishes** - no handoff to another worker (all processing completes in this worker)

---

## Error Handling

### In Strapi

- Validate input parameters
- Handle Redis connection errors
- Return appropriate HTTP status codes
- Log errors for debugging

### In Worker

If the job fails:

- Error is logged with full details
- CMS is notified via `notifyCMSAccountSync(accountId, "failed")`
- Job status is marked as failed in Bull queue

---

## CMS Notification Endpoint

The worker will notify Strapi when the job completes or fails via:

```
GET /api/account/AccountSchedulerToFalse/${accountId}
```

This is handled by the existing `notifyCMSAccountSync` function in the worker.

---

## Notes

- **Queue name**: `"updateAccountOnly"`
- **Jobs are processed asynchronously** by the worker
- **The processor works for both CLUB and ASSOCIATION** account types
- **No additional optional parameters** are required beyond `ID` and `PATH`
- **Ensure Redis connection** is configured correctly in Strapi
- **Consider adding job status tracking** to show users when update is in progress

---

## Example: Complete Strapi Controller

```javascript
// src/api/account/controllers/account.js

"use strict";

const { updateAccountOnly } = require("../../../path/to/queueConfig");

module.exports = {
  async updateAccountOnly(ctx) {
    try {
      const { accountId, accountType } = ctx.request.body;

      // Validate input
      if (!accountId) {
        return ctx.badRequest("accountId is required");
      }

      if (!accountType) {
        return ctx.badRequest("accountType is required");
      }

      if (accountType !== "CLUB" && accountType !== "ASSOCIATION") {
        return ctx.badRequest('accountType must be "CLUB" or "ASSOCIATION"');
      }

      // Prepare job data
      const jobData = {
        getSync: {
          ID: parseInt(accountId),
          PATH: accountType,
        },
      };

      // Add job to queue
      await updateAccountOnly.add(jobData);

      // Log the action
      strapi.log.info(
        `Account update job queued for account ${accountId} (${accountType})`
      );

      return ctx.send({
        success: true,
        message: "Account update job queued successfully",
        accountId: parseInt(accountId),
        accountType: accountType,
      });
    } catch (error) {
      strapi.log.error("Error queueing account update:", error);
      return ctx.throw(500, `Error queueing account update: ${error.message}`);
    }
  },
};
```
