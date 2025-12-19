# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024

### Added
- Dynamic version reading from package.json in Sidebar
- Structured logging utility for consistent error handling
- File cleanup utility for temporary files
- File size and format validation in API routes
- Improved TypeScript types (ApiError, ApiResponse)
- Environment variable configuration example (.env.example)
- CHANGELOG.md for tracking changes

### Changed
- Replaced console.error/warn with structured logger throughout API routes
- Improved error messages with more context
- Enhanced error handling in all API endpoints

### Fixed
- Removed empty lines in Toast.tsx component
- Better error handling and validation in upload endpoint

## [1.0.0] - 2024

### Added
- Initial release
- Image Converter with batch processing
- Image Editor with crop, transform, filters, and AI background removal
- Vectorizer (Raster → SVG)
- AI Upscaler (2x and 4x models)
- Grid Builder with text overlays
- Video to GIF Converter
- Electron desktop app support
- Local processing (no cloud dependencies)
