import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createTools } from './tools';
import { SYSTEM_PROMPT } from './system-prompt';
import { preToolCallMiddleware } from './middleware';
import { detectInjection, detectOffTopic, detectCrossUserAccess } from './guardrails';
import { recordViolation, revokeSessionForAbuse, getViolationCount } from './abuse';
import { hasPendingMFA, triggerMFA, validateMFA } from './mfa';
import {
  createAgentSession,
  getAgentSession,
  type AgentSession,
} from './sessions';

/** Extract text from LLM content (handles both string and Gemini's array-of-parts format). */
function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .filter(Boolean)
      .join('');
  }
  return String(content ?? '');
}
import { getVaultSecret } from '@/lib/server/vault';

type SendFn = (data: Record<string, unknown>) => void;

// Cache the Gemini API key at module level
let geminiApiKey: string | null = null;

async function getGeminiKey(): Promise<string> {
  if (geminiApiKey) return geminiApiKey;

  // Try Vault first, fall back to env var
  try {
    geminiApiKey = await getVaultSecret('GEMINI_API_KEY_SMT', 'GEMINI_API_KEY_SMT');
  } catch {
    geminiApiKey = process.env.GEMINI_API_KEY || null;
  }

  if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  return geminiApiKey;
}

/**
 * Run the agent for a user message. Streams SSE events via the `send` callback.
 * Handles guardrails, MFA, tool calls with middleware, and response streaming.
 */
export async function runAgent(
  sessionId: string,
  message: string,
  accessToken: string,
  email: string,
  displayName: string,
  verifyUserId: string,
  send: SendFn
): Promise<void> {
  // Get or create session
  const session = createAgentSession(sessionId, accessToken, email, displayName, verifyUserId);

  // === GUARDRAIL CHECKS (before LLM) ===
  if (detectInjection(message)) {
    const exceeded = recordViolation(sessionId, 'injection');
    if (exceeded) {
      await revokeSessionForAbuse(sessionId, email, verifyUserId);
      send({ role: 'ai', content: 'Your session has been terminated due to repeated policy violations.', type: 'session_revoked' });
      return;
    }
    send({ role: 'ai', content: '[INJECTION] I\'ve detected an attempt to modify my behavior. I can only assist with banking operations. Your request has been logged.', type: 'delta' });
    send({ type: 'end' });
    return;
  }

  if (detectOffTopic(message)) {
    const exceeded = recordViolation(sessionId, 'off_topic');
    if (exceeded) {
      await revokeSessionForAbuse(sessionId, email, verifyUserId);
      send({ role: 'ai', content: 'Your session has been terminated due to repeated policy violations.', type: 'session_revoked' });
      return;
    }
    const count = getViolationCount(sessionId);
    send({ role: 'ai', content: `[OFF_TOPIC] I'm designed to help with banking operations only. I can check balances, view transactions, or help with transfers. (Warning ${count}/5)`, type: 'delta' });
    send({ type: 'end' });
    return;
  }

  if (detectCrossUserAccess(message, email)) {
    const exceeded = recordViolation(sessionId, 'unauthorized');
    if (exceeded) {
      await revokeSessionForAbuse(sessionId, email, verifyUserId);
      send({ role: 'ai', content: 'Your session has been terminated due to repeated policy violations.', type: 'session_revoked' });
      return;
    }
    send({ role: 'ai', content: '[UNAUTHORIZED] I can only access your own account data. Attempting to access another user\'s information is not permitted.', type: 'delta' });
    send({ type: 'end' });
    return;
  }

  // === MFA VALIDATION (if pending) ===
  if (hasPendingMFA(sessionId)) {
    const valid = await validateMFA(message, sessionId, email, verifyUserId, send);
    if (!valid) {
      send({ type: 'end' });
      return;
    }
    // MFA validated — fall through to handle the original request
    send({ role: 'ai', content: 'MFA verified! Fetching the report data now...', type: 'delta' });
  }

  // === BUILD AND RUN THE LLM ===
  const apiKey = await getGeminiKey();
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    apiKey,
    temperature: 0.1,
  });

  const tools = createTools(sessionId);
  const modelWithTools = model.bindTools(tools);

  // Build messages
  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...session.chatHistory,
    new HumanMessage(message),
  ];

  // Run the model
  const response = await modelWithTools.invoke(messages);

  // Handle tool calls
  let finalSummary = '';

  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      send({
        role: 'ai',
        content: `Calling ${toolCall.name}...`,
        type: 'tool_planning',
      });

      // Run pre-tool middleware (introspection, RAR, HITL, guards)
      try {
        await preToolCallMiddleware(toolCall.name, toolCall.args as Record<string, unknown>, {
          sessionId,
          accessToken: session.accessToken,
          email,
          verifyUserId,
          send,
        });
      } catch (err) {
        // Middleware blocked the call (session revoked, HITL denied, etc.)
        send({ type: 'end' });
        return;
      }

      // MFA gate for reports
      if (toolCall.name === 'get_report_data' && !hasPendingMFA(sessionId)) {
        // First call — trigger MFA
        await triggerMFA(email, sessionId, send);
        send({ type: 'end' });
        // Store the pending request so we can resume after MFA
        session.chatHistory.push(new HumanMessage(message));
        return;
      }

      // Execute the tool
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        send({ role: 'ai', content: `Unknown tool: ${toolCall.name}`, type: 'error' });
        continue;
      }

      try {
        send({
          type: 'security:tool_execute',
          node: 'agent-execute',
          status: 'active',
          message: `Calling ${toolCall.name}`,
          timestamp: new Date().toISOString(),
        });
        send({
          type: 'security:tool_execute',
          node: 'core-api',
          status: 'active',
          message: `Executing ${toolCall.name}`,
          timestamp: new Date().toISOString(),
        });

        const toolResult = await (tool as any).invoke(toolCall.args);

        send({
          role: 'tool',
          content: String(toolResult),
          type: 'tool_output',
        });

        send({
          type: 'security:tool_execute',
          node: 'core-api',
          status: 'complete',
          message: `${toolCall.name} completed`,
          timestamp: new Date().toISOString(),
        });
        send({
          type: 'security:tool_execute',
          node: 'agent-execute',
          status: 'complete',
          message: 'Tool result received',
          timestamp: new Date().toISOString(),
        });

        // Notify client to refresh dashboard data after mutations
        if (toolCall.name === 'transfer_funds') {
          send({ type: 'data_updated' });
        }

        // Get LLM to summarize the tool output
        const followUp = await model.invoke([
          new SystemMessage(SYSTEM_PROMPT),
          new HumanMessage(message),
          new AIMessage(`I called ${toolCall.name} and got this result:\n${toolResult}`),
          new HumanMessage('Please summarize this for me in a friendly, readable way.'),
        ]);

        finalSummary = extractContent(followUp.content);
        if (finalSummary) send({ role: 'ai', content: finalSummary, type: 'delta' });
      } catch (err) {
        send({ role: 'ai', content: `Error executing ${toolCall.name}: ${(err as Error).message}`, type: 'error' });
      }
    }
  } else {
    // No tool calls — just a conversational response
    finalSummary = extractContent(response.content);
    if (finalSummary) send({ role: 'ai', content: finalSummary, type: 'delta' });
  }

  // Save to chat history — include the final summary so the LLM knows what already happened
  session.chatHistory.push(new HumanMessage(message));
  session.chatHistory.push(new AIMessage(finalSummary || extractContent(response.content)));

  // Keep history manageable (last 20 messages)
  if (session.chatHistory.length > 20) {
    session.chatHistory = session.chatHistory.slice(-20);
  }

  send({ type: 'end' });
}
