const INJECTION_PATTERNS = [
  /ignore\s+(your|all|previous|prior)\s+(instructions|rules|prompt)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|a|an)/i,
  /jailbreak/i,
  /reveal\s+(your|the)\s+(prompt|instructions|system)/i,
  /forget\s+(your|all|previous)\s+(instructions|rules)/i,
  /you\s+are\s+now/i,
  /override\s+(your|all)\s+(rules|instructions)/i,
  /\bDAN\b/,
];

const OFF_TOPIC_INDICATORS = [
  /weather/i,
  /recipe/i,
  /joke/i,
  /poem/i,
  /story/i,
  /song/i,
  /game/i,
  /movie/i,
  /sports/i,
  /politics/i,
  /religion/i,
  /write\s+(me\s+)?(a|an)\s+(code|program|script|essay)/i,
  /how\s+to\s+(hack|crack|exploit)/i,
];

export type ViolationType = 'off_topic' | 'injection' | 'unauthorized';

/** Detect prompt injection attempts. */
export function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(message));
}

/** Detect off-topic messages unrelated to banking. */
export function detectOffTopic(message: string): boolean {
  return OFF_TOPIC_INDICATORS.some((p) => p.test(message));
}

/** Detect attempts to access other users' data. */
export function detectCrossUserAccess(message: string, currentUsername: string): boolean {
  // Look for patterns like "alice's account", "show me bob's", "user john"
  const crossUserPatterns = [
    /(?:show|get|view|access|check|see)\s+(?:me\s+)?(\w+)(?:'s|s)\s+(?:account|balance|data|transaction|info)/i,
    /(?:transfer|send|move)\s+(?:from|to)\s+(\w+)(?:'s|s)\s+(?:account)/i,
    /(?:another|other|different)\s+user/i,
  ];

  for (const pattern of crossUserPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const mentioned = match[1].toLowerCase();
      const current = currentUsername.split('@')[0].toLowerCase();
      // Only flag if the mentioned user is different from current user
      if (mentioned !== current && mentioned !== 'my' && mentioned !== 'the') {
        return true;
      }
    }
  }

  return false;
}
