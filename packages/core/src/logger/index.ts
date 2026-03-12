/**
 * Logger — 结构化日志 + 文件输出 + 日志级别过滤
 *
 * Features:
 * - Structured JSON-line format for machine parsing
 * - Console output with chalk coloring
 * - Optional file output with rotation
 * - Log level filtering (debug < info < warn < error < silent)
 * - Child loggers with inherited config
 * - Redaction of sensitive fields
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '../types/common.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '\x1b[36m',  // cyan
  INFO:  '\x1b[32m',  // green
  WARN:  '\x1b[33m',  // yellow
  ERROR: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';

/** Fields redacted in log output */
const REDACT_KEYS = new Set(['apiKey', 'password', 'secret', 'token', 'privateKey', 'mnemonic']);

export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** File path for log output (in addition to console) */
  filePath?: string;
  /** Whether to output structured JSON (vs human readable) */
  json?: boolean;
  /** Maximum file size before rotation (bytes). Default 10MB */
  maxFileSize?: number;
  /** Whether to include timestamps. Default true */
  timestamps?: boolean;
}

function redact(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (REDACT_KEYS.has(k)) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = redact(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

let _fileStream: fs.WriteStream | null = null;
let _filePath: string | null = null;

function getFileStream(filePath: string, maxSize: number): fs.WriteStream {
  if (_fileStream && _filePath === filePath) {
    // Check rotation
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > maxSize) {
        _fileStream.end();
        const rotated = `${filePath}.${Date.now()}.old`;
        fs.renameSync(filePath, rotated);
        _fileStream = fs.createWriteStream(filePath, { flags: 'a' });
      }
    } catch { /* file may not exist yet */ }
    return _fileStream;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _fileStream = fs.createWriteStream(filePath, { flags: 'a' });
  _filePath = filePath;
  return _fileStream;
}

export function createLogger(name?: string, opts?: LoggerOptions): Logger {
  const level = opts?.level ?? (process.env['CONSHELL_LOG_LEVEL'] as LogLevel) ?? 'info';
  const minLevel = LEVEL_ORDER[level] ?? LEVEL_ORDER.info;
  const filePath = opts?.filePath;
  const json = opts?.json ?? false;
  const maxFileSize = opts?.maxFileSize ?? 10 * 1024 * 1024;
  const timestamps = opts?.timestamps ?? true;

  const prefix = name ? `[${name}]` : '';

  const log = (levelStr: string, msg: string, data?: Record<string, unknown>) => {
    const levelValue = LEVEL_ORDER[levelStr.toLowerCase() as LogLevel] ?? 0;
    if (levelValue < minLevel) return;

    const ts = timestamps ? new Date().toISOString() : '';
    const safeData = data ? redact(data) : undefined;

    if (json) {
      const entry = { ts, level: levelStr, logger: name, msg, ...safeData };
      const line = JSON.stringify(entry);
      if (levelStr === 'ERROR') console.error(line);
      else console.log(line);
      if (filePath) getFileStream(filePath, maxFileSize).write(line + '\n');
      return;
    }

    // Human-readable format
    const color = LEVEL_COLORS[levelStr] ?? '';
    const dataStr = safeData ? ' ' + JSON.stringify(safeData) : '';
    const line = `${ts} ${color}${levelStr.padEnd(5)}${RESET} ${prefix} ${msg}${dataStr}`;

    if (levelStr === 'ERROR') console.error(line);
    else if (levelStr === 'WARN') console.warn(line);
    else console.log(line);

    if (filePath) {
      const plainLine = `${ts} ${levelStr.padEnd(5)} ${prefix} ${msg}${dataStr}\n`;
      getFileStream(filePath, maxFileSize).write(plainLine);
    }
  };

  return {
    debug: (msg, data) => log('DEBUG', msg, data),
    info:  (msg, data) => log('INFO',  msg, data),
    warn:  (msg, data) => log('WARN',  msg, data),
    error: (msg, data) => log('ERROR', msg, data),
    child: (childName) => createLogger(
      name ? `${name}:${childName}` : childName,
      { level, filePath, json, maxFileSize, timestamps },
    ),
  };
}

/** Flush all open file streams */
export function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    if (_fileStream) {
      _fileStream.end(() => { _fileStream = null; _filePath = null; resolve(); });
    } else {
      resolve();
    }
  });
}
