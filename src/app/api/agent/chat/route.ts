import { NextRequest } from 'next/server';
import { parseIdToken } from '@/lib/server/auth';
import { getOrCreateSession } from '@/lib/server/data-store';
import { runAgent } from '@/lib/agent';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60s max

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  const idToken = req.cookies.get('id_token')?.value;

  if (!accessToken || !idToken) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message } = await req.json();
  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let user;
  try {
    user = parseIdToken(idToken);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure data store session exists
  getOrCreateSession(user.uniqueSecurityName, user.preferred_username, user.displayName);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may have been closed by client disconnect
        }
      };

      try {
        await runAgent(
          user.uniqueSecurityName,
          message,
          accessToken,
          user.email,
          user.displayName,
          user.sub,
          send
        );
      } catch (err) {
        send({ type: 'error', content: (err as Error).message });
        send({ type: 'end' });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
