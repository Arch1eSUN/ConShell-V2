/**
 * Logger Tests — structured logging, level filtering, redaction, child loggers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, flushLogs } from './index.js';

describe('createLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates logger with methods', () => {
    const logger = createLogger('test');
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
    expect(logger.child).toBeInstanceOf(Function);
  });

  it('filters by log level', () => {
    const logger = createLogger('test', { level: 'warn', timestamps: false });
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    expect(console.log).not.toHaveBeenCalled(); // debug + info suppressed
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive fields', () => {
    const logger = createLogger('test', { level: 'info', timestamps: false });
    logger.info('test', { apiKey: 'sk-1234', username: 'alice' });
    const logCall = (console.log as any).mock.calls[0][0];
    expect(logCall).toContain('[REDACTED]');
    expect(logCall).not.toContain('sk-1234');
    expect(logCall).toContain('alice');
  });

  it('redacts nested objects', () => {
    const logger = createLogger('test', { level: 'info', timestamps: false });
    logger.info('nested', { config: { token: 'my-secret', host: 'localhost' } });
    const logCall = (console.log as any).mock.calls[0][0];
    expect(logCall).toContain('[REDACTED]');
    expect(logCall).not.toContain('my-secret');
  });

  it('creates child logger with prefixed name', () => {
    const parent = createLogger('parent', { level: 'info', timestamps: false });
    const child = parent.child('sub');
    child.info('child msg');
    const logCall = (console.log as any).mock.calls[0][0];
    expect(logCall).toContain('[parent:sub]');
  });

  it('outputs JSON when json=true', () => {
    const logger = createLogger('test', { level: 'info', json: true, timestamps: false });
    logger.info('json test', { foo: 'bar' });
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.msg).toBe('json test');
    expect(parsed.foo).toBe('bar');
    expect(parsed.level).toBe('INFO');
  });

  it('silent level suppresses all', () => {
    const logger = createLogger('test', { level: 'silent' });
    logger.debug('x');
    logger.info('x');
    logger.warn('x');
    logger.error('x');
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('flushLogs', () => {
  it('resolves when no file stream', async () => {
    await expect(flushLogs()).resolves.toBeUndefined();
  });
});
