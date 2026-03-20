#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { HttpToolkitClient } from './httptoolkit-client.js';
import { TrafficCapture } from './traffic-capture.js';

const client = new HttpToolkitClient(
  process.env.HTK_SERVER_URL,
  process.env.HTK_SERVER_TOKEN
);

const trafficCapture = new TrafficCapture(
  process.env.HTK_ADMIN_URL
);

const server = new McpServer({
  name: 'httptoolkit',
  version: '1.0.0',
});

// Helper to return JSON text content
function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ============================================================
// Server Management Tools
// ============================================================

server.registerTool(
  'get_version',
  {
    title: 'Get Server Version',
    description: 'Get the current HTTP Toolkit server version',
    inputSchema: z.object({}),
  },
  async () => jsonResult(await client.getVersion())
);

server.registerTool(
  'get_config',
  {
    title: 'Get Proxy Configuration',
    description:
      'Get HTTP Toolkit proxy configuration including certificate paths, network interfaces, system proxy, and DNS servers',
    inputSchema: z.object({
      proxyPort: z.number().optional().describe('Proxy port number'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.getConfig(proxyPort))
);

server.registerTool(
  'get_network_interfaces',
  {
    title: 'Get Network Interfaces',
    description: 'List all network interfaces on the system',
    inputSchema: z.object({}),
  },
  async () => jsonResult(await client.getNetworkInterfaces())
);

server.registerTool(
  'trigger_update',
  {
    title: 'Trigger Server Update',
    description: 'Trigger an update check for the HTTP Toolkit server',
    inputSchema: z.object({}),
  },
  async () => jsonResult(await client.triggerUpdate())
);

server.registerTool(
  'shutdown_server',
  {
    title: 'Shutdown Server',
    description: 'Shutdown the HTTP Toolkit server. WARNING: This will stop all interception.',
    inputSchema: z.object({}),
  },
  async () => jsonResult(await client.shutdownServer())
);

// ============================================================
// Interceptor Management Tools
// ============================================================

server.registerTool(
  'list_interceptors',
  {
    title: 'List Interceptors',
    description:
      'List all available HTTP traffic interceptors (browsers, terminals, mobile devices, Docker, etc.) and their activation status',
    inputSchema: z.object({
      proxyPort: z.number().optional().describe('Proxy port to check active status against'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.getInterceptors(proxyPort))
);

server.registerTool(
  'get_interceptor_metadata',
  {
    title: 'Get Interceptor Metadata',
    description:
      'Get detailed metadata for a specific interceptor. Returns available targets like Docker containers, Android devices, JVM processes, etc.',
    inputSchema: z.object({
      id: z.string().describe('Interceptor ID (e.g. "fresh-chrome", "android-adb", "docker-attach", "android-frida", "ios-frida", "attach-jvm")'),
      subId: z.string().optional().describe('Sub-ID for more specific metadata (e.g. a Frida host ID to get its app targets)'),
    }),
  },
  async ({ id, subId }) => jsonResult(await client.getInterceptorMetadata(id, subId))
);

server.registerTool(
  'deactivate_interceptor',
  {
    title: 'Deactivate Interceptor',
    description: 'Deactivate a running interceptor and stop capturing its traffic',
    inputSchema: z.object({
      id: z.string().describe('Interceptor ID to deactivate'),
      proxyPort: z.number().describe('Proxy port the interceptor is active on'),
    }),
  },
  async ({ id, proxyPort }) => {
    const result = await client.deactivateInterceptor(id, proxyPort);
    return jsonResult({ success: result });
  }
);

// ============================================================
// Browser Interceptors
// ============================================================

server.registerTool(
  'intercept_chrome',
  {
    title: 'Intercept Chrome Browser',
    description: 'Launch a fresh independent Chrome window with all HTTP(S) traffic intercepted. The browser uses an isolated profile so it won\'t affect your normal browsing.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.activateInterceptor('fresh-chrome', proxyPort))
);

server.registerTool(
  'intercept_firefox',
  {
    title: 'Intercept Firefox Browser',
    description: 'Launch a fresh independent Firefox window with all HTTP(S) traffic intercepted. Uses an isolated profile.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.activateInterceptor('fresh-firefox', proxyPort))
);

// ============================================================
// Terminal Interceptors
// ============================================================

server.registerTool(
  'intercept_fresh_terminal',
  {
    title: 'Open Intercepted Terminal',
    description: 'Open a new terminal window where all launched processes and Docker containers will have their HTTP(S) traffic intercepted automatically.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.activateInterceptor('fresh-terminal', proxyPort))
);

server.registerTool(
  'intercept_existing_terminal',
  {
    title: 'Intercept Existing Terminal',
    description: 'Get a command to run in an existing terminal to start intercepting HTTP(S) traffic from processes launched in that terminal. Returns shell-specific commands for bash, zsh, fish, etc.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
    }),
  },
  async ({ proxyPort }) => jsonResult(await client.activateInterceptor('existing-terminal', proxyPort))
);

// ============================================================
// Docker Interceptor
// ============================================================

server.registerTool(
  'intercept_docker_container',
  {
    title: 'Attach to Docker Container',
    description: 'Intercept all HTTP(S) traffic from a running Docker container. Injects proxy settings into the container to capture all outgoing HTTP traffic.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      containerId: z.string().describe('Docker container ID to attach to. Use get_interceptor_metadata with id "docker-attach" to list available containers.'),
    }),
  },
  async ({ proxyPort, containerId }) =>
    jsonResult(await client.activateInterceptor('docker-attach', proxyPort, { containerId }))
);

// ============================================================
// Android Interceptors
// ============================================================

server.registerTool(
  'intercept_android_adb',
  {
    title: 'Intercept Android Device via ADB',
    description: 'Intercept HTTP(S) traffic from an Android device or emulator connected via ADB. Automatically injects system HTTPS certificates into rooted devices and most emulators.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      deviceId: z.string().describe('ADB device ID. Use get_interceptor_metadata with id "android-adb" to list connected devices.'),
      enableSocks: z.boolean().optional().describe('Enable SOCKS proxy support (default: false)'),
    }),
  },
  async ({ proxyPort, deviceId, enableSocks }) =>
    jsonResult(await client.activateInterceptor('android-adb', proxyPort, { deviceId, enableSocks }))
);

server.registerTool(
  'frida_android_setup',
  {
    title: 'Setup Android Frida Host',
    description: 'Set up a Frida host on an Android device connected via ADB. This prepares the device for app-level interception by installing the Frida server and CA certificate.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port'),
      hostId: z.string().describe('Frida host ID. Use get_interceptor_metadata with id "android-frida" to list available hosts.'),
    }),
  },
  async ({ proxyPort, hostId }) =>
    jsonResult(await client.activateInterceptor('android-frida', proxyPort, { action: 'setup', hostId }))
);

