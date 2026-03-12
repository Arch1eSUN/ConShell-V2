/**
 * Git — 版本管理
 */
import { execSync } from 'node:child_process';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatus {
  branch: string;
  clean: boolean;
  modified: string[];
  untracked: string[];
}

export class GitManager {
  constructor(private cwd: string) {}

  status(): GitStatus {
    try {
      const branch = execSync('git branch --show-current', { cwd: this.cwd, encoding: 'utf-8' }).trim();
      const statusOut = execSync('git status --porcelain', { cwd: this.cwd, encoding: 'utf-8' });
      const lines = statusOut.split('\n').filter(Boolean);
      return {
        branch,
        clean: lines.length === 0,
        modified: lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).map(l => l.slice(3)),
        untracked: lines.filter(l => l.startsWith('??')).map(l => l.slice(3)),
      };
    } catch {
      return { branch: 'unknown', clean: true, modified: [], untracked: [] };
    }
  }

  log(n = 10): GitCommit[] {
    try {
      const out = execSync(`git log -${n} --pretty=format:"%H|%s|%an|%ai"`, { cwd: this.cwd, encoding: 'utf-8' });
      return out.split('\n').filter(Boolean).map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash: hash!, message: message!, author: author!, date: date! };
      });
    } catch { return []; }
  }

  commit(message: string): string {
    execSync('git add -A', { cwd: this.cwd });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.cwd });
    return execSync('git rev-parse HEAD', { cwd: this.cwd, encoding: 'utf-8' }).trim();
  }
}
