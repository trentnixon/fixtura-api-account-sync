# Queue Monitoring and Metrics Documentation

## Overview

The queue monitoring system provides comprehensive metrics collection, health checks, and alerting for all Bull queues. It tracks queue depth, processing times, success/failure rates, and automatically detects issues like backlogs, processing rate drops, and health degradation.

## Architecture

### Components

1. **`queueMetrics.js`** - Core metrics collection and tracking
2. **`queueHealthCheck.js`** - Health check evaluation and validation
3. **`queueMonitoringService.js`** - Orchestration service that coordinates monitoring, periodic collection, and alerting

### Integration

The monitoring service is automatically initialized and started when the worker starts (`worker.js`). It runs independently and does not interfere with queue processing.

## Metrics Structure

### Per-Queue Metrics

Each queue has the following metrics tracked:

```javascript
{
  queueName: "syncUserAccount",
  timestamp: 1234567890123,
  counts: {
    waiting: 5,        // Jobs waiting to be processed
    active: 1,         // Jobs currently being processed
    completed: 100,    // Total completed jobs
    failed: 5,         // Total failed jobs
    delayed: 0,       // Delayed jobs
  },
  state: {
    isPaused: false,   // Whether queue is paused
    totalJobs: 6,     // waiting + active
  },
  processing: {
    average: 1250.5,           // Average processing time (ms)
    min: 500,                  // Minimum processing time (ms)
    max: 5000,                 // Maximum processing time (ms)
    median: 1200,              // Median processing time (ms)
    count: 100,                 // Number of jobs processed
    totalProcessed: 105,       // Total jobs processed (success + failure)
    successCount: 100,          // Successful jobs
    failureCount: 5,            // Failed jobs
    successRate: 95.24,         // Success rate percentage
    failureRate: 4.76,          // Failure rate percentage
  },
  processingRate: 2.5          // Jobs per minute (calculated from history)
}
```

### System-Wide Metrics

Aggregated metrics across all queues:

```javascript
{
  timestamp: 1234567890123,
  totalQueues: 6,
  queues: {
    // Per-queue metrics (see above)
  },
  system: {
    totalWaiting: 10,           // Total waiting jobs across all queues
    totalActive: 2,             // Total active jobs across all queues
    totalCompleted: 500,         // Total completed jobs
    totalFailed: 25,            // Total failed jobs
    totalProcessed: 525,        // Total processed jobs
    totalSuccess: 500,          // Total successful jobs
    totalFailure: 25,           // Total failed jobs
    averageSuccessRate: 95.24,  // Average success rate across queues
    averageProcessingTime: 1250.5 // Average processing time across queues
  }
}
```

## Health Check Structure

### Queue Health Status

Each queue has a health status:

- **healthy**: All checks pass, no issues
- **degraded**: Some issues detected (e.g., stuck jobs) but queue still functional
- **unhealthy**: Critical issues (Redis down, pause state mismatch)

### Health Check Results

```javascript
{
  timestamp: 1234567890123,
  healthy: true,
  status: "healthy",
  queues: {
    "syncUserAccount": {
      queueName: "syncUserAccount",
      timestamp: 1234567890123,
      healthy: true,
      status: "healthy",
      checks: {
        redis: {
          healthy: true
        },
        pauseState: {
          healthy: true,
          isPaused: false
        },
        stuckJobs: {
          healthy: true,
          stuckJobs: [],
          count: 0
        }
      },
      issues: []
    }
  },
  system: {
    totalQueues: 6,
    healthyQueues: 6,
    degradedQueues: 0,
    unhealthyQueues: 0,
    stateManager: {
      healthy: true,
      issues: []
    }
  },
  issues: []
}
```

## Alert Thresholds

### Backlog Thresholds

Configurable per queue type (default values):

- **Critical queues** (onboarding): 5 jobs
  - `onboardNewAccount`: 5 jobs
- **Regular queues**: 10 jobs (default)
  - `syncUserAccount`: 10 jobs
  - `startAssetBundleCreation`: 10 jobs
  - `updateAccountOnly`: 10 jobs
- **Direct processing queues**: 15 jobs
  - `syncClubDirect`: 15 jobs
  - `syncAssociationDirect`: 15 jobs

**Alert Severity:**

- Warning: Waiting jobs > threshold
- Error: Waiting jobs > threshold × 2

### Processing Rate Thresholds

- **Threshold**: 50% of average processing rate
- **Window**: 15 minutes
- **Severity**: Warning

Alert triggered when current processing rate drops below 50% of the historical average for the queue.

### Failure Rate Thresholds

- **Threshold**: 20% failure rate
- **Minimum Data**: Requires at least 10 processed jobs
- **Severity**:
  - Warning: Failure rate > 20% and ≤ 50%
  - Error: Failure rate > 50%

### Health Degradation Thresholds

