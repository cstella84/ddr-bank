"use client";

import { useState, useCallback, useRef } from 'react';
import type { SecurityEvent } from '@/components/SecurityPanel';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  type?: 'delta' | 'tool_planning' | 'tool_output' | 'error' | 'session_revoked' |
    'push_auth_pending' | 'push_auth_polling' | 'push_auth_approved' | 'push_auth_denied' | 'push_auth_timeout';
  pushAuthId?: string;
  attempt?: number;
}

type PushAuthState = 'idle' | 'pending' | 'polling' | 'approved' | 'denied' | 'timeout';

export function useChat(onSecurityEvent?: (event: SecurityEvent) => void, onDataUpdated?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I can help you check balances, review transactions, or transfer funds. What can I help with?',
      type: 'delta',
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pushAuthState, setPushAuthState] = useState<PushAuthState>('idle');
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const messageIdRef = useRef(1);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || sessionRevoked) return;

      const userMsg: ChatMessage = {
        id: String(messageIdRef.current++),
        role: 'user',
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text.trim() }),
        });

        if (!res.ok || !res.body) {
          setMessages((prev) => [
            ...prev,
            {
              id: String(messageIdRef.current++),
              role: 'assistant',
              content: 'Connection failed. Please try again.',
              type: 'error',
            },
          ]);
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentAiMessageId: string | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.substring(6));
            } catch {
              continue;
            }

            const eventType = data.type as string;

            // Security events — forward to parent
            if (eventType?.startsWith('security:')) {
              onSecurityEvent?.({
                type: eventType.replace('security:', ''),
                node: data.node as string,
                status: data.status as string,
                message: data.message as string,
                timestamp: data.timestamp as string,
              });
              continue;
            }

            switch (eventType) {
              case 'delta': {
                const msgId = String(messageIdRef.current++);
                currentAiMessageId = msgId;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: msgId,
                    role: 'assistant',
                    content: data.content as string,
                    type: 'delta',
                  },
                ]);
                break;
              }

              case 'tool_planning':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'tool_planning',
                  },
                ]);
                break;

              case 'tool_output':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'tool',
                    content: data.content as string,
                    type: 'tool_output',
                  },
                ]);
                break;

              case 'push_auth_pending':
                setPushAuthState('pending');
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'push_auth_pending',
                    pushAuthId: data.pushAuthId as string,
                  },
                ]);
                break;

              case 'push_auth_polling':
                setPushAuthState('polling');
                setPollAttempt(data.attempt as number);
                break;

              case 'push_auth_approved':
                setPushAuthState('approved');
                setTimeout(() => setPushAuthState('idle'), 2000);
                break;

              case 'push_auth_denied':
                setPushAuthState('denied');
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'push_auth_denied',
                  },
                ]);
                setTimeout(() => setPushAuthState('idle'), 3000);
                break;

              case 'push_auth_timeout':
                setPushAuthState('timeout');
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'push_auth_timeout',
                  },
                ]);
                setTimeout(() => setPushAuthState('idle'), 3000);
                break;

              case 'session_revoked':
                setSessionRevoked(true);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'session_revoked',
                  },
                ]);
                break;

              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(messageIdRef.current++),
                    role: 'assistant',
                    content: data.content as string,
                    type: 'error',
                  },
                ]);
                break;

              case 'data_updated':
                onDataUpdated?.();
                break;

              case 'end':
                break;
            }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(messageIdRef.current++),
            role: 'assistant',
            content: 'Agent connection failed. Please try again.',
            type: 'error',
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, sessionRevoked, onSecurityEvent, onDataUpdated]
  );

  const clearChat = useCallback(async () => {
    try {
      await fetch('/api/agent/clear', { method: 'POST' });
    } catch {
      // Non-fatal
    }
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content: 'Chat cleared. How can I help you?',
        type: 'delta',
      },
    ]);
    setSessionRevoked(false);
    setPushAuthState('idle');
  }, []);

  return {
    messages,
    isStreaming,
    pushAuthState,
    pollAttempt,
    sessionRevoked,
    sendMessage,
    clearChat,
  };
}
