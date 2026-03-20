# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-03-20

### Added

- **Live traffic capture** — New `capture_traffic` tool that subscribes to the existing HTTP Toolkit UI session via WebSocket and captures all intercepted HTTP exchanges in real-time, including request/response headers and bodies
- **Auto-detect auth token** — Automatically reads `HTK_SERVER_TOKEN` from the running httptoolkit-server process environment (`/proc/{pid}/environ`), enabling zero-config usage with the HTTP Toolkit desktop app
- **Auto-detect CORS origin** — Automatically switches to `https://app.httptoolkit.tech` origin when auth token is present (required by prod builds)
- **Session auto-discovery** — Probes server logs for active session UUIDs and validates them via WebSocket connection test
- `ws` dependency for WebSocket-based traffic capture

### Changed

- `capture_traffic` now subscribes to the existing UI session instead of creating a new one, so it captures traffic from intercepted browsers, Android devices, Docker containers, etc.
- Request subscription changed from `requestInitiated` to `requestReceived` to include request body
- Response bodies are now included in captured exchanges (truncated at 4KB)
- Request bodies are included in captured exchanges (truncated at 2KB)

### Fixed

- CORS authentication for HTTP Toolkit desktop app (prod builds)

## [1.0.0] - 2026-03-20

### Added

- Initial release of httptoolkit-mcp
- Server management tools: `get_version`, `get_config`, `get_network_interfaces`, `trigger_update`, `shutdown_server`
- Interceptor management: `list_interceptors`, `get_interceptor_metadata`, `activate_interceptor`, `deactivate_interceptor`
- Browser interception: `intercept_chrome`, `intercept_firefox`
- Terminal interception: `intercept_fresh_terminal`, `intercept_existing_terminal`
- Docker interception: `intercept_docker_container`
- Android interception via ADB: `intercept_android_adb`
- Android interception via Frida: `frida_android_setup`, `frida_android_launch`, `frida_android_intercept`
- iOS interception via Frida: `frida_ios_intercept`
- JVM process attachment: `intercept_jvm`
- Electron app interception: `intercept_electron`
- HTTP client: `send_http_request` with full response parsing (status, headers, body)
- CORS-compatible client with `Origin: http://localhost` header for dev builds
- GraphQL-based `deactivate_interceptor` (not available via REST API)
- Environment variable configuration: `HTK_SERVER_URL`, `HTK_SERVER_TOKEN`

[Unreleased]: https://github.com/fdciabdul/httptoolkit-mcp/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/fdciabdul/httptoolkit-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fdciabdul/httptoolkit-mcp/releases/tag/v1.0.0
