// Shared types for the AI agent registry — each agent is a config object (system prompt +
// output contract), not a class, so registering a new one is just adding an entry.

export interface AgentDefinition<TContext = any> {
  id: string;
  label: string;
  // Default "how to behave" instructions shown/edited in the Agent Prompt Studio UI.
  // This is NOT the full prompt — the live data context (creator/campaign/thread) and the
  // strict JSON output contract are always built by buildPrompt and are not editable, so an
  // operator can't accidentally break response parsing while customizing tone/behavior.
  defaultInstructions: string;
  // Builds the full prompt text sent to Gemini for a given call. Receives whatever context
  // the caller passes in (creator, campaign, conversation, etc), plus the instructions text
  // to use for this run — either defaultInstructions or an operator-saved override.
  buildPrompt: (ctx: TContext, instructions: string) => string;
  // How long a duplicate request (same cache key) can reuse the last response.
  cacheTtlMs?: number;
  // Cache key for a given context — omit to disable caching for this agent.
  cacheKey?: (ctx: TContext) => string;
}

export interface AgentRunResult<T = any> {
  data: T;
  cached: boolean;
}
