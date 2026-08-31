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

// Registry theo agent id — chỉ còn nhóm outreach sau khi bỏ review/ops/copilot cùng AiDrawer.
import { outreachFirstContactAgent, outreachReminder1Agent, outreachReminder2Agent, outreachReminder3Agent, negotiationReplyAgent } from './outreach';
import type { AgentDefinition } from './types';

export const AGENT_REGISTRY: Record<string, AgentDefinition<any>> = {
  [outreachFirstContactAgent.id]: outreachFirstContactAgent,
  [outreachReminder1Agent.id]: outreachReminder1Agent,
  [outreachReminder2Agent.id]: outreachReminder2Agent,
  [outreachReminder3Agent.id]: outreachReminder3Agent,
  [negotiationReplyAgent.id]: negotiationReplyAgent,
};
