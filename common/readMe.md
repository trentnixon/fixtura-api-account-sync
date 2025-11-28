# Folder Overview

This folder contains shared base classes and dependency management utilities used across the application. These modules provide foundational functionality for controllers, resource management, and dependency injection.

## Files

- `BaseController.js`: Base controller class with browser management, dependency initialization, data collection operations, and disposable resource cleanup
- `dependencies.js`: Dependency injection module providing Puppeteer instance creation, account status updates, data collection CRUD operations, and query string builders for API relations
- `Disposable.js`: Base class for disposable resources implementing the dispose pattern for cleanup

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All controllers and processing modules throughout the application
- Key dependencies: Puppeteer, API fetcher, query string utilities

## Dependencies

- Internal:
  - `api/Utils/fetcher`: API request utilities
  - `src/config/environment`: Environment configuration
  - `src/config/proxyConfig`: Proxy configuration
  - `dataProcessing/puppeteer/browserConfig`: Browser configuration
- External:
  - Puppeteer-extra (browser automation)
  - Puppeteer-extra-plugin-stealth (anti-detection)
  - QS (query string parsing)
  - Events (EventEmitter for listener management)
