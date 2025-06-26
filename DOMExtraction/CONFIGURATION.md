# Scope Extension Configuration Guide

This guide explains how to customize the Scope Chrome extension settings, particularly the download location for screenshots.

## Download Location Configuration

### Default Location

By default, screenshots are saved to: `~/Desktop/Scope/webuicomponents`

### How to Change Download Location

1. **Open the configuration file:**
   Navigate to `src/shared/config.js` in the extension source code.

2. **Modify the download path:**
   Find the `DOWNLOAD_CONFIG` section and change the `DEFAULT_FOLDER` value:

   ```javascript
   export const DOWNLOAD_CONFIG = {
     // Change this line to your preferred location
     DEFAULT_FOLDER: "Desktop/Scope/webuicomponents",

     // Examples of alternative locations:
     // DEFAULT_FOLDER: "Documents/Scope/Screenshots",
     // DEFAULT_FOLDER: "Downloads/Scope",
     // DEFAULT_FOLDER: "Desktop/WebComponents",
   };
   ```

3. **Rebuild the extension:**
   After making changes, rebuild the extension:

   ```bash
   npm run build
   ```

4. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Find "Scope" extension
   - Click the refresh/reload button

### Path Examples

- **Desktop folder:** `"Desktop/Scope/webuicomponents"`
- **Documents folder:** `"Documents/Scope/Screenshots"`
- **Downloads folder:** `"Downloads/Scope"`
- **Custom folder:** `"MyProjects/WebComponents"`

### File Naming Configuration

You can also customize how files are named:

```javascript
export const DOWNLOAD_CONFIG = {
  DEFAULT_FOLDER: "Desktop/Scope/webuicomponents",

  // File naming configuration
  FILENAME_PREFIX: "scope_", // Prefix for all files
  FILENAME_SUFFIX: "_screenshots", // Suffix for all files

  // ZIP file configuration
  ZIP_COMPRESSION: true,
  ZIP_LEVEL: 6, // 0-9, higher = more compression but slower
};
```

### Example Output

With default settings, a screenshot from `https://example.com` would be saved as:

```
~/Desktop/Scope/webuicomponents/scope_example_com_screenshots_2024-01-15T10-30-45.zip
```

## Other Configuration Options

### UI Configuration

Customize highlight colors and animations:

```javascript
export const UI_CONFIG = {
  HIGHLIGHT_COLOR: "#007bff", // Blue highlight
  HIGHLIGHT_BORDER_COLOR: "#0056b3", // Darker blue border
  HIGHLIGHT_OPACITY: 0.3, // 30% opacity

  DEBUG_COLOR: "#ff6b6b", // Red debug highlight
  DEBUG_BORDER_COLOR: "#e74c3c", // Darker red border
  DEBUG_OPACITY: 0.2, // 20% opacity
};
```

### Performance Configuration

Adjust processing speeds and memory usage:

```javascript
export const PERFORMANCE_CONFIG = {
  SCREENSHOT_DELAY: 100, // ms between screenshots
  SCREENSHOT_TIMEOUT: 5000, // ms timeout for capture
  BATCH_SIZE: 5, // Elements processed per batch
  DELAY_BETWEEN_BATCHES: 100, // ms between batches
  MAX_SCREENSHOTS_IN_MEMORY: 50, // Max screenshots to keep in memory
};
```

### Feature Configuration

Enable/disable specific features:

```javascript
export const FEATURE_CONFIG = {
  ENABLE_SCREENSHOTS: true, // Enable screenshot capture
  ENABLE_DEBUG_MODE: true, // Enable debug overlay
  ENABLE_PROGRESS_BAR: true, // Show progress bar
  ENABLE_AUTO_SAVE: true, // Auto-save results

  SCREENSHOT_QUALITY: 0.9, // Image quality (0-1)
  SCREENSHOT_FORMAT: "image/png", // "image/png" or "image/jpeg"

  CREATE_SUBFOLDERS: true, // Create subfolders for each site
  USE_SITE_URL_AS_FOLDER: true, // Use site URL as folder name
  INCLUDE_TIMESTAMP: true, // Include timestamp in filename
};
```

## Troubleshooting

### Files Not Saving to Expected Location

1. Check that the path in `config.js` is correct
2. Ensure the extension has been rebuilt and reloaded
3. Check Chrome's download settings at `chrome://settings/downloads`
4. Verify the folder exists and is writable

### Permission Issues

If you encounter permission errors:

1. Make sure the target folder exists
2. Check folder permissions
3. Try using a different location (e.g., `Downloads/Scope`)

### Chrome Download Settings

The extension uses Chrome's download API, so the actual save location may be affected by:

- Chrome's default download location
- "Ask where to save each file before downloading" setting
- Download restrictions for certain file types

## Notes

- All paths are relative to your user home directory (`~`)
- The extension will create the target folder if it doesn't exist
- If a file with the same name exists, Chrome will automatically add a number suffix
- Changes to configuration require rebuilding and reloading the extension
