/**
 * 技能加载器 — 扫描并解析 ~/.conshell/skills/ 目录
 *
 * 每个技能是一个文件夹，包含：
 * - SKILL.md: 技能定义 (YAML frontmatter + instructions)
 * - scripts/: 可选的辅助脚本
 * - examples/: 可选的示例
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface SkillMeta {
  /** 技能ID (目录名) */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 版本 */
  version: string;
  /** 作者 */
  author: string;
  /** 完整 SKILL.md 内容 */
  instructions: string;
  /** 目录绝对路径 */
  path: string;
  /** 是否有脚本目录 */
  hasScripts: boolean;
  /** 加载时间戳 */
  loadedAt: string;
}

// ── Loader ────────────────────────────────────────────────────────────

export class SkillLoader {
  private logger: Logger;
  private skillsDir: string;

  constructor(logger: Logger, skillsDir?: string) {
    this.logger = logger.child('skills-loader');
    this.skillsDir = skillsDir ?? join(process.env['HOME'] ?? '.', '.conshell', 'skills');
  }

  /**
   * 扫描 skills 目录，返回找到的所有技能元数据
   */
  scanAll(): SkillMeta[] {
    if (!existsSync(this.skillsDir)) {
      this.logger.info('Skills directory not found, skipping', { path: this.skillsDir });
      return [];
    }

    const entries = readdirSync(this.skillsDir, { withFileTypes: true });
    const skills: SkillMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = join(this.skillsDir, entry.name);
      const skillMdPath = join(skillDir, 'SKILL.md');

      if (!existsSync(skillMdPath)) {
        this.logger.debug('Skipping directory without SKILL.md', { dir: entry.name });
        continue;
      }

      try {
        const meta = this.loadSkill(skillDir);
        skills.push(meta);
      } catch (err) {
        this.logger.warn('Failed to load skill', { dir: entry.name, error: String(err) });
      }
    }

    this.logger.info('Skills scan complete', { found: skills.length, dir: this.skillsDir });
    return skills;
  }

  /**
   * 加载单个技能
   */
  loadSkill(skillDir: string): SkillMeta {
    const skillMdPath = join(skillDir, 'SKILL.md');
    const raw = readFileSync(skillMdPath, 'utf-8');
    const id = basename(skillDir);

    // Parse YAML frontmatter
    const frontmatter = this.parseFrontmatter(raw);
    const instructions = this.stripFrontmatter(raw);

    return {
      id,
      name: frontmatter['name'] ?? id,
      description: frontmatter['description'] ?? '',
      version: frontmatter['version'] ?? '0.0.0',
      author: frontmatter['author'] ?? 'unknown',
      instructions,
      path: skillDir,
      hasScripts: existsSync(join(skillDir, 'scripts')),
      loadedAt: new Date().toISOString(),
    };
  }

  /**
   * 检查单个技能是否存在
   */
  exists(skillId: string): boolean {
    const skillDir = join(this.skillsDir, skillId);
    return existsSync(join(skillDir, 'SKILL.md'));
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private parseFrontmatter(md: string): Record<string, string> {
    const match = md.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const result: Record<string, string> = {};
    for (const line of match[1]!.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        result[key] = value;
      }
    }
    return result;
  }

  private stripFrontmatter(md: string): string {
    return md.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  }
}