- **Stuck Jobs**: Jobs active for > 30 minutes
- **Severity**:
  - Error: Queue status is "degraded"
  - Critical: Queue status is "unhealthy"

## Alert Throttling

To prevent alert spam, alerts are throttled with a cooldown period:

- **Default Cooldown**: 30 minutes per alert type per queue
- **Throttle Key**: `{queueName}:{alertType}`

Example: If a backlog alert is sent for `syncUserAccount`, no new backlog alerts will be sent for that queue for 30 minutes, even if the backlog persists.

## Configuration

### Environment Variables

- `SlackToken`: Slack API token for alert notifications (optional)
- `SLACK_QUEUE_MONITORING_CHANNEL`: Slack channel for monitoring alerts (default: `#queue-monitoring`)

### Service Configuration

The monitoring service can be configured via constructor options:

```javascript
const queueMonitoringService = new QueueMonitoringService({
  collectionInterval: 5 * 60 * 1000, // 5 minutes
  healthCheckInterval: 10 * 60 * 1000, // 10 minutes
  summaryLogInterval: 30 * 60 * 1000, // 30 minutes
  alertCheckInterval: 5 * 60 * 1000, // 5 minutes
  backlogThresholds: {
    onboardNewAccount: 5,
    default: 10,
    syncClubDirect: 15,
    syncAssociationDirect: 15,
  },
  processingRateThreshold: 0.5, // 50% of average
  failureRateThreshold: 20, // 20%
  alertThrottle: 30 * 60 * 1000, // 30 minutes
});
```

## Usage

### Accessing Metrics

```javascript
const queueMonitoringService = require("./src/queues/queueMonitoringService");

// Get all metrics
const metrics = queueMonitoringService.getMetrics();

// Get metrics for specific queue
const queueMetrics = queueMonitoringService.getQueueMetrics("syncUserAccount");

// Get health status
const healthStatus = await queueMonitoringService.getHealthStatus();

// Get full health check
const healthCheck = await queueMonitoringService.getFullHealthCheck();

// Get service status
const status = queueMonitoringService.getStatus();
```

### Manual Alert Check

```javascript
// Manually trigger alert check (normally done automatically every 5 minutes)
await queueMonitoringService.checkAndAlert();
```

### Stopping Monitoring

```javascript
// Stop all monitoring intervals (called automatically on graceful shutdown)
queueMonitoringService.stop();
```

## Monitoring Intervals

- **Metrics Collection**: Every 5 minutes

  - Collects queue stats using Bull's `getJobCounts()` API
  - Stores historical snapshots (last 100 per queue)
  - Retention: 24 hours

- **Health Checks**: Every 10 minutes

  - Checks Redis connectivity
  - Validates queue pause states
  - Detects stuck jobs
  - Validates state manager consistency

- **Summary Logging**: Every 30 minutes

  - Logs formatted metrics summary
  - Includes health status and per-queue metrics
  - Highlights any health issues

- **Alert Checking**: Every 5 minutes
  - Checks for backlogs
  - Checks for processing rate drops
  - Checks for high failure rates
  - Checks for health degradation
  - Sends Slack alerts if issues detected

## Error Handling

All monitoring operations are designed to be resilient:

- **Slack Failures**: Logged but don't break monitoring
- **Metrics Collection Errors**: Logged but don't stop periodic collection
- **Health Check Errors**: Logged but don't stop health checks
- **Alert Processing Errors**: Logged but don't stop alert checking

The monitoring service continues operating even if individual operations fail, ensuring queue monitoring is always available.

## Testing

To test monitoring under various queue states:

1. **Normal Operation**: Start worker and observe metrics collection
2. **Backlog Test**: Add multiple jobs to a queue to trigger backlog alert
3. **Health Degradation**: Manually pause a queue to trigger health alert
4. **Stuck Jobs**: Create a long-running job (>30 min) to trigger stuck job detection
5. **Failure Rate**: Cause multiple job failures to trigger failure rate alert
6. **Slack Integration**: Verify alerts are sent to Slack (if configured)

## Troubleshooting

### Monitoring Not Starting

- Check worker logs for initialization errors
- Verify queues are properly initialized before monitoring starts
- Check that `queueMonitoringService.initialize()` is called with valid queues

### Alerts Not Being Sent

- Verify Slack token is configured (`SlackToken` environment variable)
- Check alert throttling (alerts may be throttled for 30 minutes)
- Review logs for Slack API errors
- Verify alert thresholds are appropriate for your workload

### Metrics Not Updating

- Verify metrics collection interval is running (check logs)
- Check that jobs are being processed (metrics require job completion)
- Review logs for metrics collection errors

### High Memory Usage

- Reduce `maxHistorySize` in `queueMetrics` (default: 100 snapshots)
- Reduce `retentionPeriod` in `queueMetrics` (default: 24 hours)
- Call `queueMonitoringService.cleanup()` periodically to remove old metrics
