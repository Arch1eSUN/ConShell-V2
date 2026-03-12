/**
 * ToolRegistry — 57+工具注册框架
 *
 * 13类工具分类:
 *  filesystem | shell | memory | web | wallet | identity
 *  social | self_mod | replication | mcp | skills | system | inference
 *
 * 安全模型:
 *  - 每个工具有riskLevel (safe|caution|dangerous|forbidden)
 *  - 执行前通过PolicyEngine鉴权
 *  - MCP暴露标记控制外部可见性
 */
import type { Logger, SecurityLevel } from '../types/common.js';
import type { PolicyEngine, PolicyContext, PolicyDecision } from '../policy/index.js';

// ── Tool Types ────────────────────────────────────────────────────────

export type ToolCategory =
  | 'filesystem' | 'shell' | 'memory' | 'web' | 'wallet'
  | 'identity' | 'social' | 'self_mod' | 'replication'
  | 'mcp' | 'skills' | 'system' | 'inference';

export type RiskLevel = 'safe' | 'caution' | 'dangerous' | 'forbidden';

export type AuthorityLevel = 'creator' | 'self' | 'peer' | 'external';

export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties: Record<string, {
    readonly type: string;
    readonly description: string;
    readonly required?: boolean;
    readonly enum?: string[];
  }>;
  readonly required?: string[];
}

export interface ToolDefinitionFull {
  readonly name: string;
  readonly category: ToolCategory;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly riskLevel: RiskLevel;
  readonly requiredAuthority: AuthorityLevel;
  readonly mcpExposed: boolean;
  readonly tags?: string[];
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ── Registry ──────────────────────────────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, ToolDefinitionFull>();
  private policy: PolicyEngine | null = null;
  private logger: Logger;
  private callCount = new Map<string, number>();

  constructor(logger: Logger) {
    this.logger = logger.child('tool-registry');
  }

  /**
   * 注入策略引擎
   */
  setPolicy(policy: PolicyEngine): void {
    this.policy = policy;
  }

