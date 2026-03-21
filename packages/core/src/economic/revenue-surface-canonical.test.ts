/**
 * Round 20.2 — Revenue Surface Canonical Tests (G1)
 */
import { describe, it, expect } from 'vitest';
import {
  createTaskRevenueSurface,
  validateTaskRevenueSurface,
  type TaskRevenueSurfaceConfig,
  type TaskRevenueSurface,
  RevenueSurfaceRegistry,
} from './revenue-surface.js';

// ── Factory Tests ───────────────────────────────────────────────────

describe('createTaskRevenueSurface', () => {
  const baseConfig: TaskRevenueSurfaceConfig = {
    id: 'task-indexing',
    name: 'Document Indexing Service',
    basePriceCents: 1000,
    executionCostEstimateCents: 400,
    riskLevel: 'low',
    settlementMode: 'post_completion',
    expectedPayoffWindowMs: 300_000,
  };

  it('creates a valid TaskRevenueSurface with correct fields', () => {
    const surface = createTaskRevenueSurface(baseConfig);
    expect(surface.id).toBe('task-indexing');
    expect(surface.type).toBe('task_service');
    expect(surface.name).toBe('Document Indexing Service');
    expect(surface.executionCostEstimateCents).toBe(400);
    expect(surface.riskLevel).toBe('low');
    expect(surface.settlementMode).toBe('post_completion');
    expect(surface.expectedPayoffWindowMs).toBe(300_000);
  });

  it('computes marginCents correctly', () => {
    const surface = createTaskRevenueSurface(baseConfig);
    expect(surface.marginCents).toBe(600); // 1000 - 400
    expect(surface.netUtilityCents).toBe(600);
  });

  it('handles negative margin (cost > price)', () => {
    const surface = createTaskRevenueSurface({
      ...baseConfig,
      executionCostEstimateCents: 1500,
    });
    expect(surface.marginCents).toBe(-500);
    expect(surface.netUtilityCents).toBe(-500);
  });

  it('defaults dynamicPricing to true', () => {
    const surface = createTaskRevenueSurface(baseConfig);
    expect(surface.pricePolicy.dynamicPricing).toBe(true);
  });

  it('initializes with zero earned and active', () => {
    const surface = createTaskRevenueSurface(baseConfig);
    expect(surface.isActive).toBe(true);
    expect(surface.totalEarnedCents).toBe(0);
    expect(surface.transactionCount).toBe(0);
  });

  it('is registerable in existing RevenueSurfaceRegistry', () => {
    const registry = new RevenueSurfaceRegistry();
    const surface = createTaskRevenueSurface(baseConfig);
    registry.register(surface);
    expect(registry.get('task-indexing')).toBeDefined();
    expect(registry.get('task-indexing')!.type).toBe('task_service');
  });
});

// ── Validator Tests ─────────────────────────────────────────────────

describe('validateTaskRevenueSurface', () => {
  it('returns no errors for valid surface', () => {
    const surface = createTaskRevenueSurface({
      id: 'valid-task',
      name: 'Valid Task',
      basePriceCents: 500,
      executionCostEstimateCents: 200,
      riskLevel: 'medium',
      settlementMode: 'prepaid',
      expectedPayoffWindowMs: 60_000,
    });
    expect(validateTaskRevenueSurface(surface)).toHaveLength(0);
  });

  it('detects negative basePriceCents', () => {
    const surface = createTaskRevenueSurface({
      id: 'bad',
      name: 'Bad',
      basePriceCents: -100,
      executionCostEstimateCents: 50,
      riskLevel: 'low',
      settlementMode: 'post_completion',
      expectedPayoffWindowMs: 1000,
    });
    const errors = validateTaskRevenueSurface(surface);
    expect(errors).toContain('basePriceCents must be non-negative');
  });

  it('detects margin mismatch', () => {
    const surface = createTaskRevenueSurface({
      id: 'test',
      name: 'Test',
      basePriceCents: 1000,
      executionCostEstimateCents: 400,
      riskLevel: 'low',
      settlementMode: 'milestone',
      expectedPayoffWindowMs: 5000,
    });
    // Tamper with margin
    const tampered = { ...surface, marginCents: 999 } as TaskRevenueSurface;
    const errors = validateTaskRevenueSurface(tampered);
    expect(errors).toContain('marginCents does not match basePriceCents - executionCostEstimateCents');
  });

  it('detects invalid expectedPayoffWindowMs', () => {
    const surface = createTaskRevenueSurface({
      id: 'test',
      name: 'Test',
      basePriceCents: 100,
      executionCostEstimateCents: 50,
      riskLevel: 'high',
      settlementMode: 'prepaid',
      expectedPayoffWindowMs: 0,
    });
    const errors = validateTaskRevenueSurface(surface);
    expect(errors).toContain('expectedPayoffWindowMs must be positive');
  });
});
