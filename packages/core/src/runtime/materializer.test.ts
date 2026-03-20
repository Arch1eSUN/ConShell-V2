import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommitmentMaterializer } from './materializer.js';
import { ExecutionGuard } from './execution-guard.js';
import { ExecutionAuditTrail } from './execution-audit.js';
import type { CommitmentStore } from '../agenda/index.js';
import type { AgentLoop } from './agent-loop.js';
import type { ToolExecutor } from './tool-executor.js';
import type { Commitment } from '../agenda/commitment-model.js';

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

describe('CommitmentMaterializer', () => {
  const logger = makeLogger();
  
  let agendaMock: any;
  let agentLoopMock: any;
  let toolExecutorMock: any;
  let guard: ExecutionGuard;
  let audit: ExecutionAuditTrail;

  beforeEach(() => {
    agendaMock = {
      isExecutionEligible: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      get: vi.fn(),
    } as unknown as CommitmentStore;

    agentLoopMock = {
      processMessage: vi.fn(),
    } as unknown as AgentLoop;

    toolExecutorMock = {
      executeOne: vi.fn(),
    } as unknown as ToolExecutor;

    guard = new ExecutionGuard(makeLogger());
    audit = new ExecutionAuditTrail(makeLogger());
  });

  const createDummyCommitment = (overrides: Partial<Commitment>): Commitment => ({
    id: 'comm-123',
    name: 'Dummy Commitment',
    kind: 'maintenance',
    origin: 'system',
    status: 'active',
    priority: 'normal',
    value: 10,
    cost: 1,
    mustPreserve: false,
    taskType: 'cognitive',
    materializedTaskCount: 0,
    identityContext: { identityId: 'sys', fingerprint: 'fp-123', status: 'active' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  } as Commitment);

  // ── Original behavior preserved ──

  it('vetoes execution if commitment is ineligible', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    const commitment = createDummyCommitment({ status: 'completed' });
    
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: false, reason: 'terminal' });

    const queuedTask = materializer.materialize(commitment);
    const result = await queuedTask.execute();

    expect(result).toEqual({ status: 'vetoed', reason: 'terminal' });
    expect(agentLoopMock.processMessage).not.toHaveBeenCalled();
    expect(toolExecutorMock.executeOne).not.toHaveBeenCalled();
    expect(agendaMock.markCompleted).not.toHaveBeenCalled();
    expect(agendaMock.markFailed).not.toHaveBeenCalled();
  });

  it('executes cognitive tasks via AgentLoop and completes successfully', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    const commitment = createDummyCommitment({ taskType: 'cognitive', description: 'Think about cats' });
    
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockResolvedValue('Meow');
    agendaMock.get.mockReturnValue({ status: 'completed' });

    const queuedTask = materializer.materialize(commitment);
    const result = await queuedTask.execute();

    expect(result).toEqual({ status: 'completed', result: 'Meow' });
    expect(agentLoopMock.processMessage).toHaveBeenCalledWith('Think about cats');
    expect(agendaMock.markCompleted).toHaveBeenCalledWith('comm-123');
  });

  it('executes tool_call tasks via ToolExecutor and completes successfully', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    const commitment = createDummyCommitment({ taskType: 'tool_call', name: 'calculator', description: '{"express": "2+2"}' });
    
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    toolExecutorMock.executeOne.mockResolvedValue({ isError: false, content: '4' });
    agendaMock.get.mockReturnValue({ status: 'completed' });

    const queuedTask = materializer.materialize(commitment);
    const result = await queuedTask.execute();

    expect(result).toEqual({ status: 'completed', result: { isError: false, content: '4' } });
    expect(toolExecutorMock.executeOne).toHaveBeenCalledWith(expect.objectContaining({
      name: 'calculator',
      arguments: '{"express": "2+2"}'
    }));
    expect(agendaMock.markCompleted).toHaveBeenCalledWith('comm-123');
  });

  it('handles execution failures and marks commitment as failed', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    const commitment = createDummyCommitment({ taskType: 'cognitive' });
    
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockRejectedValue(new Error('Agent crashed'));
    agendaMock.get.mockReturnValue({ status: 'failed' });

    const queuedTask = materializer.materialize(commitment);
    const result = await queuedTask.execute();

    expect(result).toEqual({ status: 'failed', reason: 'Agent crashed' });
    expect(agendaMock.markFailed).toHaveBeenCalledWith('comm-123', 'Agent crashed');
  });

  // ── Round 19.2: ExecutionGuard integration ──

  it('guard blocks concurrent execution of the same commitment', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    materializer.setGuard(guard);
    materializer.setAuditTrail(audit);

    const commitment = createDummyCommitment({});
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    
    // Simulate a long-running task
    agentLoopMock.processMessage.mockImplementation(() => new Promise(() => {})); // never resolves

    const q1 = materializer.materialize(commitment);
    const q2 = materializer.materialize(commitment);
    
    // Start first execution (will hang)
    const p1 = q1.execute();
    
    // Second execution should be guard-denied
    const r2 = await q2.execute();
    expect(r2).toEqual(expect.objectContaining({ status: 'guard-denied' }));
    
    // Verify audit recorded the denial
    const stats = audit.stats();
    expect(stats.guardDenied).toBe(1);
  });

  it('guard blacklist prevents re-execution of terminal commitments', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    materializer.setGuard(guard);
    materializer.setAuditTrail(audit);

    const commitment = createDummyCommitment({});
    
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockResolvedValue('done');
    agendaMock.get.mockReturnValue({ status: 'completed' }); // terminal

    const q1 = materializer.materialize(commitment);
    await q1.execute();

    // Now the guard should have blacklisted this commitment
    expect(guard.isTerminal('comm-123')).toBe(true);

    // Second attempt should be denied
    const q2 = materializer.materialize(commitment);
    const r2 = await q2.execute();
    expect(r2).toEqual(expect.objectContaining({ status: 'guard-denied' }));
  });

  // ── Round 19.2: ExecutionAuditTrail integration ──

  it('records audit entries for completed executions', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    materializer.setAuditTrail(audit);

    const commitment = createDummyCommitment({});
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockResolvedValue('ok');
    agendaMock.get.mockReturnValue({ status: 'completed' });

    const q = materializer.materialize(commitment);
    await q.execute();

    const history = audit.getHistory('comm-123');
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe('completed');
    expect(history[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records audit entries for vetoed executions', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    materializer.setAuditTrail(audit);

    const commitment = createDummyCommitment({});
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: false, reason: 'stale' });

    const q = materializer.materialize(commitment);
    await q.execute();

    const history = audit.getHistory('comm-123');
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe('vetoed');
    expect(history[0].reason).toBe('stale');
  });

  it('records audit entries for failed executions', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);
    materializer.setAuditTrail(audit);

    const commitment = createDummyCommitment({});
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockRejectedValue(new Error('boom'));
    agendaMock.get.mockReturnValue({ status: 'failed' });

    const q = materializer.materialize(commitment);
    await q.execute();

    const history = audit.getHistory('comm-123');
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe('failed');
    expect(history[0].reason).toBe('boom');
  });

  // ── Round 19.2: Drift detection via isExecutionEligible ──

  it('passes snapshotUpdatedAt to isExecutionEligible for drift detection', async () => {
    const materializer = new CommitmentMaterializer(logger, agendaMock, agentLoopMock, toolExecutorMock);

    const updatedAt = '2026-03-20T10:00:00.000Z';
    const commitment = createDummyCommitment({ updatedAt });
    agendaMock.isExecutionEligible.mockReturnValue({ eligible: true });
    agentLoopMock.processMessage.mockResolvedValue('ok');
    agendaMock.get.mockReturnValue({ status: 'completed' });

    const q = materializer.materialize(commitment);
    await q.execute();

    // isExecutionEligible should have been called with the snapshot timestamp
    expect(agendaMock.isExecutionEligible).toHaveBeenCalledWith('comm-123', updatedAt);
  });
});
