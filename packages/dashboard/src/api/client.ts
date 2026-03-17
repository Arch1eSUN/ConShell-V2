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

// ── Session Types ──────────────────────────────────────────

export interface SessionItem {
  id: string;
  title: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface SessionListResponse {
  sessions: SessionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TurnItem {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  thinking: string | null;
  tool_calls_json: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  model: string | null;
  created_at: string;
}

export interface TranscriptResponse {
  session: SessionItem;
  turns: TurnItem[];
  count: number;
}

// ── API Client ─────────────────────────────────────────────

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

  async *chatStream(message: string, sessionId?: string): AsyncGenerator<string> {
    const resp = await fetch(`${this.baseUrl}/api/webchat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: sessionId ?? crypto.randomUUID() }),
    });
    if (!resp.ok) throw new Error(`Stream Error: ${resp.status}`);

    // For non-streaming HTTP path, parse JSON response
    const data = await resp.json() as { reply?: string; response?: string };
    const content = data.reply ?? data.response ?? '';
    if (content) yield content;
  }

  // ── Session API ──────────────────────────────────────────

  async listSessions(limit: number = 50, offset: number = 0): Promise<SessionListResponse> {
    return this.request(`/api/sessions?limit=${limit}&offset=${offset}`);
  }

  async getTranscript(sessionId: string): Promise<TranscriptResponse> {
    return this.request(`/api/sessions/${sessionId}/transcript`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, { method: 'DELETE' });
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  // ── Config & Metrics ─────────────────────────────────────

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

  // ── Round 16.9.1: Economic Control Surface ─────────────────

  async getEconomicSnapshot(): Promise<EconomicSnapshotResponse> {
    return this.request('/api/economic/snapshot');
  }

  async getGateStatus(): Promise<GateStatusResponse> {
    return this.request('/api/economic/gate');
  }

  async getAgendaFactors(): Promise<AgendaFactorsResponse> {
    return this.request('/api/economic/agenda-factors');
  }
}

// ── Economic Control Surface Types ───────────────────────────

export interface EconomicSnapshotResponse {
  totalRevenueCents: number;
  totalSpendCents: number;
  currentBalanceCents: number;
  revenueBySource: Record<string, number>;
  burnRateCentsPerDay: number;
  dailyRevenueCents: number;
  netFlowCentsPerDay: number;
  runwayDays: number;
  reserveCents: number;
  isSelfSustaining: boolean;
  reserveFloorCents: number;
  mustPreserveWindowMinutes: number;
  projectionOwner: string;
  survivalTier: string;
  economicHealth: string;
  isEmergency: boolean;
  revenueStats: { totalRevenueCents: number; eventCount: number; byProtocol: Record<string, number> } | null;
  projectedAt: string;
}

export interface GateStatusResponse {
  error?: string;
  explanation?: {
    isOpen: boolean;
    tier: string;
    health: string;
    accepting: string;
    restrictions: string[];
    activeExemptions: string[];
    backgroundWorkLimit: number;
    timestamp: string;
  };
  sampleDecisions?: {
    nonRevenueTask: { allowed: boolean; code: string; message: string };
    revenueTask: { allowed: boolean; code: string; message: string };
    mustPreserveTask: { allowed: boolean; code: string; message: string };
  };
}

export interface AgendaFactorsResponse {
  error?: string;
  reservePressure?: number;
  netFlowFactor?: number;
  burnRateUrgency?: number;
  overallPressureScore?: number;
  mustPreserveFloor?: number;
  survivalReserveWindowMinutes?: number;
  explanation?: string;
  timestamp?: string;
}

export const api = new ApiClient();
export default api;
