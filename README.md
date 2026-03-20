# httptoolkit-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides AI assistants with full control over [HTTP Toolkit](https://httptoolkit.com/) — the powerful, open-source HTTP(S) debugging proxy.

Intercept, inspect, and debug HTTP traffic from browsers, Android/iOS devices, Docker containers, JVM processes, and more — all through natural language via your AI assistant.

## Features

- **Browser Interception** — Launch Chrome or Firefox with traffic automatically routed through the proxy
- **Android Interception** — Intercept device traffic via ADB or target specific apps with Frida (bypasses certificate pinning)
- **iOS Interception** — Intercept specific iOS apps via Frida on jailbroken devices
- **Docker Interception** — Attach to running Docker containers and capture all outgoing HTTP traffic
- **Terminal Interception** — Open intercepted terminal sessions or configure existing ones
- **JVM Attach** — Attach to running Java/Kotlin/Clojure processes
- **Electron Apps** — Launch Electron applications with interception enabled
- **HTTP Client** — Send HTTP requests through the proxy with full control over method, headers, and body
- **Server Management** — Query configuration, manage interceptors, and control the server lifecycle

## Prerequisites

- [HTTP Toolkit](https://httptoolkit.com/) server running locally (default: `http://127.0.0.1:45457`)
- Node.js >= 18

## Installation

### Using npx (recommended)

No installation required — just configure your MCP client:

```json
{
  "mcpServers": {
    "httptoolkit": {
      "command": "npx",
      "args": ["-y", "httptoolkit-mcp"]
    }
  }
}
```

### Global install

```bash
npm install -g httptoolkit-mcp
```

### From source

```bash
git clone https://github.com/fdciabdul/httptoolkit-mcp.git
cd httptoolkit-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to `~/.claude/settings.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "httptoolkit": {
      "command": "npx",
      "args": ["-y", "httptoolkit-mcp"]
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "httptoolkit": {
      "command": "npx",
      "args": ["-y", "httptoolkit-mcp"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HTK_SERVER_URL` | HTTP Toolkit server URL | `http://127.0.0.1:45457` |
| `HTK_SERVER_TOKEN` | Authentication token (if server requires one) | — |

Example with environment variables:

```json
{
  "mcpServers": {
    "httptoolkit": {
      "command": "npx",
      "args": ["-y", "httptoolkit-mcp"],
      "env": {
        "HTK_SERVER_URL": "http://127.0.0.1:45457",
        "HTK_SERVER_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Available Tools

### Server Management

| Tool | Description |
|------|-------------|
| `get_version` | Get the HTTP Toolkit server version |
| `get_config` | Get proxy configuration (certificates, DNS, system proxy) |
| `get_network_interfaces` | List all network interfaces |
| `trigger_update` | Trigger a server update check |
| `shutdown_server` | Shutdown the HTTP Toolkit server |

### Interceptor Management

| Tool | Description |
|------|-------------|
| `list_interceptors` | List all available interceptors and their status |
| `get_interceptor_metadata` | Get detailed metadata for a specific interceptor |
| `activate_interceptor` | Generic interceptor activation with custom options |
| `deactivate_interceptor` | Deactivate a running interceptor |

### Browser Interception

| Tool | Description |
|------|-------------|
| `intercept_chrome` | Launch a fresh Chrome window with interception |
| `intercept_firefox` | Launch a fresh Firefox window with interception |

### Terminal Interception

| Tool | Description |
|------|-------------|
| `intercept_fresh_terminal` | Open a new terminal with interception enabled |
| `intercept_existing_terminal` | Get commands to enable interception in an existing terminal |

### Docker Interception

| Tool | Description |
|------|-------------|
| `intercept_docker_container` | Attach to a running Docker container |

### Android Interception

| Tool | Description |
|------|-------------|
| `intercept_android_adb` | Intercept an Android device/emulator via ADB |
| `frida_android_setup` | Set up Frida on an Android device |
| `frida_android_launch` | Launch Frida server on an Android device |
| `frida_android_intercept` | Intercept a specific Android app via Frida |

### iOS Interception

| Tool | Description |
|------|-------------|
| `frida_ios_intercept` | Intercept a specific iOS app via Frida |

### Application Interception

| Tool | Description |
|------|-------------|
| `intercept_jvm` | Attach to a running JVM process |
| `intercept_electron` | Launch an Electron app with interception |

### HTTP Client

| Tool | Description |
|------|-------------|
| `send_http_request` | Send an HTTP request through the proxy |

## Usage Examples

Once configured, you can ask your AI assistant things like:

- *"List all available interceptors"*
- *"Intercept Chrome on port 8000"*
- *"Show me the connected Android devices"*
- *"Attach to the Docker container running my API"*
- *"Send a GET request to https://api.example.com/users"*
- *"Set up Frida on my Android device and intercept the target app"*
- *"Open an intercepted terminal session"*

## Architecture

```
┌─────────────────┐     stdio      ┌──────────────────┐    REST API    ┌─────────────────────┐
│   AI Assistant   │◄─────────────►│  httptoolkit-mcp  │◄────────────►│  httptoolkit-server  │
│ (Claude, etc.)   │     MCP       │   (this project)  │   :45457     │     (HTTP Toolkit)   │
└─────────────────┘               └──────────────────┘               └─────────────────────┘
                                                                              │
                                                                     ┌────────┴────────┐
                                                                     │  Mockttp Proxy   │
                                                                     │   :8000/45456    │
                                                                     └────────┬────────┘
                                                                              │
                                                              ┌───────────────┼───────────────┐
                                                              │               │               │
                                                         Browsers       Android/iOS      Docker
                                                                        Devices        Containers
```

## Credits

This project is an MCP interface for [HTTP Toolkit](https://httptoolkit.com/), created by [Tim Perry (@pimterry)](https://github.com/pimterry).

- **HTTP Toolkit** — [github.com/httptoolkit](https://github.com/httptoolkit)
- **HTTP Toolkit Server** — [github.com/httptoolkit/httptoolkit-server](https://github.com/httptoolkit/httptoolkit-server)
- **Tim Perry** — [github.com/pimterry](https://github.com/pimterry) — Creator & maintainer of HTTP Toolkit

HTTP Toolkit is a beautiful, open-source tool for debugging, testing, and building with HTTP(S). If you find it useful, consider [supporting the project](https://httptoolkit.com/pricing/).

## License

[MIT](LICENSE)
