# Folder Overview

This folder contains Puppeteer-based web scraping modules organized by functionality. These modules handle automated web scraping for sports associations, clubs, competitions, and team data using Puppeteer browser automation.

## Files

- `AssociationCompetitions/`: Scraping modules for association competitions
- `AssociationDetails/`: Scraping modules for association details and data
- `ClubDetails/`: Scraping modules for club details and team information
- `NoClubAssociations/`: Scraping modules for associations without clubs
- `ScrapeCenter/`: Core scraping utilities and functions
- `Utils/`: Shared scraping utilities and constants

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer for browser automation, scraping utilities

## Dependencies

- Internal:
  - `AssociationCompetitions/`: Competition scraping logic
  - `AssociationDetails/`: Association data scraping
  - `ClubDetails/`: Club and team data scraping
  - `NoClubAssociations/`: Specialized association scraping
  - `ScrapeCenter/`: Core scraping functionality
  - `Utils/`: Shared scraping utilities
- External:
  - Puppeteer (browser automation)
  - Puppeteer-extra (enhanced Puppeteer)
  - Winston (logging)
