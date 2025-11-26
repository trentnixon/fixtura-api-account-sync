# Folder Overview

This folder contains the main service controller that orchestrates the worker operations. This controller manages the overall service flow and coordinates between different service modules.

## Files

- `controller.js`: Main service controller for orchestrating operations
  - `Controller_Club`: Full sync for club accounts
  - `Controller_Associations`: Full sync for association accounts
  - `Controller_UpdateAccountOnly`: On-demand account update (full sync without worker handoff)
  - `Controller_ClubDirect`: Direct club ID processing (bypasses account lookup) - **NEW**
  - `Controller_AssociationDirect`: Direct association ID processing (bypasses account lookup) - **NEW**

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Queue management, task processing

## Dependencies

- Internal: Queue and task processing modules
- External:
  - Winston (logging)
  - Bull (job queue)
