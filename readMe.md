# Folder Overview

This is the root folder of the Fixtura Account Sync service - a web worker responsible for keeping active accounts up to date. The service handles scraping, data processing, and synchronization of sports club and association data using Puppeteer, Redis queues, and various data processing modules.

## Files

- `worker.js`: Main worker entry point for the service
- `controller.js`: Main controller for orchestrating operations
- `package.json`: Project dependencies and configuration
- `CONFIGURATION.md`: Service configuration documentation
- `ERROR_HANDLING_IMPROVEMENTS.md`: Error handling improvements documentation
- `test-connection.js`: Connection testing utility
- `updateTask.js`: Task update utility
- `Procfile`: Heroku deployment configuration

## Relations

- Parent folder: [../readMe.md](../readMe.md) (Scrapers folder)
- Key dependencies: Redis for queue management, Puppeteer for web scraping, Winston for logging

## Dependencies

- Internal:
  - `api/`: API modules for data operations
  - `src/`: Core service modules (queues, tasks, config)
  - `dataProcessing/`: Data processing and transformation modules
  - `common/`: Shared utilities and base controllers
  - `__tests__/`: **Complete integration testing framework** ✅
- External:
  - Bull (Redis-based job queue)
  - Puppeteer (web scraping)
  - Winston (logging)
  - Slack API (notifications)
  - Node-cron (scheduled tasks)
