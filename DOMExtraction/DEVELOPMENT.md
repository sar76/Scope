# Development Guide

This document provides guidelines and best practices for developing the Scope DOM Extraction Chrome Extension.

## Code Style

### JavaScript

- Use ES6+ features (const, let, arrow functions, template literals)
- Prefer async/await over Promises
- Use meaningful variable and function names
- Add JSDoc comments for all public functions
- Keep functions small and focused (max 50 lines)
- Use early returns to reduce nesting

### File Organization

- One class/component per file
- Use descriptive file names
- Group related functionality in directories
- Keep shared code in the `shared` directory

## Error Handling

### Guidelines

- Always use try-catch blocks for async operations
- Use the centralized error handling system (`@shared/errors.js`)
- Log errors with appropriate context
- Provide user-friendly error messages
- Don't swallow errors silently

### Example

```javascript
import { errorLogger, withErrorHandling } from "@shared/errors.js";

const myFunction = withErrorHandling(async (param) => {
  // Your async code here
  const result = await someAsyncOperation(param);
  return result;
}, "myFunction");
```

## Messaging

### Guidelines

- Use the shared messaging utilities (`@shared/messaging.js`)
- Always handle message timeouts
- Validate message format before processing
- Use typed message actions from constants

### Example

```javascript
import { sendMessageWithTimeout, MESSAGE_ACTIONS } from "@shared/messaging.js";

const response = await sendMessageWithTimeout(
  {
    action: MESSAGE_ACTIONS.RUN_INSPECT,
    data: {
      /* your data */
    },
  },
  5000
);
```

## Testing

### Guidelines

- Write unit tests for utility functions
- Test error scenarios
- Mock external dependencies
- Use descriptive test names

### Example Test Structure

```javascript
describe("Utility Functions", () => {
  describe("calculateIoU", () => {
    it("should return 0 for non-overlapping rectangles", () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 20, width: 10, height: 10 };
      expect(calculateIoU(rect1, rect2)).toBe(0);
    });
  });
});
```

## Performance

### Guidelines

- Use debouncing for frequent operations
- Implement proper cleanup in event listeners
- Avoid memory leaks in long-running processes
- Use efficient DOM queries
- Batch operations when possible

### Example

```javascript
import { debounce } from "@shared/utils.js";

const debouncedHandler = debounce((event) => {
  // Handle the event
}, 300);

element.addEventListener("scroll", debouncedHandler);
```

## Security

### Guidelines

- Never store sensitive data in localStorage
- Validate all user inputs
- Sanitize data before storage
- Use environment variables for API keys
- Implement proper CSP headers

### Example

```javascript
import { sanitizeString } from "@shared/utils.js";

const userInput = sanitizeString(rawInput);
```

## Chrome Extension Specific

### Guidelines

- Follow Chrome Extension Manifest V3 guidelines
- Use service workers for background scripts
- Implement proper permission handling
- Test in incognito mode
- Handle extension updates gracefully

### Best Practices

- Keep background scripts lightweight
- Use content scripts for DOM manipulation
- Implement proper message passing
- Handle extension lifecycle events

## Debugging

### Tools

- Chrome DevTools for content scripts
- Extension page for background scripts
- Console logging with proper levels
- Error tracking and reporting

### Debug Mode

```javascript
import { CONFIG } from "@shared/config.js";

if (CONFIG.env.debug) {
  console.log("Debug information:", data);
}
```

## Build Process

### Development

```bash
npm run build:dev  # Development build
npm run watch      # Watch mode
npm run lint       # Code linting
npm run type-check # Type checking
```

### Production

```bash
npm run build      # Production build
npm run clean      # Clean build directory
```

## Deployment

### Steps

1. Run production build
2. Test in Chrome
3. Create ZIP file from build directory
4. Upload to Chrome Web Store
5. Update version in manifest.json

### Version Management

- Use semantic versioning
- Update version in package.json and manifest.json
- Document changes in CHANGELOG.md

## Contributing

### Pull Request Process

1. Create feature branch
2. Make changes following guidelines
3. Add tests if applicable
4. Update documentation
5. Submit pull request

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Error handling is implemented
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] Performance is considered
- [ ] Security is addressed

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/devguide/)
- [Webpack Documentation](https://webpack.js.org/)
- [ESLint Rules](https://eslint.org/docs/rules/)
