# Folder Overview

This folder contains data processing modules for handling data transformation, assignment, and processing operations. These modules manage the processing pipeline for scraped data including competitions, games, teams, and associations.

## Files

- `assignCenter/`: Data assignment modules for competitions and games
- `controllers/`: Data processing controllers
- `dataCenter/`: Data evaluation and processing modules
- `processors/`: Specialized data processors
- `puppeteer/`: Puppeteer management for data processing
- `scrapeCenter/`: Core scraping functionality for data processing
- `services/`: Data processing services and CRUD operations
- `utils/`: Data processing utilities and helpers

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, data processing utilities

## Dependencies

- Internal:
  - `assignCenter/`: Data assignment operations
  - `controllers/`: Processing controllers
  - `dataCenter/`: Data evaluation
  - `processors/`: Specialized processors
  - `puppeteer/`: Browser automation
  - `scrapeCenter/`: Scraping operations
  - `services/`: Data services
  - `utils/`: Processing utilities
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
  - Moment (date handling)
