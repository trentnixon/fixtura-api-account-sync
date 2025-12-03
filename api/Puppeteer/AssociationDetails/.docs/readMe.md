# Folder Overview

This folder contains modules for scraping detailed association information including competitions, clubs, grades, and ladders. These modules provide comprehensive data extraction for association entities using Puppeteer automation.

## Files

- `assignCompetitionsToAssociation.js`: Links competitions to associations
- `AssociationDetailsController.js`: Main controller for association details operations
- `BaseController.js`: Base controller with common functionality
- `ClubDetails.js`: Scrapes club details within associations
- `getClubsAssignedToAssociationInfo.js`: Gets club information for associations
- `getCompetitions.js`: Scrapes competition data
- `getGradeLadder.js`: Scrapes grade ladder information
- `index.js`: Module entry point

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, base controllers

## Dependencies

- Internal: Base controller modules, competition management
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