server.registerTool(
  'frida_android_launch',
  {
    title: 'Launch Android Frida Server',
    description: 'Launch the Frida server on an Android device. Must run frida_android_setup first.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port'),
      hostId: z.string().describe('Frida host ID'),
    }),
  },
  async ({ proxyPort, hostId }) =>
    jsonResult(await client.activateInterceptor('android-frida', proxyPort, { action: 'launch', hostId }))
);

server.registerTool(
  'frida_android_intercept',
  {
    title: 'Intercept Android App via Frida',
    description: 'Intercept a specific Android app using Frida dynamic instrumentation. Automatically disables most certificate pinning. Requires a rooted device with Frida server running (use frida_android_setup and frida_android_launch first).',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      hostId: z.string().describe('Frida host ID'),
      targetId: z.string().describe('Target app identifier. Use get_interceptor_metadata with id "android-frida" and subId set to the hostId to list available app targets.'),
      enableSocks: z.boolean().optional().describe('Enable SOCKS proxy support (default: false)'),
    }),
  },
  async ({ proxyPort, hostId, targetId, enableSocks }) =>
    jsonResult(await client.activateInterceptor('android-frida', proxyPort, {
      action: 'intercept', hostId, targetId, enableSocks
    }))
);

// ============================================================
// iOS Interceptor (Frida)
// ============================================================

server.registerTool(
  'frida_ios_intercept',
  {
    title: 'Intercept iOS App via Frida',
    description: 'Intercept a specific iOS app using Frida dynamic instrumentation. Automatically disables most certificate pinning. Requires a jailbroken device running Frida Server connected via USB.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      hostId: z.string().describe('Frida host ID. Use get_interceptor_metadata with id "ios-frida" to list available hosts.'),
      targetId: z.string().describe('Target app identifier. Use get_interceptor_metadata with id "ios-frida" and subId set to the hostId to list available app targets.'),
      enableSocks: z.boolean().optional().describe('Enable SOCKS proxy support (default: false)'),
    }),
  },
  async ({ proxyPort, hostId, targetId, enableSocks }) =>
    jsonResult(await client.activateInterceptor('ios-frida', proxyPort, {
      action: 'intercept', hostId, targetId, enableSocks
    }))
);

