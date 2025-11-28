# Folder Overview

This folder contains the core service modules that form the backbone of the worker service. These modules handle configuration management, queue orchestration, task processing, and service utilities for the account synchronization worker.

## Files

- `config/`: Service configuration modules (environment, Redis, queues, proxy)
- `controller/`: Main service controller orchestrating account sync operations (clubs, associations, direct processing)
- `queues/`: Redis-based Bull queue management for job queuing, error handling, and account onboarding
- `tasks/`: Task processors that execute specific job types from queues (association, club, direct processing)
- `utils/`: Service utility functions (health checks, HTTP fetcher, logging, Slack notifications)

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: Main worker (`worker.js`), controller (`controller.js`)
- Key dependencies: Redis for queues, Bull for job management, Winston for logging

## Dependencies

- Internal:
  - `config/`: Service configuration and environment management
  - `controller/`: Service orchestration and coordination
  - `queues/`: Job queue management and error handling
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
