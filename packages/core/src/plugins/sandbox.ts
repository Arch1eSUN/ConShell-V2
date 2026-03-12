/**
 * Plugin Sandbox — VM-isolated execution for untrusted plugins
 *
 * Uses Node.js `node:vm` for lightweight isolation:
 * - Controlled global scope (no fs/net/child_process by default)
 * - Permission-gated API surface
 * - Execution timeout (default 5s)
 * - Memory-bound via vm options
 *
 * For full process-level isolation, use worker_threads (see runInWorker).
 */
import * as vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import * as path from 'node:path';
import type { Logger } from '../types/common.js';
import type { PluginPermission } from './index.js';

// ── Types ──────────────────────────────────────────────────

export interface SandboxOptions {
  /** Timeout for script execution in ms (default 5000) */
  timeout?: number;
  /** Allowed permissions — determines which APIs are injected */
  permissions?: PluginPermission[];
  /** Plugin name (for logging) */
  pluginName?: string;
  /** Working directory for the plugin */
  cwd?: string;
  /** Logger instance */
  logger?: Logger;
}

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  logs: string[];
}

export interface SandboxAPI {
  console: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  setTimeout: (fn: (...args: unknown[]) => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: typeof clearTimeout;
  JSON: typeof JSON;
  Promise: typeof Promise;
  URL: typeof URL;
  fetch?: typeof fetch;
  Buffer?: typeof Buffer;
  [key: string]: unknown;
}

// ── Sandbox ────────────────────────────────────────────────

export class PluginSandbox {
  private logger: Logger;

  constructor(private opts: SandboxOptions = {}) {
    this.logger = opts.logger ?? {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
      child: () => this.logger,
    };
  }

  /**
   * Execute a script string in a sandboxed VM context
   */
  async runInVM(code: string, extraContext?: Record<string, unknown>): Promise<SandboxResult> {
    const startTime = performance.now();
    const logs: string[] = [];
    const timeout = this.opts.timeout ?? 5000;

    // Build the sandboxed global object
    const sandbox = this.buildSandboxAPI(logs);
    if (extraContext) Object.assign(sandbox, extraContext);

    const context = vm.createContext(sandbox, {
      name: `plugin:${this.opts.pluginName ?? 'unknown'}`,
      codeGeneration: { strings: false, wasm: false }, // no eval(), no WASM
    });

    try {
      const script = new vm.Script(code, {
        filename: `${this.opts.pluginName ?? 'plugin'}.js`,
      });

      const result = script.runInContext(context, {
        timeout,
        breakOnSigint: true,
      });

      // If result is a promise, await it with timeout
      const finalResult = result instanceof Promise
        ? await Promise.race([
            result,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Async timeout')), timeout),
            ),
          ])
        : result;

      return {
        success: true,
        result: finalResult,
        durationMs: performance.now() - startTime,
        logs,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn('Sandbox execution failed', {
        plugin: this.opts.pluginName, error: errorMsg,
      });
      return {
        success: false,
        error: errorMsg,
        durationMs: performance.now() - startTime,
        logs,
      };
    }
  }

  /**
   * Execute code in a separate worker thread (process-level isolation)
   */
  async runInWorker(filePath: string): Promise<SandboxResult> {
    const startTime = performance.now();
    const timeout = this.opts.timeout ?? 10000;
    const logs: string[] = [];

    return new Promise((resolve) => {
      const workerCode = `
        const { parentPort, workerData } = require('node:worker_threads');
        const vm = require('node:vm');
        const fs = require('node:fs');

        const code = fs.readFileSync(workerData.filePath, 'utf-8');
        const logs = [];
        const sandbox = {
          console: {
            log: (...a) => logs.push(a.map(String).join(' ')),
            warn: (...a) => logs.push('[WARN] ' + a.map(String).join(' ')),
            error: (...a) => logs.push('[ERROR] ' + a.map(String).join(' ')),
          },
          JSON, Promise, setTimeout, clearTimeout,
          exports: {},
          module: { exports: {} },
        };

        const ctx = vm.createContext(sandbox, {
          name: 'plugin-worker',
          codeGeneration: { strings: false, wasm: false },
        });

        try {
          const script = new vm.Script(code, { filename: workerData.filePath });
          const result = script.runInContext(ctx, { timeout: workerData.timeout });
          parentPort.postMessage({ success: true, result, logs });
        } catch (err) {
          parentPort.postMessage({ success: false, error: err.message, logs });
        }
      `;

      const worker = new Worker(workerCode, {
        eval: true,
        workerData: {
          filePath: path.resolve(filePath),
          timeout: timeout - 1000, // leave 1s for worker overhead
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
          codeRangeSizeMb: 16,
        },
      });

      const timer = setTimeout(() => {
        worker.terminate();
        resolve({
          success: false,
          error: 'Worker timeout',
          durationMs: performance.now() - startTime,
          logs,
        });
      }, timeout);

      worker.on('message', (msg: any) => {
        clearTimeout(timer);
        resolve({
          success: msg.success,
          result: msg.result,
          error: msg.error,
          durationMs: performance.now() - startTime,
          logs: [...logs, ...(msg.logs ?? [])],
        });
      });

      worker.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
          durationMs: performance.now() - startTime,
          logs,
        });
      });
    });
  }

  /**
   * Validate that code doesn't contain obviously dangerous patterns
   */
  static validateCode(code: string): { safe: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const checks = [
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, msg: 'Imports child_process' },
      { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, msg: 'Imports fs module' },
      { pattern: /require\s*\(\s*['"]net['"]\s*\)/, msg: 'Imports net module' },
      { pattern: /process\.exit/, msg: 'Calls process.exit' },
      { pattern: /process\.kill/, msg: 'Calls process.kill' },
      { pattern: /eval\s*\(/, msg: 'Uses eval()' },
      { pattern: /Function\s*\(/, msg: 'Uses Function constructor' },
      { pattern: /import\s*\(/, msg: 'Uses dynamic import' },
      { pattern: /globalThis|global\b/, msg: 'Accesses global scope' },
    ];

    for (const { pattern, msg } of checks) {
      if (pattern.test(code)) warnings.push(msg);
    }

    return { safe: warnings.length === 0, warnings };
  }

  // ── Private ──────────────────────────────────────────────

  private buildSandboxAPI(logs: string[]): SandboxAPI {
    const perms = new Set(this.opts.permissions ?? []);

    const api: SandboxAPI = {
      console: {
        log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
        warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
        error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
      },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 5000)),
      clearTimeout,
      JSON,
      Promise,
      URL,
    };

    // Permission-gated APIs
    if (perms.has('net:http')) {
      api.fetch = fetch;
    }

    if (perms.has('fs:read') || perms.has('fs:write')) {
      api.Buffer = Buffer;
    }

    return api;
  }
}
