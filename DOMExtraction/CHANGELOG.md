# Changelog

All notable changes to the Scope DOM Extraction Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive error handling system with custom error classes
- Centralized configuration management
- Shared utilities for common operations
- Improved messaging system with timeout handling
- ESLint configuration for code quality
- TypeScript configuration for future migration
- Development guide with best practices
- Environment configuration example
- Performance optimizations in webpack build

### Changed

- Restructured project organization for better maintainability
- Moved messaging utilities to shared directory
- Updated manifest.json to use correct bundle file references
- Improved webpack configuration with better chunk splitting
- Enhanced package.json with better scripts and metadata
- Removed hardcoded API key from constants

### Fixed

- Manifest file references to match actual build output
- Import paths for better module resolution
- Error handling in content script
- Build process optimization

### Security

- Removed hardcoded API key from source code
- Added environment variable support for sensitive data
- Improved input sanitization utilities

## [1.0.0] - 2024-01-01

### Added

- Initial release of Scope DOM Extraction Chrome Extension
- DOM element collection functionality
- Advanced filtering pipeline
- LLM integration for element analysis
- Real-time highlighting system
- Storage management
- Popup interface for user interaction
- Background script for coordination

### Features

- Automatic UI element detection
- Multiple filtering strategies (visibility, spatial, semantic)
- AI-powered element classification
- Visual feedback for selected elements
- Persistent data storage
- Cross-tab communication
- Error recovery mechanisms
