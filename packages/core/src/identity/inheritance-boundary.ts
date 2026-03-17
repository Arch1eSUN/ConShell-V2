/**
 * Inheritance Boundary — Round 15.6 (Goal F)
 *
 * Defines what a child agent can and cannot inherit from its parent.
 * This is the lineage contract — it determines which parts of the
 * parent's identity, memory, soul, and capabilities are transmissible.
 *
 * Three policies:
 *   - inherit: child receives exact copy
 *   - derive: child receives a derived/adapted version
 *   - exclude: child cannot access this
 */

// ── Types ─────────────────────────────────────────────────────────────

/** Policy for a single inheritable field */
export type InheritancePolicy = 'inherit' | 'derive' | 'exclude';

/** A single inheritance rule */
export interface InheritanceRule {
  /** The field or domain being governed */
  field: string;
  /** How this field is transmitted to children */
  policy: InheritancePolicy;
  /** Human-readable reason for this policy */
  reason: string;
}

/**
 * Complete inheritance manifest — defines the full boundary
 * between parent and child identity/memory.
 */
export interface InheritanceManifest {
  /** Identity-related fields */
  identity: InheritanceRule[];
  /** Memory-related fields (by MemoryClass) */
  memories: InheritanceRule[];
  /** Soul-related fields */
  soul: InheritanceRule[];
  /** Capability/service-related fields */
  capabilities: InheritanceRule[];
}

// ── Default Manifest ─────────────────────────────────────────────────

/**
 * The canonical default inheritance manifest.
 * This is the baseline — operators can override via config.
 */
export const DEFAULT_INHERITANCE_MANIFEST: InheritanceManifest = Object.freeze({
  identity: [
    { field: 'anchor.id', policy: 'exclude', reason: 'Each agent has its own genesis identity' },
    { field: 'anchor.name', policy: 'derive', reason: 'Child derives name from parent lineage' },
    { field: 'anchor.walletAddress', policy: 'exclude', reason: 'Each agent has its own wallet' },
    { field: 'lineage', policy: 'inherit', reason: 'Lineage chain is always inherited' },
    { field: 'generation', policy: 'derive', reason: 'Child is parent.generation + 1' },
  ],
  memories: [
    { field: 'self', policy: 'exclude', reason: 'Self-defining memories are non-transferable' },
    { field: 'user', policy: 'exclude', reason: 'User relationships are non-transferable' },
    { field: 'environment', policy: 'exclude', reason: 'Environment state may differ for child' },
    { field: 'session', policy: 'exclude', reason: 'Session memory is ephemeral by definition' },
    { field: 'lineage', policy: 'inherit', reason: 'Lineage memories exist to be inherited' },
  ],
  soul: [
    { field: 'name', policy: 'derive', reason: 'Child has derived name' },
    { field: 'personality', policy: 'derive', reason: 'Child starts with parent personality, can evolve' },
    { field: 'values', policy: 'inherit', reason: 'Core values are inherited as foundation' },
    { field: 'goals', policy: 'derive', reason: 'Child receives parent goals as starting point' },
    { field: 'communicationStyle', policy: 'inherit', reason: 'Communication style carries over' },
  ],
  capabilities: [
    { field: 'tools', policy: 'inherit', reason: 'Tool registrations are inheritable' },
    { field: 'skills', policy: 'inherit', reason: 'Learned skills transfer to children' },
    { field: 'services', policy: 'derive', reason: 'Service declarations adapted for child context' },
  ],
}) as InheritanceManifest;

// ── Query helpers ─────────────────────────────────────────────────────

/**
 * Get the inheritance policy for a specific field.
 * Searches all categories in priority: identity → memories → soul → capabilities.
 */
export function getPolicy(
  manifest: InheritanceManifest,
  field: string,
): InheritancePolicy | null {
  for (const category of [manifest.identity, manifest.memories, manifest.soul, manifest.capabilities]) {
    const rule = category.find(r => r.field === field);
    if (rule) return rule.policy;
  }
  return null;
}

/**
 * Get all fields with a specific policy.
 */
export function getFieldsByPolicy(
  manifest: InheritanceManifest,
  policy: InheritancePolicy,
): string[] {
  const fields: string[] = [];
  for (const category of [manifest.identity, manifest.memories, manifest.soul, manifest.capabilities]) {
    for (const rule of category) {
      if (rule.policy === policy) {
        fields.push(rule.field);
      }
    }
  }
  return fields;
}

/**
 * Check if a field is inheritable (inherit or derive).
 */
export function isFieldInheritable(
  manifest: InheritanceManifest,
  field: string,
): boolean {
  const policy = getPolicy(manifest, field);
  return policy === 'inherit' || policy === 'derive';
}

/**
 * Validate a manifest for completeness.
 * Returns issues if critical fields are missing.
 */
export function validateManifest(manifest: InheritanceManifest): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (manifest.identity.length === 0) issues.push('No identity inheritance rules defined');
  if (manifest.memories.length === 0) issues.push('No memory inheritance rules defined');
  if (manifest.soul.length === 0) issues.push('No soul inheritance rules defined');

  // Self-memory must be excluded (invariant)
  const selfRule = manifest.memories.find(r => r.field === 'self');
  if (selfRule && selfRule.policy !== 'exclude') {
    issues.push('Self-defining memories must have "exclude" policy');
  }

  // User-memory must be excluded (privacy)
  const userRule = manifest.memories.find(r => r.field === 'user');
  if (userRule && userRule.policy !== 'exclude') {
    issues.push('User memories must have "exclude" policy (privacy)');
  }

  return { valid: issues.length === 0, issues };
}
