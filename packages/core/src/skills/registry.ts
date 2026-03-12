/**
 * 技能注册表 — 管理已安装技能的生命周期
 *
 * 职责：
 * - 注册/注销技能
 * - 启用/禁用技能
 * - 技能搜索
 * - 与 SkillsRepository (SQLite) 持久化同步
 * - ClawHub 远程安装 (预留接口)
 */
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';
import { SkillsRepository } from '../state/repos/skills.js';
import type { SkillRow } from '../state/repos/skills.js';
import { SkillLoader } from './loader.js';
import type { SkillMeta } from './loader.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface RegisteredSkill extends SkillMeta {
  /** 是否启用 */
  enabled: boolean;
  /** 来源 (local / clawhub) */
  source: 'local' | 'clawhub';
}

// ── SkillRegistry ─────────────────────────────────────────────────────

export class SkillRegistry {
  private logger: Logger;
  private loader: SkillLoader;
  private repo: SkillsRepository;
  private skills = new Map<string, RegisteredSkill>();

  constructor(db: Database.Database, logger: Logger, skillsDir?: string) {
    this.logger = logger.child('skills-registry');
    this.loader = new SkillLoader(logger, skillsDir);
    this.repo = new SkillsRepository(db);
  }

  /**
   * 初始化: 扫描磁盘 + 同步数据库
   */
  initialize(): RegisteredSkill[] {
    // 1. Scan filesystem
    const diskSkills = this.loader.scanAll();

    // 2. Load DB state
    const dbSkills: readonly SkillRow[] = this.repo.listAll();
    const dbMap = new Map(dbSkills.map(s => [s.name, s]));

    for (const meta of diskSkills) {
      const dbEntry = dbMap.get(meta.id);

      const registered: RegisteredSkill = {
        ...meta,
        enabled: dbEntry ? dbEntry.enabled === 1 : true, // new skills default to enabled
        source: (dbEntry?.source as 'local' | 'clawhub') ?? 'local',
      };

      // Upsert to DB — uses the actual InsertSkill interface
      if (!dbEntry) {
        this.repo.upsert({
          name: meta.id,
          description: meta.description,
          content: meta.instructions,
          source: 'local',
        });
      }

      this.skills.set(meta.id, registered);
    }

    // Clean up DB entries for skills no longer on disk
    for (const dbSkill of dbSkills) {
      if (!this.skills.has(dbSkill.name)) {
        this.repo.delete(dbSkill.name);
        this.logger.info('Removed stale skill from DB', { id: dbSkill.name });
      }
    }

    this.logger.info('Skills initialized', {
      total: this.skills.size,
      enabled: this.getEnabled().length,
    });

    return this.listAll();
  }

  /** 获取所有已注册技能 */
  listAll(): RegisteredSkill[] {
    return Array.from(this.skills.values());
  }

  /** 获取已启用技能 */
  getEnabled(): RegisteredSkill[] {
    return this.listAll().filter(s => s.enabled);
  }

  /** 获取指定技能 */
  get(id: string): RegisteredSkill | undefined {
    return this.skills.get(id);
  }

  /** 启用技能 */
  enable(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = true;
    this.repo.setEnabled(id, true);
    this.logger.info('Skill enabled', { id });
    return true;
  }

  /** 禁用技能 */
  disable(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = false;
    this.repo.setEnabled(id, false);
    this.logger.info('Skill disabled', { id });
    return true;
  }

  /** 搜索技能 (按名称或描述) */
  search(query: string): RegisteredSkill[] {
    const q = query.toLowerCase();
    return this.listAll().filter(s =>
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
    );
  }

  /**
   * 从 ClawHub 安装技能 (预留接口)
   * TODO: 实现 ClawHub API 对接
   */
  async installFromClawHub(skillId: string): Promise<RegisteredSkill | null> {
    this.logger.warn('ClawHub installation not yet implemented', { skillId });
    return null;
  }

  /** 卸载技能 */
  uninstall(id: string): boolean {
    if (!this.skills.has(id)) return false;
    this.skills.delete(id);
    this.repo.delete(id);
    this.logger.info('Skill uninstalled', { id });
    // Note: doesn't delete files from disk — just removes from registry + DB
    return true;
  }

  /** 统计 */
  stats(): { total: number; enabled: number; disabled: number } {
    const all = this.listAll();
    const enabled = all.filter(s => s.enabled).length;
    return { total: all.length, enabled, disabled: all.length - enabled };
  }
}