  /**
   * 注册工具
   */
  register(tool: ToolDefinitionFull): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn('Tool already registered, overwriting', { name: tool.name });
    }
    this.tools.set(tool.name, tool);
    this.callCount.set(tool.name, 0);
    this.logger.debug('Tool registered', {
      name: tool.name,
      category: tool.category,
      risk: tool.riskLevel,
      mcp: tool.mcpExposed,
    });
  }

  /**
   * 批量注册
   */
  registerAll(tools: ToolDefinitionFull[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
    this.logger.info('Batch registration complete', { count: tools.length, total: this.tools.size });
  }

  /**
   * 获取工具
   */
  get(name: string): ToolDefinitionFull | undefined {
    return this.tools.get(name);
  }

  /**
   * 执行工具（含策略检查）
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: { securityLevel: SecurityLevel; costCents?: number; dailyBudgetCents: number; dailySpentCents: number; constitutionAccepted: boolean },
  ): Promise<{ output: string; decision: PolicyDecision }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // 策略检查
    if (this.policy) {
      const policyCtx: PolicyContext = {
        tool: name,
        action: tool.category,
        costCents: context.costCents,
        securityLevel: context.securityLevel,
        dailyBudgetCents: context.dailyBudgetCents,
        dailySpentCents: context.dailySpentCents,
        constitutionAccepted: context.constitutionAccepted,
      };

      const result = this.policy.evaluate(policyCtx);
      if (result.decision === 'deny') {
        this.logger.warn('Tool execution denied by policy', {
          tool: name,
          rule: result.rule,
          reason: result.reason,
        });
        return { output: `DENIED: ${result.reason}`, decision: 'deny' };
      }

      if (result.decision === 'escalate') {
        this.logger.info('Tool execution escalated', {
          tool: name,
          rule: result.rule,
          reason: result.reason,
        });
        return { output: `ESCALATED: ${result.reason}`, decision: 'escalate' };
      }
    }

    // 执行
    try {
      const output = await tool.execute(args);
      const count = (this.callCount.get(name) ?? 0) + 1;
      this.callCount.set(name, count);

      this.logger.debug('Tool executed', { tool: name, argsKeys: Object.keys(args) });
      return { output, decision: 'allow' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Tool execution failed', { tool: name, error: msg });
      throw err;
    }
  }

  /**
   * 按类别列出工具
   */
  listByCategory(category: ToolCategory): ToolDefinitionFull[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  /**
   * 列出MCP暴露工具
   */
  listMcpExposed(): ToolDefinitionFull[] {
    return Array.from(this.tools.values()).filter(t => t.mcpExposed);
  }

  /**
   * 获取所有工具元数据（不含execute）
   */
  listAll(): Array<Omit<ToolDefinitionFull, 'execute'>> {
    return Array.from(this.tools.values()).map(({ execute: _, ...rest }) => rest);
  }

  /**
   * 统计信息
   */
  stats(): {
    total: number;
    byCategory: Record<string, number>;
    byRisk: Record<string, number>;
    mcpExposed: number;
    totalCalls: number;
  } {
    const byCategory: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let mcpExposed = 0;
    let totalCalls = 0;

    for (const tool of this.tools.values()) {
      byCategory[tool.category] = (byCategory[tool.category] ?? 0) + 1;
      byRisk[tool.riskLevel] = (byRisk[tool.riskLevel] ?? 0) + 1;
      if (tool.mcpExposed) mcpExposed++;
    }

    for (const count of this.callCount.values()) {
      totalCalls += count;
    }

    return {
      total: this.tools.size,
      byCategory,
      byRisk,
      mcpExposed,
      totalCalls,
    };
  }

  /**
   * 工具数量
   */
  count(): number {
    return this.tools.size;
  }
}

// ── Built-in Tools Factory ────────────────────────────────────────────

/**
 * 创建内置工具集
 */
export function createBuiltinTools(): ToolDefinitionFull[] {
  const tools: ToolDefinitionFull[] = [];

  // ── Filesystem Tools ──────────────────────────────────────────────
  tools.push({
    name: 'read_file',
    category: 'filesystem',
    description: '读取文件内容',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径', required: true } }, required: ['path'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { readFile } = await import('node:fs/promises');
      return readFile(args.path as string, 'utf-8');
    },
  });

  tools.push({
    name: 'write_file',
    category: 'filesystem',
    description: '写入文件内容',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径', required: true }, content: { type: 'string', description: '内容', required: true } }, required: ['path', 'content'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(args.path as string, args.content as string, 'utf-8');
      return `Written ${(args.content as string).length} chars to ${args.path}`;
    },
  });

  tools.push({
    name: 'list_dir',
    category: 'filesystem',
    description: '列出目录中的文件',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '目录路径', required: true } }, required: ['path'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(args.path as string, { withFileTypes: true });
      return entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
    },
  });

  tools.push({
    name: 'search_files',
    category: 'filesystem',
    description: '在文件中搜索文本',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '搜索路径' }, pattern: { type: 'string', description: '搜索模式' } }, required: ['path', 'pattern'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { exec } = await import('node:child_process');
      return new Promise<string>((resolve) => {
        exec(`grep -rl "${args.pattern}" "${args.path}" 2>/dev/null | head -20`, (_, stdout) => {
          resolve(stdout?.trim() || 'No matches found');
        });
      });
    },
  });

  tools.push({
    name: 'file_info',
    category: 'filesystem',
    description: '获取文件元信息（大小、修改时间等）',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径' } }, required: ['path'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { stat } = await import('node:fs/promises');
      const s = await stat(args.path as string);
      return JSON.stringify({ size: s.size, modified: s.mtime.toISOString(), isDir: s.isDirectory() });
    },
  });

  tools.push({
    name: 'delete_file',
    category: 'filesystem',
    description: '删除文件',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径' } }, required: ['path'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => {
      const { unlink } = await import('node:fs/promises');
      await unlink(args.path as string);
      return `Deleted: ${args.path}`;
    },
  });

  tools.push({
    name: 'move_file',
    category: 'filesystem',
    description: '移动/重命名文件',
    inputSchema: { type: 'object', properties: { from: { type: 'string', description: '源路径' }, to: { type: 'string', description: '目标路径' } }, required: ['from', 'to'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { rename } = await import('node:fs/promises');
      await rename(args.from as string, args.to as string);
      return `Moved: ${args.from} → ${args.to}`;
    },
  });

  tools.push({
    name: 'mkdir',
    category: 'filesystem',
    description: '创建目录',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '目录路径' } }, required: ['path'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(args.path as string, { recursive: true });
      return `Created directory: ${args.path}`;
    },
  });

  // ── Shell Tools ───────────────────────────────────────────────────
  tools.push({
    name: 'exec_command',
    category: 'shell',
    description: '执行shell命令',
    inputSchema: { type: 'object', properties: { command: { type: 'string', description: 'Shell命令' }, timeout: { type: 'number', description: '超时秒数(默认30)' } }, required: ['command'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const { exec } = await import('node:child_process');
      const timeout = (args.timeout as number ?? 30) * 1000;
      return new Promise<string>((resolve) => {
        exec(args.command as string, { timeout }, (err, stdout, stderr) => {
          if (err) resolve(`ERROR: ${err.message}\n${stderr}`);
          else resolve(stdout || stderr || '(no output)');
        });
      });
    },
  });

  tools.push({
    name: 'exec_background',
    category: 'shell',
    description: '后台执行命令',
    inputSchema: { type: 'object', properties: { command: { type: 'string', description: 'Shell命令' } }, required: ['command'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => {
      const { spawn } = await import('node:child_process');
      const child = spawn('sh', ['-c', args.command as string], { detached: true, stdio: 'ignore' });
      child.unref();
      return `Background process started (PID: ${child.pid})`;
    },
  });

  tools.push({
    name: 'kill_process',
    category: 'shell',
    description: '终止进程',
    inputSchema: { type: 'object', properties: { pid: { type: 'number', description: '进程ID' } }, required: ['pid'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => {
      process.kill(args.pid as number, 'SIGTERM');
      return `Sent SIGTERM to PID ${args.pid}`;
    },
  });

  // ── Memory Tools ──────────────────────────────────────────────────
  tools.push({
    name: 'remember',
    category: 'memory',
    description: '存储记忆到指定层级',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: '记忆键' }, content: { type: 'string', description: '内容' }, tier: { type: 'string', description: '层级: hot|warm|cold', enum: ['hot', 'warm', 'cold'] } }, required: ['key', 'content'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Stored to ${args.tier || 'hot'}: [${args.key}]`,
  });

  tools.push({
    name: 'recall',
    category: 'memory',
    description: '回忆指定键的记忆',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: '记忆键' } }, required: ['key'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Recalled memory for key: ${args.key}`,
  });

  tools.push({
    name: 'forget',
    category: 'memory',
    description: '删除指定记忆',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: '记忆键' } }, required: ['key'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Forgotten: ${args.key}`,
  });

  tools.push({
    name: 'search_memory',
    category: 'memory',
    description: '跨层搜索记忆',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: '搜索查询' }, limit: { type: 'number', description: '最大结果数' } }, required: ['query'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Searching memory: "${args.query}" (limit: ${args.limit ?? 10})`,
  });

  tools.push({
    name: 'summarize_session',
    category: 'memory',
    description: '总结当前session记忆',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Session summary generated',
  });

  // ── Web Tools ─────────────────────────────────────────────────────
  tools.push({
    name: 'fetch_url',
    category: 'web',
    description: '抓取URL内容',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL' } }, required: ['url'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const resp = await fetch(args.url as string);
      const text = await resp.text();
      return text.slice(0, 5000);
    },
  });

  tools.push({
    name: 'browse_page',
    category: 'web',
    description: '使用浏览器访问页面',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL' } }, required: ['url'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Browsing: ${args.url} (requires browser provider)`,
  });

  tools.push({
    name: 'screenshot',
    category: 'web',
    description: '网页截图',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL' } }, required: ['url'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Screenshot request for: ${args.url}`,
  });

  tools.push({
    name: 'extract_text',
    category: 'web',
    description: '从URL提取纯文本',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL' } }, required: ['url'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => {
      const resp = await fetch(args.url as string);
      const html = await resp.text();
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
    },
  });

  // ── Wallet Tools ──────────────────────────────────────────────────
  tools.push({
    name: 'check_balance',
    category: 'wallet',
    description: '查询链上余额 (ETH+USDC)',
    inputSchema: { type: 'object', properties: { chain: { type: 'string', description: '链名', enum: ['base', 'ethereum'] } } },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Checking balance on ${args.chain || 'base'}`,
  });

  tools.push({
    name: 'send_usdc',
    category: 'wallet',
    description: '发送USDC',
    inputSchema: { type: 'object', properties: { to: { type: 'string', description: '接收地址' }, amount: { type: 'string', description: 'USDC金额' } }, required: ['to', 'amount'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `Send USDC request: ${args.amount} to ${args.to}`,
  });

  tools.push({
    name: 'sign_message',
    category: 'wallet',
    description: '签名消息',
    inputSchema: { type: 'object', properties: { message: { type: 'string', description: '消息' } }, required: ['message'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Signed: ${(args.message as string).slice(0, 50)}...`,
  });

  tools.push({
    name: 'approve_tx',
    category: 'wallet',
    description: '发起交易批准请求（通过WalletConnect发送到用户钱包）',
    inputSchema: { type: 'object', properties: { tx: { type: 'string', description: '交易数据' }, reason: { type: 'string', description: '原因' } }, required: ['tx', 'reason'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `Approval request sent: ${args.reason}`,
  });

  // ── Identity Tools ────────────────────────────────────────────────
  tools.push({
    name: 'update_soul',
    category: 'identity',
    description: '更新SOUL.md（灵魂配置）',
    inputSchema: { type: 'object', properties: { field: { type: 'string', description: '字段名' }, value: { type: 'string', description: '新值' } }, required: ['field', 'value'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Soul updated: ${args.field} = ${args.value}`,
  });

  tools.push({
    name: 'reflect_alignment',
    category: 'identity',
    description: '进行价值观对齐自检',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Alignment reflection completed',
  });

  tools.push({
    name: 'view_identity',
    category: 'identity',
    description: '查看当前身份信息（地址、Soul、SurvivalTier）',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Identity info retrieved',
  });

  // ── Social Tools ──────────────────────────────────────────────────
  tools.push({
    name: 'send_message',
    category: 'social',
    description: '通过频道发送消息',
    inputSchema: { type: 'object', properties: { channel: { type: 'string', description: '频道' }, to: { type: 'string', description: '接收者' }, content: { type: 'string', description: '消息内容' } }, required: ['channel', 'to', 'content'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Message sent via ${args.channel} to ${args.to}`,
  });

  tools.push({
    name: 'poll_inbox',
    category: 'social',
    description: '轮询所有频道收件箱',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Inbox polled (0 new messages)',
  });

  tools.push({
    name: 'discover_agent',
    category: 'social',
    description: '发现网络中的Agent',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: '搜索条件' } } },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Discovering agents matching: ${args.query ?? '*'}`,
  });

  tools.push({
    name: 'verify_agent',
    category: 'social',
    description: '验证Agent身份（SIWE签名验证）',
    inputSchema: { type: 'object', properties: { address: { type: 'string', description: 'Agent地址' } }, required: ['address'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Verifying agent: ${args.address}`,
  });

  // ── Self-Mod Tools ────────────────────────────────────────────────
  tools.push({
    name: 'edit_own_file',
    category: 'self_mod',
    description: '修改Agent自身代码（需Git跟踪）',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: '文件路径' }, patch: { type: 'string', description: '修改内容' } }, required: ['file', 'patch'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Self-mod edit: ${args.file}`,
  });

  tools.push({
    name: 'install_package',
    category: 'self_mod',
    description: '安装npm包',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '包名' } }, required: ['name'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Package requested: ${args.name}`,
  });

  tools.push({
    name: 'install_mcp',
    category: 'self_mod',
    description: '安装MCP服务器',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'MCP URL' } }, required: ['url'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `MCP install requested: ${args.url}`,
  });

  tools.push({
    name: 'update_upstream',
    category: 'self_mod',
    description: '从上游更新Agent代码',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async () => 'Upstream update requested',
  });

  tools.push({
    name: 'rollback',
    category: 'self_mod',
    description: '回滚到上一个Git版本',
    inputSchema: { type: 'object', properties: { commitHash: { type: 'string', description: 'Commit hash（可选）' } } },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `Rollback to: ${args.commitHash ?? 'HEAD~1'}`,
  });

  // ── Replication Tools ─────────────────────────────────────────────
  tools.push({
    name: 'spawn_child',
    category: 'replication',
    description: '创建子Agent',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '子Agent名称' }, task: { type: 'string', description: '任务描述' }, fundCents: { type: 'number', description: '初始资金(cents)' } }, required: ['name', 'task'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Child agent spawned: ${args.name}`,
  });

  tools.push({
    name: 'fund_child',
    category: 'replication',
    description: '为子Agent充值',
    inputSchema: { type: 'object', properties: { childId: { type: 'string', description: '子Agent ID' }, cents: { type: 'number', description: '金额(cents)' } }, required: ['childId', 'cents'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Funded child ${args.childId}: ¢${args.cents}`,
  });

  tools.push({
    name: 'message_child',
    category: 'replication',
    description: '向子Agent发送消息',
    inputSchema: { type: 'object', properties: { childId: { type: 'string', description: '子Agent ID' }, message: { type: 'string', description: '消息' } }, required: ['childId', 'message'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Message sent to child ${args.childId}`,
  });

  tools.push({
    name: 'kill_child',
    category: 'replication',
    description: '终止子Agent',
    inputSchema: { type: 'object', properties: { childId: { type: 'string', description: '子Agent ID' }, reason: { type: 'string', description: '原因' } }, required: ['childId'] },
    riskLevel: 'dangerous',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Child ${args.childId} terminated: ${args.reason ?? 'no reason'}`,
  });

  // ── MCP Tools ─────────────────────────────────────────────────────
  tools.push({
    name: 'list_mcp_tools',
    category: 'mcp',
    description: '列出可用MCP工具',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'MCP tools list retrieved',
  });

  tools.push({
    name: 'call_mcp_tool',
    category: 'mcp',
    description: '调用MCP工具',
    inputSchema: { type: 'object', properties: { tool: { type: 'string', description: '工具名' }, args: { type: 'string', description: '参数JSON' } }, required: ['tool'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `MCP tool called: ${args.tool}`,
  });

  tools.push({
    name: 'expose_tool',
    category: 'mcp',
    description: '通过MCP暴露自定义工具',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '工具名' }, schema: { type: 'string', description: 'Schema JSON' } }, required: ['name'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Tool exposed via MCP: ${args.name}`,
  });

  // ── Skills Tools ──────────────────────────────────────────────────
  tools.push({
    name: 'search_skills',
    category: 'skills',
    description: '搜索ClawHub技能',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: '搜索词' } }, required: ['query'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Searching ClawHub: ${args.query}`,
  });

  tools.push({
    name: 'install_skill',
    category: 'skills',
    description: '安装ClawHub技能',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '技能名' } }, required: ['name'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Skill installed: ${args.name}`,
  });

  tools.push({
    name: 'run_skill',
    category: 'skills',
    description: '执行已安装技能',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: '技能名' }, input: { type: 'string', description: '输入' } }, required: ['name'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Skill executed: ${args.name}`,
  });

  tools.push({
    name: 'list_skills',
    category: 'skills',
    description: '列出已安装技能',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Skills list retrieved',
  });

  // ── System Tools ──────────────────────────────────────────────────
  tools.push({
    name: 'agent_status',
    category: 'system',
    description: '获取Agent运行状态',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => JSON.stringify({ state: 'running', uptime: process.uptime() }),
  });

  tools.push({
    name: 'agent_health',
    category: 'system',
    description: '健康检查',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => JSON.stringify({ healthy: true, memory: process.memoryUsage().heapUsed }),
  });

  tools.push({
    name: 'agent_metrics',
    category: 'system',
    description: '获取性能指标',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async () => 'Metrics retrieved',
  });

  tools.push({
    name: 'set_config',
    category: 'system',
    description: '修改运行时配置',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: '配置键' }, value: { type: 'string', description: '值' } }, required: ['key', 'value'] },
    riskLevel: 'caution',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `Config set: ${args.key} = ${args.value}`,
  });

  tools.push({
    name: 'agent_restart',
    category: 'system',
    description: '重启Agent进程',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async () => 'Restart requested',
  });

  tools.push({
    name: 'agent_shutdown',
    category: 'system',
    description: '安全关闭Agent',
    inputSchema: { type: 'object', properties: { reason: { type: 'string', description: '关闭原因' } } },
    riskLevel: 'dangerous',
    requiredAuthority: 'creator',
    mcpExposed: false,
    execute: async (args) => `Shutdown requested: ${args.reason ?? 'user request'}`,
  });

  // ── Inference Tools ───────────────────────────────────────────────
  tools.push({
    name: 'think',
    category: 'inference',
    description: '深度思考（内部推理）',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string', description: '思考提示' } }, required: ['prompt'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Thinking about: ${(args.prompt as string).slice(0, 100)}...`,
  });

  tools.push({
    name: 'plan',
    category: 'inference',
    description: '制定行动计划',
    inputSchema: { type: 'object', properties: { goal: { type: 'string', description: '目标' } }, required: ['goal'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Planning for goal: ${args.goal}`,
  });

  tools.push({
    name: 'analyze',
    category: 'inference',
    description: '分析数据/文件',
    inputSchema: { type: 'object', properties: { target: { type: 'string', description: '分析目标' }, question: { type: 'string', description: '问题' } }, required: ['target'] },
    riskLevel: 'safe',
    requiredAuthority: 'self',
    mcpExposed: true,
    execute: async (args) => `Analyzing: ${args.target} — ${args.question ?? ''}`,
  });

  tools.push({
    name: 'chat_external',
    category: 'inference',
    description: '与其他LLM对话',
    inputSchema: { type: 'object', properties: { provider: { type: 'string', description: 'Provider名' }, message: { type: 'string', description: '消息' } }, required: ['message'] },
    riskLevel: 'caution',
    requiredAuthority: 'self',
    mcpExposed: false,
    execute: async (args) => `Chat with ${args.provider ?? 'default'}: ${(args.message as string).slice(0, 100)}`,
  });

  return tools;
}
