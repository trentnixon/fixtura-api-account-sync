# Folder Overview

This folder contains the main service controller that orchestrates the worker operations. This controller manages the overall service flow and coordinates between different service modules.

## Files

- `controller.js`: Main service controller for orchestrating operations

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Queue management, task processing

## Dependencies

- Internal: Queue and task processing modules
- External:
  - Winston (logging)
  - Bull (job queue)
