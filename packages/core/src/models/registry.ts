/**
 * ModelRegistry — 模型偏好注册表
 */

export type InferenceTaskType = 'chat' | 'code' | 'embedding' | 'vision' | 'tool_use';

export interface ModelPreference {
  taskType: InferenceTaskType;
  modelId: string;
  priority: number;
}

export interface ModelEntry {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  costPerMTokenInput: number;
  costPerMTokenOutput: number;
  capabilities: InferenceTaskType[];
}

export class ModelRegistry {
  private models = new Map<string, ModelEntry>();
  private preferences: ModelPreference[] = [];

  register(entry: ModelEntry): void { this.models.set(entry.id, entry); }
  get(id: string): ModelEntry | undefined { return this.models.get(id); }
  list(): ModelEntry[] { return Array.from(this.models.values()); }

  setPreference(pref: ModelPreference): void {
    this.preferences = this.preferences.filter(p => p.taskType !== pref.taskType || p.modelId !== pref.modelId);
    this.preferences.push(pref);
    this.preferences.sort((a, b) => a.priority - b.priority);
  }

  getPreferred(taskType: InferenceTaskType): ModelEntry | undefined {
    const pref = this.preferences.find(p => p.taskType === taskType);
    return pref ? this.models.get(pref.modelId) : undefined;
  }
}
