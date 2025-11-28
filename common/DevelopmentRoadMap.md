# Development Roadmap – Common Utilities and Base Classes

This file tracks **progress, priorities, and recommendations** for the common utilities and base classes. It should remain **clean and high-level**, while detailed planning lives in `Tickets.md`.

---

## ✅ Completed

- [x] BaseController with browser management and disposal pattern
- [x] Dependency injection module for Puppeteer instances
- [x] Account status update functionality (isUpdating flag)
- [x] Data collection CRUD operations (create, update)
- [x] Query string builders for API relations (associations, clubs, competitions)
- [x] Disposable base class for resource cleanup
- [x] Proxy configuration support for Puppeteer
- [x] EventEmitter listener limit configuration

---

## ⏳ To Do (easy → hard)

1. [ ] **BaseController Enhancements**
   - Add error handling wrapper methods
   - Implement logging integration
   - Add configuration options for disposal behavior
   - (see TKT-2025-XXX for details)

2. [ ] **Dependency Management Improvements**
   - Add dependency injection container pattern
   - Implement dependency lifecycle management
   - Add dependency validation and health checks
   - (see TKT-2025-XXX for details)

3. [ ] **Resource Management**
   - Enhance disposable resource tracking
   - Add resource leak detection
   - Implement resource cleanup monitoring
   - (see TKT-2025-XXX for details)

4. [ ] **API Integration Enhancements**
   - Add retry logic for API operations
   - Implement API response caching
   - Add API error handling and recovery
   - (see TKT-2025-XXX for details)

5. [ ] **Advanced Features**
   - Add support for dependency mocking in tests
   - Implement dependency versioning
   - Add dependency usage analytics
   - (see TKT-2025-XXX for details)

---

## 💡 Recommendations

- Consider implementing a proper dependency injection container for better testability
- Add comprehensive unit tests for BaseController and dependencies
- Implement dependency health monitoring and alerting
- Add support for dependency configuration presets
- Consider adding dependency usage tracking and analytics
- Implement graceful degradation for dependency failures
- Add comprehensive documentation for dependency APIs
- Consider implementing dependency caching for performance
- Add support for dependency lifecycle hooks
- Consider implementing dependency validation and type checking

---

### Example Usage

* Mark off items as they are completed.
* Reorder tasks so easier jobs always appear first.
* Update when scope changes or new requirements arise.
* Cross-reference each task with its ticket for detailed breakdowns and discussions.

