/**
 * Runtime Module — 导出
 */
export { AgentStateMachine } from './state-machine.js';
export type { AgentLifecycleState, LifecycleEvent, StateTransition, StateChangeListener } from './state-machine.js';

export { ToolExecutor } from './tool-executor.js';
export type { ToolHandler, ToolExecutorOptions } from './tool-executor.js';

export { AgentLoop } from './agent-loop.js';
export type { AgentLoopOptions, TurnRecord } from './agent-loop.js';

export { HeartbeatDaemon } from './heartbeat.js';

export { TaskQueue } from './task-queue.js';
export type { QueuedTask, TaskResult, TaskQueueOptions } from './task-queue.js';

// Round 19.2 — Execution Pipeline
export { ExecutionGuard } from './execution-guard.js';
export type { AcquireResult, GuardStats } from './execution-guard.js';

export { ConflictReasoner } from './conflict-reasoner.js';
export type { ConflictKind, ConflictSeverity, ConflictResolution, ConflictReport, ConflictEntry, AgendaStateProvider, ExecutionContextProvider } from './conflict-reasoner.js';

export { ExecutionEconomicGate } from './execution-economic-gate.js';

// Round 19.2 — Wake & Session Infrastructure (G1 + G4)
export { WakeSemantics } from './wake-semantics.js';
export type { TriggerKind, TriggerStatus, WakeTrigger, Mission } from './wake-semantics.js';

export { SessionFabric } from './session-fabric.js';
export type { SessionStatus, ChannelKind, Session, SessionCreateInput, ControlCommand, ControlReceipt } from './session-fabric.js';

export { ScheduledAutonomy } from './scheduled-autonomy.js';
export type { AutonomyAction, AutonomyRule, AutonomyEffect, AgendaActionSink, DiagnosticsActionSink } from './scheduled-autonomy.js';

// Built-in tools
export {
  allBuiltinTools,
  webTools, webSearchTool, webBrowseTool,
  shellTools, shellExecTool,
  filesystemTools, fileReadTool, fileWriteTool, fileListTool,
  httpTools, httpRequestTool,
} from './tools/index.js';
