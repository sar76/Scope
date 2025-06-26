# Scope - DOM Extraction Chrome Extension

A powerful Chrome extension for extracting, analyzing, and capturing UI elements from web pages. This extension provides comprehensive DOM analysis, advanced filtering, real-time highlighting, and screenshot capture capabilities.

## Features

### Core Functionality

- **DOM Element Collection**: Automatically collects interactive UI elements from web pages
- **Advanced Filtering**: Multi-stage filtering pipeline with visibility, spatial, and semantic analysis
- **Real-time Highlighting**: Visual feedback with scroll-resistant highlighting
- **LLM Integration**: AI-powered element analysis and classification using OpenAI
- **Screenshot Capture**: Capture and download screenshots of filtered elements
- **Storage Management**: Persistent storage of collected data and analysis results
- **Error Handling**: Comprehensive error handling and logging system

### Advanced Features

- **Debug Overlay**: Visual debugging interface showing filtering steps
- **Progress Tracking**: Real-time progress updates during collection and filtering
- **Configurable Settings**: Customizable filtering thresholds and behavior
- **Organized Downloads**: Screenshots organized by site and element type
- **Performance Optimized**: Efficient DOM traversal and processing

## Project Structure

```
DOMExtraction/
├── src/
│   ├── background/              # Background script (service worker)
│   │   ├── index.js            # Entry point and initialization
│   │   ├── messageHandler.js   # Message routing and handlers
│   │   └── storage.js          # Storage management
│   ├── content/                # Content script (main logic)
│   │   ├── index.js            # Main orchestrator and UI handlers
│   │   ├── filter/             # Advanced filtering system
│   │   │   ├── pipeline.js     # Multi-stage filter pipeline
│   │   │   ├── deduplication.js # Remove duplicate elements
│   │   │   ├── spatial.js      # Spatial relationship filtering
│   │   │   └── visibility.js   # Visibility and occlusion analysis
│   │   ├── services/           # External services integration
│   │   │   ├── llm.js          # OpenAI LLM integration
│   │   │   ├── embedding.js    # Text embedding for semantic analysis
│   │   │   └── screenshot.js   # Screenshot capture and processing
│   │   ├── utils/              # Utility functions and helpers
│   │   │   ├── collector.js    # DOM element collection
│   │   │   ├── dom.js          # DOM manipulation utilities
│   │   │   ├── highlight.js    # Element highlighting system
│   │   │   └── observer.js     # DOM mutation observation
│   │   └── visibility/         # Visibility calculation engine
│   │       ├── geometry.js     # Geometric calculations
│   │       └── visibility.js   # Visibility analysis
│   ├── popup/                  # Extension popup interface
│   │   ├── index.js            # Popup entry point
│   │   ├── popup.html          # Popup UI markup
│   │   ├── components/         # UI components
│   │   │   └── popupController.js # Main popup controller
│   │   └── services/           # Popup-specific services
│   │       ├── messaging.js    # Communication with content script
│   │       └── storage.js      # Local storage management
│   └── shared/                 # Shared modules and utilities
│       ├── constants.js        # Constants and message actions
│       ├── types.js            # TypeScript-style type definitions
│       ├── config.js           # Configuration management
│       ├── errors.js           # Error handling and logging
│       ├── messaging.js        # Shared messaging utilities
│       └── utils.js            # Common utility functions
├── build/                      # Build output directory
├── manifest.json               # Extension manifest
├── package.json                # Dependencies and build scripts
├── webpack.config.js           # Webpack build configuration
├── tsconfig.json               # TypeScript configuration
├── CONFIGURATION.md            # Detailed configuration guide
└── README.md                   # This file
```

## Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- Chrome browser
- OpenAI API key (for LLM features)

### Installation Steps

1. **Clone and Install Dependencies**

   ```bash
   git clone <repository-url>
   cd DOMExtraction
   npm install
   ```

2. **Environment Configuration**

   ```bash
   # Copy environment template
   cp env.example .env

   # Add your OpenAI API key
   echo "OPENAI_API_KEY=your_api_key_here" >> .env
   ```

3. **Build the Extension**

   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build` directory

## Usage Guide

### Basic Workflow

1. **Navigate to a Web Page**

   - Open any web page you want to analyze
   - Click the Scope extension icon

2. **Start DOM Inspection**

   - Click "Run Inspect" in the popup
   - The extension will collect interactive elements
   - You'll see a notification when collection is complete

3. **Apply Filtering**

   - Click "Run Filter" to apply comprehensive filtering
   - The extension will show filtering progress
   - Results are displayed in an overlay on the page

4. **Capture Screenshots (Optional)**
   - Click "Download Components" to capture screenshots
   - Screenshots are organized by site and element type
   - Files are saved to `Desktop/Scope/webuicomponents/`

### Advanced Features

#### Debug Overlay

- Toggle debug overlay to see filtering steps
- Visual representation of element relationships
- Real-time filtering progress

#### Custom Filtering

- Adjust filtering thresholds in configuration
- Modify visibility and spatial criteria
- Customize element selection criteria

## Configuration

### Environment Variables

```bash
# Required for LLM features
OPENAI_API_KEY=your_openai_api_key

# Optional: Custom model configuration
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000
```

### Extension Settings

Key configuration options in `src/shared/config.js`:

```javascript
// Filtering thresholds
VISIBILITY_THRESHOLD: 0.5,        // Minimum visibility ratio
SPATIAL_DISTANCE_THRESHOLD: 50,   // Minimum distance between elements
SEMANTIC_SIMILARITY_THRESHOLD: 0.8, // Semantic similarity threshold

