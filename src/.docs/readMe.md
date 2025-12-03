# Folder Overview

Core service modules for the account synchronization worker. Handles configuration, queue orchestration, task processing, and service utilities.

## Files

- `config/`: Service configuration (environment, Redis, queues, proxy)
- `controller/`: Main service controller orchestrating account sync operations
- `queues/`: Redis-based Bull queue management with monitoring, metrics, and base handler utilities
- `tasks/`: Task processors for different account types (club, association, direct processing)
- `utils/`: Service utilities (health checks, HTTP fetcher, logging, Slack notifications, CMS notifier)

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: Main worker (`worker.js`), controller (`controller.js`)
- Key dependencies: Redis for queues, Bull for job management, Winston for logging

## Dependencies

- Internal:
  - `config/`: Service configuration and environment management
  - `controller/`: Service orchestration and coordination
  - `queues/`: Job queue management, monitoring, and error handling (see [queues/.docs/readMe.md](queues/.docs/readMe.md))
  - `tasks/`: Task execution and processing
  - `utils/`: Shared service utilities
- External:
  - Bull (Redis-based job queue)
  - IORedis (Redis client)
  - Winston (structured logging)
  - Node-cron (scheduled tasks)
  - Node-fetch (HTTP requests)
  - @slack/web-api (Slack notifications)
  - Dotenv (environment variables)
