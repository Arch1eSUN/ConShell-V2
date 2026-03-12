/**
 * Compute — 计算提供者（本地进程 + Docker）
 */
import { spawn } from 'node:child_process';

export interface ComputeInstance {
  id: string;
  type: 'process' | 'docker';
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  containerId?: string;
}

export interface ComputeProvider {
  start(command: string, args?: string[]): Promise<ComputeInstance>;
  stop(id: string): Promise<void>;
  list(): ComputeInstance[];
}

export class LocalProcessProvider implements ComputeProvider {
  private instances = new Map<string, ComputeInstance & { process?: ReturnType<typeof spawn> }>();

  async start(command: string, args: string[] = []): Promise<ComputeInstance> {
    const id = `proc_${Date.now()}`;
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    const inst: ComputeInstance = { id, type: 'process', status: 'running', pid: child.pid };
    this.instances.set(id, { ...inst, process: child });
    return inst;
  }

  async stop(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (inst?.process) {
      inst.process.kill();
      inst.status = 'stopped';
    }
  }

  list(): ComputeInstance[] {
    return Array.from(this.instances.values()).map(({ process: _, ...rest }) => rest);
  }
}

export class DockerProvider implements ComputeProvider {
  private instances = new Map<string, ComputeInstance>();

  async start(image: string, _args: string[] = []): Promise<ComputeInstance> {
    const id = `docker_${Date.now()}`;
    // Placeholder — real implementation would use dockerode or shell
    const inst: ComputeInstance = { id, type: 'docker', status: 'running', containerId: id };
    this.instances.set(id, inst);
    return inst;
  }

  async stop(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (inst) inst.status = 'stopped';
  }

  list(): ComputeInstance[] { return Array.from(this.instances.values()); }
}