// Screenshot settings
SCREENSHOT_DELAY: 200,            // Delay between screenshots (ms)
DOWNLOAD_PATH: "webuicomponents", // Download folder name

// Performance settings
BATCH_SIZE: 10,                   // Elements processed per batch
MAX_ELEMENTS: 1000,               // Maximum elements to collect
```

## Filtering Pipeline

The extension uses a sophisticated multi-stage filtering pipeline:

### Stage 1: Initial Collection

- **Element Discovery**: Collects all interactive elements (buttons, links, inputs)
- **Basic Filtering**: Removes hidden, disabled, or invalid elements
- **Selector Generation**: Creates unique CSS selectors for each element

### Stage 2: Visibility Analysis

- **Viewport Check**: Ensures elements are within the viewport
- **Occlusion Detection**: Identifies elements hidden by other elements
- **Opacity Analysis**: Checks for transparent or invisible elements

### Stage 3: Spatial Filtering

- **Distance Calculation**: Measures spatial relationships between elements
- **Clustering**: Groups nearby elements to reduce redundancy
- **Layout Analysis**: Considers element positioning and alignment

### Stage 4: Semantic Analysis (LLM)

- **Text Extraction**: Extracts meaningful text from elements
- **Semantic Embedding**: Creates vector representations of element content
- **Similarity Scoring**: Identifies semantically similar elements
- **Classification**: Categorizes elements by function and purpose

### Stage 5: Deduplication

- **Exact Matching**: Removes identical elements
- **Fuzzy Matching**: Identifies near-duplicate elements
- **Context Analysis**: Considers surrounding context for uniqueness

## Screenshot System

### Features

- **Element-Specific Capture**: Crops screenshots to individual elements
- **High-DPI Support**: Handles Retina and high-DPI displays correctly
- **Scroll Handling**: Captures elements even when scrolled out of view
- **Organized Downloads**: Files organized by site and element type

### File Naming Convention

```
{index}_{tagName}_{width}x{height}_{sanitizedText}.png
```

Example: `1_button_120x40_Search.png`

### Download Structure

```
webuicomponents/
└── {domain}_{path}/
    ├── 1_button_120x40_Search.png
    ├── 2_link_200x30_Home.png
    └── 3_input_300x35_Email.png
```

## Architecture

### Background Script (Service Worker)

- **Message Routing**: Handles communication between popup and content script
- **Screenshot Capture**: Uses `chrome.tabs.captureVisibleTab` API
- **Storage Management**: Manages extension data persistence
- **Error Handling**: Centralized error logging and recovery

### Content Script

- **DOM Analysis**: Main logic for element collection and analysis
- **Real-time Updates**: Responds to DOM changes and user interactions
- **Visual Feedback**: Manages highlighting and overlay displays
- **Performance Optimization**: Efficient DOM traversal and processing

### Popup Interface

- **User Controls**: Start/stop inspection, filtering, and downloads
- **Progress Display**: Real-time progress updates and status
- **Results View**: Display collected elements and analysis results
- **Configuration**: Access to settings and preferences

## Development

### Available Scripts

```bash
npm run build          # Production build
npm run build:dev      # Development build with source maps
npm run watch          # Watch mode for development
npm run clean          # Clean build directory
npm run lint           # Run linting (if configured)
```

### Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run watch` for automatic rebuilding
3. Reload the extension in Chrome Extensions page
4. Test changes on target websites

### Debugging

- **Content Script**: Check browser console on target page
- **Popup**: Right-click popup → Inspect
- **Background**: Chrome Extensions → Service Worker
- **Logs**: Look for `[Scope]` prefixed messages

## Error Handling

### Error Types

- **Collection Errors**: DOM access issues, permission problems
- **Filtering Errors**: LLM API failures, processing timeouts
- **Screenshot Errors**: Capture failures, download issues
- **Storage Errors**: Data persistence problems

### Error Recovery

- **Automatic Retries**: Failed operations are retried automatically
- **Graceful Degradation**: Features disabled if dependencies fail
- **User Feedback**: Clear error messages and recovery suggestions
- **Logging**: Comprehensive error logging for debugging

## Permissions

The extension requires the following permissions:

- **activeTab**: Access to current tab for DOM analysis
- **storage**: Save user preferences and collected data
- **tabs**: Screenshot capture functionality
- **downloads**: Save screenshot files to user's computer

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add comprehensive error handling
- Include detailed logging for debugging
- Test on multiple websites and browsers
- Update documentation for new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

### Common Issues

- **Extension not working**: Check if content script is loaded (look for notification)
- **Screenshots failing**: Ensure page is fully loaded and elements are visible
- **LLM features not working**: Verify OpenAI API key is configured correctly
- **Performance issues**: Reduce `MAX_ELEMENTS` or `BATCH_SIZE` in config

### Getting Help

- Check the [CONFIGURATION.md](CONFIGURATION.md) for detailed setup
- Review console logs for error messages
- Create an issue with detailed reproduction steps
- Include browser version and target website information

## Version History

### v1.0.0

- Initial release with basic DOM collection
- Multi-stage filtering pipeline
- Screenshot capture and download
- LLM integration for semantic analysis
- Comprehensive error handling and logging

---

**Built with ❤️ for web developers and UI researchers**
