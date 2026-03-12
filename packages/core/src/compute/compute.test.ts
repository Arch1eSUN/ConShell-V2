/**
 * Compute Provider Tests
 */
import { describe, it, expect } from 'vitest';
import { DockerProvider } from './index.js';

// Note: LocalProcessProvider actually spawns processes — test DockerProvider (mock-friendly)

describe('DockerProvider', () => {
  it('starts instance', async () => {
    const provider = new DockerProvider();
    const inst = await provider.start('alpine:latest');
    expect(inst.id).toMatch(/^docker_/);
    expect(inst.type).toBe('docker');
    expect(inst.status).toBe('running');
    expect(inst.containerId).toBeTruthy();
  });

  it('stops instance', async () => {
    const provider = new DockerProvider();
    const inst = await provider.start('alpine:latest');
    await provider.stop(inst.id);
    const list = provider.list();
    expect(list.find(i => i.id === inst.id)?.status).toBe('stopped');
  });

  it('lists instances', async () => {
    const provider = new DockerProvider();
    await provider.start('img1');
    await new Promise(r => setTimeout(r, 2));
    await provider.start('img2');
    expect(provider.list()).toHaveLength(2);
  });

  it('handles stop on non-existent id gracefully', async () => {
    const provider = new DockerProvider();
    await expect(provider.stop('nonexistent')).resolves.toBeUndefined();
  });
});
