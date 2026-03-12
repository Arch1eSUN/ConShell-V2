/**
 * API Client — Typed HTTP client for ConShell server.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4200';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  agent: string;
  uptime: number;
  version: string;
}

export interface ChatResponse {
  response: string;
  turnId: string;
  cost?: number;
}

export interface MetricsResponse {
  totalTurns: number;
  totalSpentCents: number;
  dailySpentCents: number;
  dailyBudgetCents: number;
  memoryCount: number;
  toolCallCount: number;
}

export interface ConfigResponse {
  agentName: string;
  inferenceMode: string;
  model: string;
  securityLevel: string;
  port: number;
  proxyEnabled: boolean;
  walletEnabled: boolean;
  channels: string[];
  browserProvider: string;
  dailyBudgetCents: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!resp.ok) throw new Error(`API Error: ${resp.status} ${resp.statusText}`);
    return resp.json() as Promise<T>;
  }

  async health(): Promise<HealthResponse> {
    return this.request('/api/health');
  }

  async chat(message: string): Promise<ChatResponse> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async *chatStream(message: string): AsyncGenerator<string> {
    const resp = await fetch(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!resp.ok) throw new Error(`Stream Error: ${resp.status}`);
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Parse SSE events
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as { content?: string };
            if (parsed.content) yield parsed.content;
          } catch {
            yield data;
          }
        }
      }
    }
  }

  async getConfig(): Promise<ConfigResponse> {
    return this.request('/api/config');
  }

  async updateConfig(config: Partial<ConfigResponse>): Promise<void> {
    await this.request('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getMetrics(): Promise<MetricsResponse> {
    return this.request('/api/metrics');
  }

  /** Raw typed request helper (for arbitrary endpoints) */
  async rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, options);
  }
}

export const api = new ApiClient();
export default api;
