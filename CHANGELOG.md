# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-03-28

### Added
- CHANGELOG.md for tracking version changes
- Production-ready logging system with environment-aware output
- Network intelligence and site latency widgets
- Top proxies and memory trend cards
- Locale-aware UI scaling and improved text wrapping
- Foxboard integration with refined card layouts

### Changed
- Disabled debug mode in production (`debugMode: false`)
- Cleaned up console.log/error/warn calls in production builds
- Optimized error handling to be silent in production while maintaining functionality
- Updated dashboard module with refined proxy empty texts
- Improved card layout and visual styling
- Adjusted help doc card layout and text overflow handling

### Fixed
- Corrected card header and styling issues
- Improved macOS build reliability and release channel detection
- Multiple bug fixes and stability improvements

### Removed
- Development console logs from production builds

### Security Notes
- Electron version remains at 28.2.0 in this release
- Known security vulnerability: CVE-2025-55305 (Code Injection via resource modification)
- Users are advised to assess their risk tolerance
- Electron upgrade to latest stable version (41.0.3+) is planned for future release to resolve this vulnerability

## [0.4.7] - 2024-03-19

### Security Advisory
- Electron version: 28.2.0
- Known vulnerability: CVE-2025-55305 (Code Injection via resource modification)
- Risk level: Medium
- Mitigation: Only install ClashFox from trusted sources; verify application signature
- Future action: Electron upgrade to 41.0.3+ planned for 1.0.0 release

### Added
- Multi-language support (English and Chinese)
- Tracker functionality for monitoring connections
- Foxboard integration
- Comprehensive dashboard features
- Network topology visualization
- Provider traffic overview

### Improved
- Error handling and logging
- Build system with multi-architecture support (x64, arm64, universal)
- Package validation scripts
- System tray menu functionality

### Fixed
- Multiple bug fixes and stability improvements

## [0.4.6] - 2024-03-15

### Added
- Kernel installation and update system
- Backup management
- Configuration import/export
- Rule provider support
- Enhanced UI/UX improvements

### Fixed
- Performance optimizations
- Memory leak fixes

## [0.4.5] - 2024-03-09

### Added
- Initial stable release features
- Mihomo kernel management
- Basic proxy control
- Configuration management
- System integration for macOS

### Known Issues
- Development mode logs present in production builds (fixed in 0.4.7)

---

## Version Guidelines

### Major Version (X.0.0)
- Breaking changes that require user action
- Major architectural changes
- Removed features

### Minor Version (0.X.0)
- New features added
- Significant improvements
- Backward compatible changes

### Patch Version (0.0.X)
- Bug fixes
- Small improvements
- Documentation updates
- Performance optimizations