// ============================================================
// JVM Interceptor
// ============================================================

server.registerTool(
  'intercept_jvm',
  {
    title: 'Attach to JVM Process',
    description: 'Attach to a running JVM process (Java, Kotlin, Clojure, etc.) to intercept all its HTTP(S) traffic. Uses Java agent attachment.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      targetPid: z.string().describe('PID of the JVM process. Use get_interceptor_metadata with id "attach-jvm" to list available JVM processes.'),
    }),
  },
  async ({ proxyPort, targetPid }) =>
    jsonResult(await client.activateInterceptor('attach-jvm', proxyPort, { targetPid }))
);

// ============================================================
// Electron Interceptor
// ============================================================

server.registerTool(
  'intercept_electron',
  {
    title: 'Intercept Electron App',
    description: 'Launch an Electron application with all its HTTP(S) traffic intercepted. Use get_interceptor_metadata with id "electron" to list available Electron apps.',
    inputSchema: z.object({
      proxyPort: z.number().describe('Proxy port to route traffic through'),
      pathToApplication: z.string().describe('Path to the Electron application to launch'),
    }),
  },
  async ({ proxyPort, pathToApplication }) =>
    jsonResult(await client.activateInterceptor('electron', proxyPort, { pathToApplication }))
);

// ============================================================
// HTTP Request Tool
// ============================================================

server.registerTool(
  'send_http_request',
  {
    title: 'Send HTTP Request',
    description:
      'Send an HTTP request through the HTTP Toolkit proxy. The request will be intercepted and visible in the HTTP Toolkit UI. Returns the full response including status code, headers, and body.',
    inputSchema: z.object({
      method: z.string().describe('HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)'),
      url: z.string().describe('Full URL to send the request to'),
      headers: z
        .array(z.tuple([z.string(), z.string()]))
        .optional()
        .describe('Request headers as array of [name, value] pairs. Host header is auto-added if missing.'),
      body: z.string().optional().describe('Request body as a string'),
      ignoreHostHttpsErrors: z
        .union([z.array(z.string()), z.boolean()])
        .optional()
        .describe('Hostnames to ignore HTTPS errors for, or true to ignore all'),
    }),
  },
  async ({ method, url, headers, body, ignoreHostHttpsErrors }) => {
    const requestDef = {
      method,
      url,
      headers: headers || [['Host', new URL(url).host]],
      rawBody: body,
    };
    const options = { ignoreHostHttpsErrors };
    const result = await client.sendHttpRequest(requestDef, options);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// ============================================================
// Generic Interceptor Activate (fallback for any interceptor)
// ============================================================

server.registerTool(
  'activate_interceptor',
  {
    title: 'Activate Interceptor (Generic)',
    description:
      'Generic tool to activate any interceptor by ID with custom options. Use the dedicated tools (intercept_chrome, intercept_docker_container, etc.) when possible for better parameter validation.',
    inputSchema: z.object({
      id: z.string().describe('Interceptor ID to activate'),
      proxyPort: z.number().describe('Proxy port to route intercepted traffic through'),
      options: z.record(z.string(), z.unknown()).optional().describe('Interceptor-specific activation options'),
    }),
  },
  async ({ id, proxyPort, options }) =>
    jsonResult(await client.activateInterceptor(id, proxyPort, options))
);

// ============================================================
// Traffic Capture Tools
// ============================================================

server.registerTool(
  'capture_traffic',
  {
    title: 'Capture Live Intercepted Traffic',
    description:
      'Capture live HTTP(S) traffic being intercepted by HTTP Toolkit. Subscribes to the existing UI session\'s WebSocket events, collects requests and responses for the specified duration, then returns all captured exchanges. Auto-detects the session ID from server logs, or you can provide it manually.',
    inputSchema: z.object({
      duration: z.number().optional().describe('Duration in seconds to capture traffic (default: 5, max: 30)'),
      sessionId: z.string().optional().describe('HTTP Toolkit session ID (auto-detected if not provided). Find it in the WebSocket URL in browser DevTools.'),
    }),
  },
  async ({ duration, sessionId }) => {
    const durationMs = Math.min((duration || 5), 30) * 1000;
    const exchanges = await trafficCapture.captureLive(durationMs, sessionId);
    return jsonResult({
      capturedExchanges: exchanges.length,
      exchanges,
    });
  }
);

// ============================================================
// Start Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HTTP Toolkit MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
