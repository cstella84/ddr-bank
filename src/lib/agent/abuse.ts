import type { ViolationType } from './guardrails';
import { emitSessionRevoked } from './caep';

interface ViolationRecord {
  offTopic: number;
  unauthorized: number;
  injection: number;
  total: number;
}

const sessionViolations = new Map<string, ViolationRecord>();
const THRESHOLD = parseInt(process.env.ABUSE_VIOLATION_THRESHOLD || '5');

/**
 * Record a guardrail violation for a session.
 * Returns true if the threshold has been exceeded (session should be revoked).
 */
export function recordViolation(sessionId: string, type: ViolationType): boolean {
  let record = sessionViolations.get(sessionId);
  if (!record) {
    record = { offTopic: 0, unauthorized: 0, injection: 0, total: 0 };
    sessionViolations.set(sessionId, record);
  }

  if (type === 'off_topic') record.offTopic++;
  if (type === 'unauthorized') record.unauthorized++;
  if (type === 'injection') record.injection++;
  record.total++;

  console.log(
    `[Guardrails] Session ${sessionId} violation: ${type} (total: ${record.total}/${THRESHOLD})`
  );

  return record.total >= THRESHOLD;
}

/** Get current violation count for a session. */
export function getViolationCount(sessionId: string): number {
  return sessionViolations.get(sessionId)?.total ?? 0;
}

/** Revoke a session due to accumulated abuse violations. */
export async function revokeSessionForAbuse(
  sessionId: string,
  email: string,
  verifyUserId: string | null
): Promise<void> {
  const record = sessionViolations.get(sessionId);
  const summary = record
    ? `off-topic: ${record.offTopic}, unauthorized: ${record.unauthorized}, injection: ${record.injection}`
    : 'unknown';

  await emitSessionRevoked(email, verifyUserId, {
    reasonAdmin: {
      en: `Session revoked: abuse threshold (${THRESHOLD}) exceeded. Violations: ${summary}`,
    },
    reasonUser: {
      en: 'Your session has been terminated due to repeated policy violations.',
    },
    initiatingEntity: 'policy',
  });

  sessionViolations.delete(sessionId);
}

export function clearViolations(sessionId: string): void {
  sessionViolations.delete(sessionId);
}
