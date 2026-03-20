import { describe, it, expect, vi } from 'vitest';
import { ContinuityService } from '../identity/continuity-service.js';
import { SchedulerService } from '../scheduler/scheduler-service.js';
import { MemorySchedulerBackend } from '../scheduler/memory-scheduler.js';
import { createScheduledTask } from '../scheduler/scheduler-contract.js';
import { Kernel } from './index.js';

describe('Kernel Scheduler Resume & Snapshot', () => {
  it('should restore scheduler state from snapshot during boot phase', () => {
    // 1. Mock continuity snapshot
    const mockSnapshot = {
      snapshotAt: new Date().toISOString(),
      pendingCount: 1,
      overdueCount: 0,
      tasks: [
        {
          id: 'mock-task-1',
          commitmentId: 'cmd-123',
          taskType: 'cognitive',
          description: 'Test task',
          status: 'pending',
          dueAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attempts: 0,
          maxRetries: 3
        }
      ]
    };
    
    // Simulate what Kernel Step 7.5 does
    const schedulerBackend = new MemorySchedulerBackend();
    const scheduler = new SchedulerService(schedulerBackend);
    
    // Kernel Step 7.5: Load recovery snapshot
    const snapshot = mockSnapshot as any; // mock cast to match schema
    if (snapshot) {
      scheduler.restore(snapshot);
    }
    
    expect(scheduler.pendingTasks().length).toBe(1);
    expect(scheduler.pendingTasks()[0].description).toBe('Test task');
  });

  it('should save scheduler snapshot on turn checkpoint', () => {
    // 1. Setup ContinuityService mock
    const continuityMock = {
      advanceForSession: vi.fn(),
      saveSchedulerSnapshot: vi.fn(),
      shouldAdvanceForSession: vi.fn().mockReturnValue(true),
      hydrated: true,
    } as unknown as ContinuityService;

    // 2. Setup SchedulerService
    const schedulerBackend = new MemorySchedulerBackend();
    const scheduler = new SchedulerService(schedulerBackend);
    
    // Add a pending task
    schedulerBackend.schedule(createScheduledTask({
      commitmentId: 'cmt-999',
      taskType: 'cognitive',
      description: 'Pending task to snapshot',
      dueAt: new Date().toISOString(),
    }));

    // 3. Wire Kernel
    const kernel = new Kernel();
    (kernel as any).services = {
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      continuity: continuityMock,
      scheduler: scheduler,
      memory: { getEpisodeCount: () => 5 },
      soul: { current: { raw: 'mock-soul' } },
    };
    (kernel as any)._running = true;

    // 4. Trigger checkpoint
    kernel.startSession('test-sess');
    kernel.checkpointTurn();

    // 5. Verify continuity.saveSchedulerSnapshot is called with correctly structured data
    expect(continuityMock.saveSchedulerSnapshot).toHaveBeenCalledTimes(1);
    const savedSnapshot = vi.mocked(continuityMock.saveSchedulerSnapshot).mock.calls[0][0];
    expect(savedSnapshot.pendingCount).toBe(1);
    expect(savedSnapshot.tasks[0].description).toBe('Pending task to snapshot');
  });
  
  it('should flush scheduler snapshot on shutdown', async () => {
    // 1. Setup ContinuityService mock
    const continuityMock = {
      advanceForSession: vi.fn(),
      saveSchedulerSnapshot: vi.fn(),
      shouldAdvanceForSession: vi.fn().mockReturnValue(true),
      hydrated: true,
    } as unknown as ContinuityService;

    // 2. Setup SchedulerService
    const schedulerBackend = new MemorySchedulerBackend();
    const scheduler = new SchedulerService(schedulerBackend);
    
    // Add a pending task
    schedulerBackend.schedule(createScheduledTask({
      commitmentId: 'cmt-1000',
      taskType: 'tool_call',
      description: 'Task for shutdown snapshot',
      dueAt: new Date().toISOString(),
    }));

    // 3. Wire Kernel
    const kernel = new Kernel();
    (kernel as any).services = {
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      continuity: continuityMock,
      scheduler: scheduler,
      memory: { getEpisodeCount: () => 6 },
      soul: { current: { raw: 'mock-soul' } },
      heartbeat: { stop: vi.fn() },
      httpServer: { stop: vi.fn() },
      stateMachine: { transition: vi.fn() }
    };
    (kernel as any)._running = true;

    // 4. Trigger shutdown
    await kernel.shutdown();

    // 5. Verify it was called during shutdown
    // Once during checkpointTurn inside shutdown, and again explicitly flush after
    expect(continuityMock.saveSchedulerSnapshot).toHaveBeenCalledTimes(2);
    const flushSnapshot = vi.mocked(continuityMock.saveSchedulerSnapshot).mock.calls[1][0];
    expect(flushSnapshot.pendingCount).toBe(1);
    expect(flushSnapshot.tasks[0].description).toBe('Task for shutdown snapshot');
  });
});
