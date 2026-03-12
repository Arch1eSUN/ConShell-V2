/**
 * Config tests — zod schema validation + loading + env override
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, saveConfig, appConfigSchema } from '../config/index.js';

const TEST_HOME = path.join(os.tmpdir(), `conshell-test-config-${Date.now()}`);

describe('Config', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_HOME, { recursive: true });
    // Clean env vars
    delete process.env['CONSHELL_API_KEY'];
    delete process.env['CONSHELL_PORT'];
    delete process.env['CONSHELL_HOME'];
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should return defaults when no config file exists', () => {
      const config = loadConfig(TEST_HOME);
      expect(config.agentName).toBe('ConShell Agent');
      expect(config.port).toBe(4200);
      expect(config.inferenceMode).toBe('ollama');
      expect(config.model).toBe('llama3');
      expect(config.securityLevel).toBe('standard');
      expect(config.dailyBudgetCents).toBe(500);
    });

    it('should load values from config.json', () => {
      const configPath = path.join(TEST_HOME, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        agentName: 'TestBot',
        port: 8080,
        model: 'gpt-4',
      }));

      const config = loadConfig(TEST_HOME);
      expect(config.agentName).toBe('TestBot');
      expect(config.port).toBe(8080);
      expect(config.model).toBe('gpt-4');
    });

    it('should override file config with env vars', () => {
      const configPath = path.join(TEST_HOME, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 3000 }));
      process.env['CONSHELL_PORT'] = '9999';

      const config = loadConfig(TEST_HOME);
      expect(config.port).toBe(9999);
    });

    it('should handle corrupt config.json gracefully', () => {
      const configPath = path.join(TEST_HOME, 'config.json');
      fs.writeFileSync(configPath, 'NOT VALID JSON!!!');

      const config = loadConfig(TEST_HOME);
      expect(config.agentName).toBe('ConShell Agent'); // falls back to defaults
    });
  });

  describe('saveConfig', () => {
    it('should create config.json', () => {
      saveConfig({ agentName: 'Saved Agent' }, TEST_HOME);
      const configPath = path.join(TEST_HOME, 'config.json');
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.agentName).toBe('Saved Agent');
    });

    it('should merge with existing config', () => {
      saveConfig({ agentName: 'First', port: 3000 }, TEST_HOME);
      saveConfig({ port: 4000 }, TEST_HOME);
      const configPath = path.join(TEST_HOME, 'config.json');
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.agentName).toBe('First');
      expect(content.port).toBe(4000);
    });
  });

  describe('appConfigSchema', () => {
    it('should validate a minimal config', () => {
      const result = appConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid port', () => {
      const result = appConfigSchema.safeParse({ port: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid inference mode', () => {
      const result = appConfigSchema.safeParse({ inferenceMode: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept all valid inference modes', () => {
      for (const mode of ['ollama', 'cliproxy', 'direct-api', 'conway-cloud']) {
        const result = appConfigSchema.safeParse({ inferenceMode: mode });
        expect(result.success).toBe(true);
      }
    });
  });
});
