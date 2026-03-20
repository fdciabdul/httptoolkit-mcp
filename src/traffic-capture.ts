/**
 * Captures intercepted HTTP traffic from the Mockttp admin API
 * via WebSocket GraphQL subscriptions.
 *
 * Flow:
 * 1. POST /start to create a new mock session on the admin server (port 45456)
 * 2. Connect WebSocket to /session/{id}/subscription
 * 3. Subscribe to requestInitiated + responseCompleted events
 * 4. Collect events for the specified duration
 * 5. Return collected traffic
 */

import WebSocket from 'ws';

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
  body?: string;
  tags: string[];
}

export interface CapturedExchange {
  request: CapturedRequest;
  response?: CapturedResponse;
}

export class TrafficCapture {
  private adminUrl: string;

  constructor(adminUrl?: string) {
    this.adminUrl = (adminUrl || DEFAULT_ADMIN_URL).replace(/\/$/, '');
  }

  /**
   * Create a new mock session on the Mockttp admin server.
   */
  private async createSession(): Promise<string> {
    const res = await fetch(`${this.adminUrl}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost',
      },
      body: JSON.stringify({
        plugins: {
          http: {
            options: {
              cors: false,
              recordTraffic: false,
            },
            port: 0,
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create mock session: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /**
   * Stop a mock session.
   */
  private async stopSession(sessionId: string): Promise<void> {
    await fetch(`${this.adminUrl}/session/${sessionId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost',
      },
    }).catch(() => {}); // Best effort cleanup
  }

  /**
   * Query the existing mock session for seen requests via the GraphQL API.
   */
  private async queryMockedEndpoints(sessionId: string): Promise<any[]> {
    const res = await fetch(`${this.adminUrl}/session/${sessionId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost',
      },
      body: JSON.stringify({
        query: `{
          mockedEndpoints {
            id
            explanation
            seenRequests {
              id
              protocol
              method
              url
              path
              headers
              rawHeaders
              remoteIpAddress
              remotePort
              tags
              timingEvents
            }
          }
        }`,
      }),
    });

    if (!res.ok) return [];
    const json = (await res.json()) as any;
    return json?.data?.mockedEndpoints || [];
  }

  /**
   * Capture live traffic via WebSocket subscription for a given duration.
   * Subscribes to requestInitiated and responseCompleted events.
   */
  async captureLive(durationMs: number = 5000): Promise<CapturedExchange[]> {
    const sessionId = await this.createSession();
    const wsUrl = this.adminUrl.replace(/^http/, 'ws') +
      `/session/${sessionId}/subscription`;

    const exchanges = new Map<string, CapturedExchange>();

    return new Promise<CapturedExchange[]>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, 'graphql-ws', {
        headers: { 'Origin': 'http://localhost' },
      });

      const cleanup = () => {
        try { ws.close(); } catch {}
        this.stopSession(sessionId).catch(() => {});
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(Array.from(exchanges.values()));
      }, durationMs);

      ws.on('open', () => {
        // Init connection
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
