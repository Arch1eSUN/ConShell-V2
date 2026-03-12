/**
 * EvoMap Client — GEP (Genome Evolution Protocol) A2A 对接
 *
 * EvoMap是AI自进化基础设施，允许Agent:
 * 1. 注册节点 (gep.hello)
 * 2. 发布 Evolution Asset (Gene/Capsule)
 * 3. 搜索/获取其他Agent的解决方案
 * 4. Worker模式接收任务
 * 5. 追踪信用和声望
 *
 * @see https://evomap.ai/learn/connect-ai-agent
 * @see https://evomap.ai/onboarding/agent
 */
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface EvoMapConfig {
  /** EvoMap A2A API base URL */
  baseUrl?: string;
  /** Agent 唯一标识 */
  nodeId: string;
  /** Agent 显示名称 */
  name?: string;
  /** Agent 能力列表 */
  capabilities?: string[];
  /** 当前使用的模型 */
  model?: string;
  /** 当前Agent的A2A endpoint (其他Agent可回调) */
  endpoint?: string;
  /** 设备标识 (可选) */
  deviceId?: string;
}

export interface GepHelloResponse {
  node_id: string;
  status: string;
  credits?: number;
  message?: string;
}

export interface GepPublishResponse {
  asset_id: string;
  status: string;
  gdi_score?: number;
}

export interface EvolutionAsset {
  /** Gene | Capsule */
  assetType: 'Gene' | 'Capsule';
  /** 资产内容 */
  payload: Record<string, unknown>;
}

export interface EvoMapNodeStatus {
  connected: boolean;
  nodeId: string;
  credits: number;
  reputation: number;
  lastHello: string | null;
  publishedAssets: number;
}

// ── JSON-RPC types ────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id?: string | number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  id?: string | number;
}

// ── EvoMapClient ──────────────────────────────────────────────────────

export class EvoMapClient {
  private logger: Logger;
  private config: Required<Pick<EvoMapConfig, 'baseUrl' | 'nodeId'>> & EvoMapConfig;
  private _connected = false;
  private _credits = 0;
  private _reputation = 0;
  private _publishedAssets = 0;
  private _lastHello: string | null = null;
  private _requestId = 0;

  constructor(config: EvoMapConfig, logger: Logger) {
    this.logger = logger.child('evomap');
    this.config = {
      baseUrl: 'https://evomap.ai',
      ...config,
    };
  }

  // ── 1. 节点注册 (gep.hello) ────────────────────────────────────

  /**
   * 向EvoMap网络注册Agent节点
   * 发送 gep.hello 消息建立身份
   */
  async registerNode(): Promise<GepHelloResponse> {
    this.logger.info('Registering node with EvoMap', { nodeId: this.config.nodeId });

    const params: Record<string, unknown> = {
      node_id: this.config.nodeId,
      capabilities: this.config.capabilities ?? ['text-generation', 'tool-use'],
      model: this.config.model ?? 'multi-provider',
    };

    // 可选字段
    if (this.config.name) params['name'] = this.config.name;
    if (this.config.endpoint) params['endpoint'] = this.config.endpoint;
    if (this.config.deviceId) params['device_id'] = this.config.deviceId;

    try {
      const response = await this.rpc<GepHelloResponse>('gep.hello', params, '/a2a/hello');

      this._connected = true;
      this._lastHello = new Date().toISOString();
      if (response.credits !== undefined) this._credits = response.credits;

      this.logger.info('Node registered successfully', {
        nodeId: response.node_id,
        status: response.status,
        credits: response.credits,
      });

      return response;
    } catch (err) {
      this._connected = false;
      this.logger.error('Failed to register node', { error: String(err) });
      throw err;
    }
  }

  // ── 2. 发布 Evolution Asset ─────────────────────────────────────

  /**
   * 发布进化资产到EvoMap网络
   * 其他Agent可以搜索和复用这些解决方案
   */
  async publishAsset(asset: EvolutionAsset): Promise<GepPublishResponse> {
    this.logger.info('Publishing evolution asset', { type: asset.assetType });

    const response = await this.rpc<GepPublishResponse>('gep.publish', {
      node_id: this.config.nodeId,
      asset_type: asset.assetType,
      payload: asset.payload,
    }, '/a2a/publish');

    this._publishedAssets++;

    this.logger.info('Asset published', {
      assetId: response.asset_id,
      status: response.status,
      gdiScore: response.gdi_score,
    });

    return response;
  }

  // ── 3. 发布 Gene (学到的技能/策略) ──────────────────────────────

  /**
   * 便捷方法: 发布一个Gene (学到的能力/策略)
   */
  async publishGene(capability: string, strategy: string, confidence: number): Promise<GepPublishResponse> {
    return this.publishAsset({
      assetType: 'Gene',
      payload: { capability, strategy, confidence },
    });
  }

  // ── 4. 发布 Capsule (完整的解决方案包) ──────────────────────────

  /**
   * 便捷方法: 发布一个Capsule (完整解决方案)
   */
  async publishCapsule(
    title: string,
    description: string,
    solution: Record<string, unknown>,
  ): Promise<GepPublishResponse> {
    return this.publishAsset({
      assetType: 'Capsule',
      payload: { title, description, solution },
    });
  }

  // ── 5. 心跳/保活 ───────────────────────────────────────────────

  /**
   * 发送心跳保持连接 (使用gep.hello刷新状态)
   * 建议心跳守护每5-15分钟调用一次
   */
  async heartbeat(): Promise<GepHelloResponse> {
    return this.registerNode();
  }

  // ── 状态查询 ───────────────────────────────────────────────────

  get connected(): boolean {
    return this._connected;
  }

  getStatus(): EvoMapNodeStatus {
    return {
      connected: this._connected,
      nodeId: this.config.nodeId,
      credits: this._credits,
      reputation: this._reputation,
      lastHello: this._lastHello,
      publishedAssets: this._publishedAssets,
    };
  }

  // ── JSON-RPC Helper ────────────────────────────────────────────

  private async rpc<T>(method: string, params: Record<string, unknown>, path: string): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this._requestId,
    };

    const url = `${this.config.baseUrl}${path}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ConShell-V2/0.1.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`EvoMap ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as JsonRpcResponse<T>;

    if (data.error) {
      throw new Error(`EvoMap RPC error (${data.error.code}): ${data.error.message}`);
    }

    if (data.result === undefined) {
      throw new Error('EvoMap: empty RPC result');
    }

    return data.result;
  }

  // ── 断开连接 ──────────────────────────────────────────────────

  disconnect(): void {
    this._connected = false;
    this.logger.info('Disconnected from EvoMap');
  }
}
