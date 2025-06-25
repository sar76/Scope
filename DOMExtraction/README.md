# Scope - DOM Extraction Chrome Extension

A powerful Chrome extension for extracting and analyzing UI elements from web pages. This extension provides comprehensive DOM analysis, filtering, and visualization capabilities.

## Features

- **DOM Element Collection**: Automatically collects UI elements from web pages
- **Advanced Filtering**: Multiple filtering strategies including visibility, spatial, and semantic filtering
- **Real-time Highlighting**: Visual feedback for selected elements
- **LLM Integration**: AI-powered element analysis and classification
- **Storage Management**: Persistent storage of collected data
- **Error Handling**: Comprehensive error handling and logging system

## Project Structure

```
DOMExtraction/
├── src/
│   ├── background/          # Background script (service worker)
│   │   ├── index.js         # Entry point
│   │   ├── messageHandler.js # Message routing
│   │   └── storage.js       # Storage management
│   ├── content/             # Content script
│   │   ├── index.js         # Main orchestrator
│   │   ├── filter/          # Filtering modules
│   │   │   ├── pipeline.js  # Filter pipeline
│   │   │   ├── deduplication.js
│   │   │   ├── spatial.js
│   │   │   └── visibility.js
│   │   ├── services/        # External services
│   │   │   └── llm.js       # LLM integration
│   │   ├── utils/           # Utility functions
│   │   │   ├── collector.js # Element collection
│   │   │   ├── dom.js       # DOM utilities
│   │   │   ├── highlight.js # Highlighting
│   │   │   ├── messaging.js # Messaging utilities
│   │   │   └── observer.js  # DOM observation
│   │   └── visibility/      # Visibility calculations
│   │       ├── geometry.js
│   │       └── visibility.js
│   ├── popup/               # Extension popup
│   │   ├── index.js         # Entry point
│   │   ├── popup.html       # Popup UI
│   │   ├── components/      # UI components
│   │   │   └── popupController.js
│   │   └── services/        # Popup services
│   │       ├── messaging.js
│   │       └── storage.js
│   └── shared/              # Shared modules
│       ├── constants.js     # Constants and configuration
│       ├── types.js         # Type definitions
│       ├── config.js        # Configuration management
│       ├── errors.js        # Error handling
│       └── utils.js         # Shared utilities
├── build/                   # Build output
├── manifest.json            # Extension manifest
├── package.json             # Dependencies and scripts
├── webpack.config.js        # Build configuration
└── env.example              # Environment configuration example
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp env.example .env
   ```
4. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
5. Build the extension:
   ```bash
   npm run build
   ```
6. Load the extension in Chrome:
   - Open Chrome Extensions page (`chrome://extensions/`)
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `build` directory

## Development

### Available Scripts

- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run watch` - Watch mode for development
- `npm run clean` - Clean build directory

### Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run watch` for automatic rebuilding
3. Reload the extension in Chrome Extensions page
4. Test your changes

## Architecture

### Background Script

- Handles message routing between content script and popup
- Manages extension storage
- Coordinates extension lifecycle

### Content Script

- Main orchestrator for DOM analysis
- Manages element collection, filtering, and highlighting
- Handles real-time DOM observation

### Popup

- User interface for extension control
- Displays collected data and analysis results
- Provides configuration options

### Shared Modules

- Common utilities and constants
- Error handling and logging
- Configuration management

## Configuration

The extension can be configured through several mechanisms:

1. **Environment Variables**: API keys and environment-specific settings
2. **Constants**: Filtering thresholds, selectors, and performance settings
3. **Storage**: User preferences and collected data

## Error Handling

The extension includes a comprehensive error handling system:

- Custom error classes for different error types
- Centralized error logging
- Error recovery mechanisms
- User-friendly error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please create an issue in the repository.
