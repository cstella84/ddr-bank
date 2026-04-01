const ANTENNA_INGESTER_URL = process.env.ANTENNA_INGESTER_URL;
const ANTENNA_SOURCE_ID = process.env.ANTENNA_SOURCE_ID || 'agentic';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

interface CAEPEvent {
  sub_id: {
    format: string;
    email: string;
    verifyUserId?: string;
  };
  events: Record<string, Record<string, unknown>>;
}

/** Build a CAEP-style event payload. */
function buildCAEPEvent(
  eventType: string,
  email: string,
  details: Record<string, unknown>,
  verifyUserId: string | null
): CAEPEvent {
  return {
    sub_id: {
      format: 'email',
      email,
      ...(verifyUserId && { verifyUserId }),
    },
    events: {
      [eventType]: {
        ...details,
        event_timestamp: Math.floor(Date.now() / 1000),
      },
    },
  };
}

/** Send event to Antenna ingester (fire-and-forget). */
async function sendAntennaEvent(event: CAEPEvent): Promise<void> {
  if (!ANTENNA_INGESTER_URL) return;
  try {
    const res = await fetch(`${ANTENNA_INGESTER_URL}/sources/${ANTENNA_SOURCE_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    console.log(`[Antenna] Event sent: ${res.status}`);
  } catch (err) {
    console.error('[Antenna] Failed to send event:', (err as Error).message);
  }
}

/** Forward event to webhook dashboard (fire-and-forget). */
function sendWebhookEvent(event: unknown): void {
  if (!WEBHOOK_URL || !WEBHOOK_API_KEY) return;
  fetch(`${WEBHOOK_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Key': WEBHOOK_API_KEY,
    },
    body: JSON.stringify(event),
  }).catch((err) => console.warn('[Webhook] Failed:', err.message));
}

/** Emit a session-revoked CAEP event. */
export async function emitSessionRevoked(
  email: string,
  verifyUserId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  const event = buildCAEPEvent(
    'https://schemas.openid.net/secevent/caep/event-type/session-revoked',
    email,
    details,
    verifyUserId
  );
  await sendAntennaEvent(event);
  sendWebhookEvent(event);
}

/** Emit an assurance-level-change CAEP event. */
export async function emitAssuranceLevelChange(
  email: string,
  verifyUserId: string | null,
  from: string,
  to: string,
  details: Record<string, unknown>
): Promise<void> {
  const event = buildCAEPEvent(
    'https://schemas.openid.net/secevent/caep/event-type/assurance-level-change',
    email,
    { change: { from, to }, ...details },
    verifyUserId
  );
  await sendAntennaEvent(event);
  sendWebhookEvent(event);
}
