# Folder Overview

This folder contains Puppeteer management modules for data processing operations. These modules handle browser automation, page management, and memory optimization for web scraping within the data processing pipeline.

## Files

- `PuppeteerManager.js`: Singleton manager for Puppeteer browser instances (lifecycle, memory management, page creation)
- `pageSetup.js`: Page configuration and setup utilities
- `pageUtils.js`: Page management utilities (safe page closing, page retrieval)
- `memoryUtils.js`: Memory tracking and statistics utilities
- `browserConfig.js`: Browser configuration settings
- `constants.js`: Configuration constants for browser and memory settings

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All scraping modules in `scrapeCenter/`
- Key dependencies: Puppeteer, data processing utilities

## Dependencies

- Internal: Data processing utilities
- External:
  - Puppeteer (browser automation)
  - Puppeteer-extra (enhanced Puppeteer)
  - Puppeteer-extra-plugin-stealth (anti-detection)
  - Winston (logging)
