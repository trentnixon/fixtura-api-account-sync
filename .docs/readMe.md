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

## Parallel Processing Architecture

The service implements a robust parallel processing strategy to optimize performance while managing resource constraints (especially memory and proxy connections).

### Key Components

1.  **PuppeteerManager (Singleton)**:

    - Main orchestrator coordinating specialized manager modules.
    - Provides unified API for browser and page management.
    - Manages active pages tracking and coordinates between parallel and reusable page strategies.

2.  **Manager Modules** (`dataProcessing/puppeteer/utils/`):

    - **PagePoolManager**: Manages pool of reusable browser pages for parallel processing with automatic replenishment.
    - **ReusePageManager**: Manages reusable pages for single-item processing to eliminate proxy auth overhead.
    - **BrowserLifecycleManager**: Handles browser launch, restart, and close operations with circuit breaker integration.
    - **ProxyConfigManager**: Manages proxy configuration and port rotation.
    - **ProxyErrorHandler**: Detects rate limits, implements exponential backoff, and tracks proxy failures.
    - **MemoryMonitor**: Tracks operations, monitors memory, and makes restart decisions.
    - **PageFactory**: Centralized page creation logic shared across managers.
    - **Concurrency Control**: `PagePoolManager` implements a waiting mechanism (`getPage()`) to ensure tasks wait for an available page rather than overloading the browser or sharing active pages (which causes race conditions).

3.  **Parallel Utilities**:

    - `processInParallel`: A utility function that processes items in batches with a defined concurrency limit.
    - `p-limit`: Used internally to limit the number of concurrent promises.

4.  **Stage-Specific Parallelism**:
    - **Competitions**: Processes multiple associations in parallel (if applicable).
    - **Teams**: Processes multiple grades in parallel (`GetTeamsFromLadder`).
    - **Games**: Processes multiple teams in parallel (`GetTeamsGameData`).
    - **Validation**: Validates fixture URLs in parallel batches (`FixtureValidationService`).

### Configuration

Parallel processing settings are defined in `dataProcessing/puppeteer/constants.js`:

- `PAGE_POOL_SIZE`: Default size of the page pool (e.g., 3).
- `COMPETITIONS_CONCURRENCY`: Concurrency limit for competitions.
- `TEAMS_CONCURRENCY`: Concurrency limit for teams.
- `VALIDATION_CONCURRENCY`: Concurrency limit for fixture validation.

### Recent Optimizations

- **Modular Architecture**: Refactored `PuppeteerManager` from monolithic 1,273-line file into focused manager modules (ProxyConfigManager, BrowserLifecycleManager, MemoryMonitor, ProxyErrorHandler, PagePoolManager, ReusePageManager, PageFactory) for better maintainability and testability.
- **Race Condition Fix**: `PagePoolManager` now polls for available pages instead of returning active ones, preventing multiple tasks from controlling the same page.
- **Pool Sizing**: Services (`FixtureValidationService`, `GetTeamsGameData`) now dynamically create page pools matching their specific concurrency limits to avoid bottlenecks.
- **Automatic Pool Replenishment**: Page pool automatically maintains minimum size when pages crash.
- **Proxy Rate Limit Handling**: Automatic detection and exponential backoff for HTTP 429 errors.
- **Circuit Breaker**: Prevents repeated attempts to failing proxy.
- **Pool Metrics**: Comprehensive metrics for performance monitoring and optimization.
- **Batch Processing**: Teams and fixtures are processed in batches to manage memory usage effectively.
