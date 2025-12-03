# Folder Overview

This folder contains modules for scraping association competition data using Puppeteer. These modules handle the extraction of competition information, assignment of clubs to competitions, and management of competition-related data.

## Files

- `assignClubToCompetition.js`: Assigns clubs to specific competitions
- `assignCompetitionsToAssociation.js`: Links competitions to associations
- `getAssociationCompetitions.js`: Scrapes competition data for associations

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, competition management

## Dependencies

- Internal: Competition assignment and management modules
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
