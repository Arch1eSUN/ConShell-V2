/**
 * GitManager Tests
 */
import { describe, it, expect } from 'vitest';
import { GitManager } from './index.js';

describe('GitManager', () => {
  it('returns status for current repo', () => {
    const gm = new GitManager(process.cwd());
    const st = gm.status();
    expect(st.branch).toBeTruthy();
    expect(typeof st.clean).toBe('boolean');
    expect(Array.isArray(st.modified)).toBe(true);
    expect(Array.isArray(st.untracked)).toBe(true);
  });

  it('returns log for current repo', () => {
    const gm = new GitManager(process.cwd());
    const log = gm.log(3);
    // May be empty if repo is fresh but should be an array
    expect(Array.isArray(log)).toBe(true);
  });

  it('handles invalid cwd gracefully', () => {
    const gm = new GitManager('/tmp/nonexistent-repo-abc123');
    const st = gm.status();
    expect(st.branch).toBe('unknown');
    expect(st.clean).toBe(true);
  });

  it('handles log for invalid cwd', () => {
    const gm = new GitManager('/tmp/nonexistent-repo-abc123');
    const log = gm.log();
    expect(log).toEqual([]);
  });
});
