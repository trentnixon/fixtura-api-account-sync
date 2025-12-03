# Folder Overview

This folder orchestrates the complete data processing pipeline for scraped sports data. It handles the transformation, validation, assignment, and synchronization of competitions, teams, games, and fixtures from web scraping operations into the database. The pipeline includes stages for scraping, processing, validation, cleanup, and tracking.

## Files

- `controllers/`: Main orchestration controller (`dataController.js`) - coordinates the full processing pipeline
- `scrapeCenter/`: Web scraping modules for competitions, game data, and team extraction from ladders
- `processors/`: Specialized processors that transform scraped data (competitions, teams, games, fixture validation)
- `assignCenter/`: Data assignment and CRUD operations for linking entities (competitions, teams, games)
- `services/`: Service layer for CRUD operations, data fetching, fixture validation/comparison/deletion, and processing tracking
- `dataCenter/`: Data evaluation modules for assessing association and club data quality
- `puppeteer/`: Browser automation management for scraping operations
- `utils/`: Shared utilities (error handling, memory tracking, query helpers, processor utilities)

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: Main worker (`worker.js`) and controller (`controller.js`)
- Key dependencies: Puppeteer for scraping, Redis for queue management, database APIs

## Dependencies

- Internal:
  - `controllers/`: Orchestrates processing stages (competitions → teams → games → validation → cleanup)
  - `scrapeCenter/`: Fetches raw data from web sources
  - `processors/`: Transforms and validates scraped data
  - `assignCenter/`: Persists and links data entities
  - `services/`: Provides data operations, tracking, and fixture management
  - `dataCenter/`: Evaluates data quality
  - `puppeteer/`: Manages browser instances for scraping
  - `utils/`: Shared helper functions
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
  - Moment (date handling)
  - Node-fetch (API calls)
