# Folder Overview

This is the root folder of the Fixtura Account Sync service - a web worker responsible for keeping active accounts up to date. The service handles scraping, data processing, and synchronization of sports club and association data using Puppeteer, Redis queues, and various data processing modules.

## Files

- `worker.js`: Main worker entry point - initializes queues, schedules tasks, and manages service lifecycle
- `controller.js`: Main controller orchestrating account sync operations (clubs, associations, direct processing, on-demand updates)
- `package.json`: Project dependencies and configuration
- `Procfile`: Heroku deployment configuration
- `test-connection.js`: Connection testing utility
- `updateTask.js`: Task update utility

## Relations

- Parent folder: [../readMe.md](../readMe.md) (Scrapers folder)
- Consumed by: Heroku worker dyno, local development environments
- Key dependencies: Redis for queue management, Puppeteer for web scraping, Winston for logging

## Dependencies

- Internal:
  - `api/`: API modules for data operations (assignment, control, evaluation, scraping)
  - `src/`: Core service modules (configuration, controllers, queues, tasks, utilities)
  - `dataProcessing/`: Data processing and transformation pipeline (scraping, processing, assignment, validation, cleanup)
  - `common/`: Shared utilities and base controllers
  - `__tests__/`: Complete integration testing framework
- External:
  - Bull (Redis-based job queue)
  - IORedis (Redis client)
  - Puppeteer (browser automation)
  - Puppeteer-extra (enhanced Puppeteer)
  - Winston (structured logging)
  - @slack/web-api (Slack notifications)
  - Node-cron (scheduled tasks)
  - Node-fetch (HTTP requests)
  - Dotenv (environment variables)
