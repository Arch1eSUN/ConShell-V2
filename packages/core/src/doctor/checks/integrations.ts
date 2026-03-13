/**
 * Integration health checks — EvoMap truth model.
 *
 * Round 14.1: Split into three observation layers:
 * 1. ConShell client implementation surface (code-inspection)
 * 2. Observed platform surface (network-observation)
 * 3. Unknown/unverified surface (hypothesis)
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

  // I1: EvoMap base reachability (network probe)
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
    evidenceType: 'network-observation',
  });

  // I2: EvoMap A2A hello endpoint (network probe)
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
    evidenceType: 'network-observation',
  });

  // I3: ConShell client implementation surface (code-inspection)
  // This reports what ConShell's EvoMapClient actually implements.
  // It is NOT a claim about what EvoMap the platform exposes.
  results.push({
    id: 'integ-evomap-implemented',
    label: 'EvoMap Client Implementation Surface',
    category: 'integrations',
    severity: 'info',
    status: 'pass',
    summary: 'ConShell client implements 2 RPC methods: gep.hello, gep.publish. No other methods are implemented in evomap/client.ts.',
    evidence: 'Code review of evomap/client.ts: only hello() and publish() methods exist.',
    confidence: 'high',
    evidenceType: 'code-inspection',
  });

  // I4: Observed EvoMap platform surface (network-observation + hypothesis)
  // This reports what has been observed at the platform level beyond what
  // ConShell implements. Critically distinct from I3.
  results.push({
    id: 'integ-evomap-observed',
    label: 'EvoMap Observed Platform Surface',
    category: 'integrations',
    severity: 'info',
    status: 'unknown',
    summary: [
      'Beyond gep.hello/gep.publish, the following have been observed via live interaction:',
      '  - /a2a/work/available: observed (returned structured response)',
      '  - /a2a/work/claim: observed (returned structured server-side validation error)',
      'ConShell does NOT implement these endpoints. Payload contracts are unresolved.',
      'Full EvoMap platform scope is UNKNOWN — client inspection cannot determine it.',
    ].join(' '),
    evidence: 'Historical network interaction logs from development sessions. Not re-verified in this run.',
    confidence: 'medium',
    evidenceType: 'historical-claim',
  });

  return results;
}
