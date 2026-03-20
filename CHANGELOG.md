# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/fdciabdul/httptoolkit-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fdciabdul/httptoolkit-mcp/releases/tag/v1.0.0
