export { runAgent, runTextAgent, classifyAgentError } from './runtime';
export type { AgentDefinition, AgentRunResult } from './types';

export {
  outreachFirstContactAgent,
  outreachReminder1Agent,
  outreachReminder2Agent,
  outreachReminder3Agent,
  OUTREACH_SEQUENCE_AGENTS,
  negotiationReplyAgent,
} from './outreach';
export type { OutreachEmailContext, ReminderContext, NegotiationReplyContext } from './outreach';

export { reviewComplianceChecklistAgent } from './review';
export type { ReviewComplianceContext } from './review';

export { opsDailySummaryAgent, opsPrioritySuggesterAgent } from './ops';
export type { DailySummaryContext, PrioritySuggesterContext } from './ops';

export { copilotChatAgent } from './chat';
export type { CopilotChatContext } from './chat';

// Full registry keyed by agent id — used by the "Agent Playground" tab in AiDrawer to list
// every trained agent and let the operator test one directly.
import { outreachFirstContactAgent, outreachReminder1Agent, outreachReminder2Agent, outreachReminder3Agent, negotiationReplyAgent } from './outreach';
import { reviewComplianceChecklistAgent } from './review';
import { opsDailySummaryAgent, opsPrioritySuggesterAgent } from './ops';
import { copilotChatAgent } from './chat';
import type { AgentDefinition } from './types';

export const AGENT_REGISTRY: Record<string, AgentDefinition<any>> = {
  [outreachFirstContactAgent.id]: outreachFirstContactAgent,
  [outreachReminder1Agent.id]: outreachReminder1Agent,
  [outreachReminder2Agent.id]: outreachReminder2Agent,
  [outreachReminder3Agent.id]: outreachReminder3Agent,
  [negotiationReplyAgent.id]: negotiationReplyAgent,
  [reviewComplianceChecklistAgent.id]: reviewComplianceChecklistAgent,
  [opsDailySummaryAgent.id]: opsDailySummaryAgent,
  [opsPrioritySuggesterAgent.id]: opsPrioritySuggesterAgent,
  [copilotChatAgent.id]: copilotChatAgent,
};
