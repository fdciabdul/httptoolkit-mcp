/**
 * HTTP client for communicating with the HTTP Toolkit server REST API (port 45457)
 * and the Mockttp admin API (proxy port, e.g. 8000 or 45456).
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:45457';

export class HttpToolkitClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl?: string, authToken?: string) {
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost',
    };
    if (authToken) {
      this.headers['Authorization'] = `Bearer ${authToken}`;
    }
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      let message: string;
      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.error?.message || errorBody;
      } catch {
        message = errorBody;
      }
      throw new Error(`HTTP Toolkit API error (${res.status}): ${message}`);
    }

    return res.json() as Promise<T>;
  }

  // --- GraphQL helper (for operations not in REST API) ---

  private async graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/`, {
      method: 'POST',
      headers: { ...this.headers, 'Accept': 'application/graphql-response+json' },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`GraphQL error (${res.status}): ${errorBody}`);
    }

    const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      throw new Error(`GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
    }
    return json.data as T;
  }

  // --- REST API methods ---

  async getVersion(): Promise<{ version: string }> {
    return this.request('GET', '/version');
  }

  async getConfig(proxyPort?: number): Promise<{ config: Record<string, unknown> }> {
    const query = proxyPort ? `?proxyPort=${proxyPort}` : '';
    return this.request('GET', `/config${query}`);
  }

  async getNetworkInterfaces(): Promise<{ networkInterfaces: Record<string, unknown> }> {
    return this.request('GET', '/config/network-interfaces');
  }

  async getInterceptors(proxyPort?: number): Promise<{ interceptors: InterceptorInfo[] }> {
    const query = proxyPort ? `?proxyPort=${proxyPort}` : '';
    return this.request('GET', `/interceptors${query}`);
  }

  async getInterceptorMetadata(
    id: string,
    subId?: string
  ): Promise<{ interceptorMetadata: unknown }> {
    const path = subId
      ? `/interceptors/${encodeURIComponent(id)}/metadata/${encodeURIComponent(subId)}`
      : `/interceptors/${encodeURIComponent(id)}/metadata`;
    return this.request('GET', path);
  }

  async activateInterceptor(
    id: string,
    proxyPort: number,
    options?: unknown
  ): Promise<{ result: { success: boolean; metadata?: unknown } }> {
    return this.request(
      'POST',
      `/interceptors/${encodeURIComponent(id)}/activate/${proxyPort}`,
      options || {}
    );
  }

  async deactivateInterceptor(
    id: string,
    proxyPort: number
  ): Promise<boolean> {
    const data = await this.graphql<{ deactivateInterceptor: boolean }>(
      `mutation DeactivateInterceptor($id: ID!, $proxyPort: Int!) {
        deactivateInterceptor(id: $id, proxyPort: $proxyPort)
      }`,
      { id, proxyPort }
    );
    return data.deactivateInterceptor;
  }

  async sendHttpRequest(
    request: RequestDefinition,
    options: SendRequestOptions
  ): Promise<string> {
    const url = `${this.baseUrl}/client/send`;
    const body = {
      request: {
        ...request,
        rawBody: request.rawBody
          ? Buffer.from(request.rawBody).toString('base64')
          : '',
      },
      options,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`HTTP Toolkit send request failed (${res.status}): ${errorBody}`);
    }

    // Read the NDJSON stream and collect all events
    const text = await res.text();
    const events = text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    // Build a readable response summary
    const responseHead = events.find((e: any) => e.type === 'response-head');
    const bodyParts = events.filter((e: any) => e.type === 'response-body-part');
    const error = events.find((e: any) => e.type === 'error');

    if (error) {
      throw new Error(`Request failed: ${error.error?.message || JSON.stringify(error)}`);
    }

    const responseBody = bodyParts
      .map((p: any) => Buffer.from(p.rawBody, 'base64').toString('utf-8'))
      .join('');

    const result: Record<string, unknown> = {};
    if (responseHead) {
      result.statusCode = responseHead.statusCode;
      result.statusMessage = responseHead.statusMessage;
      result.headers = responseHead.headers;
    }
    result.body = responseBody;

    return JSON.stringify(result, null, 2);
  }

  async triggerUpdate(): Promise<{ success: boolean }> {
    return this.request('POST', '/update');
  }

  async shutdownServer(): Promise<{ success: boolean }> {
    return this.request('POST', '/shutdown');
  }
}

export interface InterceptorInfo {
  id: string;
  version: string;
  metadata?: unknown;
  isActivable: boolean;
  isActive?: boolean;
}

export interface RequestDefinition {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  rawBody?: string;
}

export interface SendRequestOptions {
  ignoreHostHttpsErrors?: string[] | boolean;
  proxyConfig?: unknown;
  lookupOptions?: { servers?: string[] };
}
