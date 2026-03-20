/**
 * Captures intercepted HTTP traffic by subscribing to the existing
 * HTTP Toolkit UI session's WebSocket GraphQL subscriptions.
 *
 * Flow:
 * 1. Find the existing UI session ID (from server logs or provided)
 * 2. Connect WebSocket to /session/{id}/subscription on the admin server (port 45456)
 * 3. Subscribe to requestInitiated + responseCompleted events
 * 4. Collect events for the specified duration
 * 5. Return collected traffic
 */

import { execSync } from 'child_process';
import WebSocket from 'ws';
import { autoDetectToken } from './httptoolkit-client.js';

const DEFAULT_ADMIN_URL = 'http://127.0.0.1:45456';

export interface CapturedRequest {
  id: string;
  method: string;
  url: string;
  protocol: string;
  headers: Record<string, string>;
  remoteIpAddress?: string;
  tags: string[];
}

export interface CapturedResponse {
  id: string;
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  tags: string[];
}

export interface CapturedExchange {
  request: CapturedRequest;
  response?: CapturedResponse;
}

export class TrafficCapture {
  private adminUrl: string;
  private headers: Record<string, string>;

  constructor(adminUrl?: string) {
    this.adminUrl = (adminUrl || DEFAULT_ADMIN_URL).replace(/\/$/, '');
    const token = autoDetectToken();
    this.headers = {
      'Content-Type': 'application/json',
      'Origin': token
        ? 'https://app.httptoolkit.tech'
        : 'http://localhost',
    };
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  /**
   * Find the active UI session ID by scanning httptoolkit logs for UUIDs
   * and testing each one via WebSocket connection.
   */
  private async probeSessionId(): Promise<string | undefined> {
    try {
      const log = execSync(
        `cat ~/.config/httptoolkit/logs/last-run.log 2>/dev/null || true`,
        { encoding: 'utf-8' }
      );

      // Find all UUIDs in the log that appear near "session"
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const allUuids = [...new Set(log.match(uuidPattern) || [])];

      // Try each UUID — connect WebSocket and see if it's a valid session
      for (const uuid of allUuids) {
        const isValid = await this.testSessionId(uuid);
        if (isValid) return uuid;
      }
    } catch {}

    return undefined;
  }

  /**
   * Test if a session ID is valid by trying to connect WebSocket.
   */
  private testSessionId(sessionId: string): Promise<boolean> {
    const wsUrl = this.adminUrl.replace(/^http/, 'ws') +
      `/session/${sessionId}/subscription`;

    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl, 'graphql-ws', {
        headers: this.headers,
      });
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'connection_init' }));
      });
      ws.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connection_ack') {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      });
      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Capture live traffic via WebSocket subscription for a given duration.
   * Subscribes to the existing UI session's requestInitiated and responseCompleted events.
   */
  async captureLive(durationMs: number = 5000, sessionId?: string): Promise<CapturedExchange[]> {
    // Find the existing session if not provided
    if (!sessionId) {
      sessionId = await this.probeSessionId();
    }

    if (!sessionId) {
      throw new Error(
        'Could not find active HTTP Toolkit session. ' +
        'Make sure HTTP Toolkit is running with an active interception session. ' +
        'You can provide the session ID manually if auto-detection fails.'
      );
    }

    const wsUrl = this.adminUrl.replace(/^http/, 'ws') +
      `/session/${sessionId}/subscription`;

    const exchanges = new Map<string, CapturedExchange>();

    return new Promise<CapturedExchange[]>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, 'graphql-ws', {
        headers: this.headers,
      });

      const cleanup = () => {
        try { ws.close(); } catch {}
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(Array.from(exchanges.values()));
      }, durationMs);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'connection_init' }));
      });

      ws.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connection_ack') {
          // Subscribe to request initiated
          ws.send(JSON.stringify({
            id: '1',
            type: 'start',
            payload: {
              query: `subscription {
                requestInitiated {
                  id
                  protocol
                  httpVersion
                  method
                  url
                  path
                  headers
                  remoteIpAddress
                  remotePort
                  tags
                }
              }`,
            },
          }));

          // Subscribe to response completed
          ws.send(JSON.stringify({
            id: '2',
            type: 'start',
            payload: {
              query: `subscription {
                responseCompleted {
                  id
                  statusCode
                  statusMessage
                  headers
                  tags
                }
              }`,
            },
          }));
        }

        if (msg.type === 'data' && msg.id === '1' && msg.payload?.data?.requestInitiated) {
          const req = msg.payload.data.requestInitiated;
          exchanges.set(req.id, {
            request: {
              id: req.id,
              method: req.method,
              url: req.url,
              protocol: req.protocol,
              headers: req.headers,
              remoteIpAddress: req.remoteIpAddress,
              tags: req.tags,
            },
          });
        }

        if (msg.type === 'data' && msg.id === '2' && msg.payload?.data?.responseCompleted) {
          const resp = msg.payload.data.responseCompleted;
          const exchange = exchanges.get(resp.id);
          if (exchange) {
            exchange.response = {
              id: resp.id,
              statusCode: resp.statusCode,
              statusMessage: resp.statusMessage,
              headers: resp.headers,
              tags: resp.tags,
            };
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(Array.from(exchanges.values()));
      });
    });
  }
}
