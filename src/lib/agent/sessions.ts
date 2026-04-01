import type { BaseMessage } from '@langchain/core/messages';

export interface AgentSession {
  chatHistory: BaseMessage[];
  accessToken: string;
  email: string;
  displayName: string;
  verifyUserId: string;
  pendingMFA: { id: string } | null;
}

// In-memory session store — keyed by uniqueSecurityName
const agentSessions = new Map<string, AgentSession>();

export function getAgentSession(sessionId: string): AgentSession | undefined {
  return agentSessions.get(sessionId);
}

export function createAgentSession(
  sessionId: string,
  accessToken: string,
  email: string,
  displayName: string,
  verifyUserId: string
): AgentSession {
  // Reuse existing session if present (preserves chat history)
  const existing = agentSessions.get(sessionId);
  if (existing) {
    existing.accessToken = accessToken;
    return existing;
  }

  const session: AgentSession = {
    chatHistory: [],
    accessToken,
    email,
    displayName,
    verifyUserId,
    pendingMFA: null,
  };
  agentSessions.set(sessionId, session);
  return session;
}

export function clearAgentSession(sessionId: string): void {
  agentSessions.delete(sessionId);
}
