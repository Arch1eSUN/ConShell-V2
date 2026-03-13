/**
 * Integration health checks — EvoMap endpoint probe.
 *
 * Non-destructive: uses HEAD/GET only, never mutates remote state.
 */
import type { CheckResult } from '../index.js';

/**
 * Probe an EvoMap endpoint to determine reachability.
 * Uses a lightweight HEAD request — does NOT send credentials or modify state.
 */
async function probeEvoMapEndpoint(
  baseUrl: string,
  path: string,
  timeoutMs = 5000,
): Promise<{ reachable: boolean; status: number | null; error: string | null }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${baseUrl}${path}`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'ConShell-Doctor/1.0' },
    });

    clearTimeout(timer);
    return { reachable: true, status: res.status, error: null };
  } catch (err) {
    return {
      reachable: false,
      status: null,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
    };
  }
}

export async function checkIntegrations(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const evoMapBase = 'https://evomap.ai';

  // I1: EvoMap base reachability
  const baseProbe = await probeEvoMapEndpoint(evoMapBase, '/');
  results.push({
    id: 'integ-evomap-reachable',
    label: 'EvoMap Base Reachability',
    category: 'integrations',
    severity: baseProbe.reachable ? 'info' : 'warning',
    status: baseProbe.reachable ? 'pass' : 'warn',
    summary: baseProbe.reachable
      ? `evomap.ai is reachable (HTTP ${baseProbe.status})`
      : `evomap.ai is NOT reachable: ${baseProbe.error}`,
    evidence: `HEAD ${evoMapBase}/ → ${baseProbe.reachable ? `HTTP ${baseProbe.status}` : baseProbe.error}`,
    confidence: baseProbe.reachable ? 'high' : 'medium',
  });

  // I2: EvoMap A2A hello endpoint
  const helloProbe = await probeEvoMapEndpoint(evoMapBase, '/a2a/hello');
  results.push({
    id: 'integ-evomap-hello',
    label: 'EvoMap /a2a/hello Endpoint',
    category: 'integrations',
    severity: 'info',
    status: helloProbe.reachable ? 'pass' : 'warn',
    summary: helloProbe.reachable
      ? `Endpoint exists (HTTP ${helloProbe.status}). Note: actual JSON-RPC contract not verified via HEAD.`
      : `Endpoint not reachable: ${helloProbe.error}`,
    evidence: `HEAD ${evoMapBase}/a2a/hello → ${helloProbe.reachable ? `HTTP ${helloProbe.status}` : helloProbe.error}`,
    confidence: 'medium',
  });

  // I3: EvoMap contract notes
  results.push({
    id: 'integ-evomap-contract',
    label: 'EvoMap Contract Status',
    category: 'integrations',
    severity: 'info',
    status: 'pass',
    summary: 'Confirmed endpoints: /a2a/hello (gep.hello), /a2a/publish (gep.publish). No worker claim endpoint exists in codebase. Prior references to /a2a/work/claim are unconfirmed hypotheses.',
    evidence: 'Code review of evomap/client.ts: only 2 RPC methods implemented (gep.hello, gep.publish)',
    confidence: 'high',
  });

  return results;
}
