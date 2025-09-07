# Folder Overview

This folder contains API modules for data operations including assignment, control, data evaluation, Puppeteer scraping, and utility functions. These modules handle the core business logic for managing sports associations, clubs, competitions, and team data.

## Files

- `AssignCenter/`: Modules for assigning competitions and game data
- `ControllerCenter/`: Controllers for managing associations and clubs
- `DataCenter/`: Data evaluation and processing modules
- `Puppeteer/`: Web scraping modules using Puppeteer
- `ScrapeCenter/`: Core scraping functionality and utilities
- `Utils/`: Shared utility functions and API fetchers

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer for web scraping, data processing modules

## Dependencies

- Internal:
  - `AssignCenter/`: Competition and game data assignment
  - `ControllerCenter/`: Association and club management
  - `DataCenter/`: Data evaluation utilities
  - `Puppeteer/`: Web scraping operations
  - `ScrapeCenter/`: Core scraping logic
  - `Utils/`: Shared utilities
- External:
  - Puppeteer (web scraping)
  - Node-fetch (HTTP requests)
  - Winston (logging)
