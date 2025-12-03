# Folder Overview

This folder contains Puppeteer management modules for data processing operations. These modules handle browser automation, page management, memory optimization, and proxy management for web scraping within the data processing pipeline.

## Architecture

The Puppeteer management system has been refactored into a modular architecture following the Single Responsibility Principle. `PuppeteerManager` acts as the main orchestrator, delegating specific responsibilities to specialized manager modules.

## Files

### Core Manager

- `PuppeteerManager.js`: Main orchestrator singleton (~411 lines) - coordinates all managers and provides unified API

### Manager Modules (`utils/`)

- `ProxyConfigManager.js`: Proxy configuration and port rotation (~101 lines)
- `BrowserLifecycleManager.js`: Browser launch, restart, and close operations (~285 lines)
- `MemoryMonitor.js`: Memory monitoring and restart decision logic (~140 lines)
- `ProxyErrorHandler.js`: Proxy error handling, rate limit detection, and backoff (~210 lines)
- `PagePoolManager.js`: Page pool management for parallel processing (~428 lines)
- `ReusePageManager.js`: Reusable page management for single-item processing (~159 lines)
- `PageFactory.js`: Centralized page creation logic (~124 lines)

### Supporting Modules

- `pageSetup.js`: Page configuration and setup utilities
- `pageUtils.js`: Page management utilities (safe page closing, page retrieval)
- `memoryUtils.js`: Memory tracking and statistics utilities
- `browserConfig.js`: Browser configuration settings
- `constants.js`: Configuration constants for browser, memory, and parallel processing settings
- `circuitBreaker.js`: Circuit breaker pattern for proxy failure handling
- `configValidator.js`: Configuration validation at startup

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All scraping modules in `scrapeCenter/` (Competitions, Teams, Games, Validation)
- Key dependencies: Puppeteer, data processing utilities

## Dependencies

- Internal:
  - `utils/`: Manager modules (ProxyConfigManager, BrowserLifecycleManager, MemoryMonitor, ProxyErrorHandler, PagePoolManager, ReusePageManager, PageFactory)
  - Data processing utilities (`OperationContext`, `processInParallel`)
- External:
  - Puppeteer (browser automation)
  - Puppeteer-extra (enhanced Puppeteer)
  - Puppeteer-extra-plugin-stealth (anti-detection)
  - Winston (logging)

## Manager Responsibilities

### ProxyConfigManager

- Proxy configuration retrieval
- Port rotation logic
- Page authentication with proxy credentials

### BrowserLifecycleManager

- Browser launch with proxy support
- Browser restart logic
- Browser close/cleanup
- Circuit breaker integration
- Fallback to non-proxy mode

### MemoryMonitor

- Operation count tracking
- Memory threshold checks
- Restart decision logic
- Memory statistics logging
- Rate limiting control for forced restarts

### ProxyErrorHandler

- HTTP 429 rate limit detection
- Exponential backoff implementation
- Circuit breaker failure tracking
- Proxy connection failure detection
- Rate limit state management

### PagePoolManager

- Page pool creation for parallel processing
- Page allocation from pool with automatic replenishment
- Page release back to pool
- Pool utilization metrics tracking

### ReusePageManager

- Reusable page pool management for single-item processing
- Page reuse logic
- Page state clearing

### PageFactory

- Centralized page creation logic
- Browser launch coordination
- Proxy authentication
- Page setup and configuration
- Operation counting and memory logging

## Parallel Processing Architecture

The service implements a robust parallel processing strategy to optimize performance while managing resource constraints (especially memory and proxy connections).

### Key Components

1. **PuppeteerManager (Singleton)**:

   - Orchestrates all manager modules
   - Provides unified API for browser and page management
   - Manages active pages tracking
   - Coordinates between parallel and reusable page strategies

2. **PagePoolManager**:

   - Manages a pool of reusable browser pages (`pagePool`) for parallel processing
   - Handles automatic pool replenishment
   - Tracks pool utilization metrics
   - **Concurrency Control**: Implements a waiting mechanism (`getPage()`) to ensure tasks wait for an available page rather than overloading the browser

3. **ReusePageManager**:

   - Manages reusable pages for single-item processing
   - Eliminates proxy authentication overhead by reusing pages
   - Handles page state clearing

4. **Parallel Utilities**:
   - `processInParallel`: A utility function that processes items in batches with a defined concurrency limit
   - `p-limit`: Used internally to limit the number of concurrent promises

### Configuration

Parallel processing settings are defined in `constants.js`:

- `PAGE_POOL_SIZE`: Default size of the page pool (e.g., 3)
- `COMPETITIONS_CONCURRENCY`: Concurrency limit for competitions
- `TEAMS_CONCURRENCY`: Concurrency limit for teams
- `VALIDATION_CONCURRENCY`: Concurrency limit for fixture validation

### Recent Optimizations

- **Modular Architecture**: Refactored from monolithic 1,273-line file into focused manager modules
- **Code Reuse**: Eliminated duplication between page creation methods
- **Better Organization**: Each manager has a single, clear responsibility
- **Race Condition Fix**: `PagePoolManager` polls for available pages instead of returning active ones
- **Pool Sizing**: Services dynamically create page pools matching their specific concurrency limits
- **Automatic Pool Replenishment**: Pool automatically maintains minimum size
- **Proxy Rate Limit Handling**: Automatic detection and exponential backoff for HTTP 429 errors
- **Circuit Breaker**: Prevents repeated attempts to failing proxy
- **Pool Metrics**: Comprehensive metrics for performance monitoring and optimization
