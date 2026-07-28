import {
  Workspace,
  Creator,
  Campaign,
  OutreachEmail,
  Conversation,
  ContentReview,
  Task,
  NotificationItem,
  ActivityItem,
  DashboardKPIs
} from '../types';

export const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "ws_1",
    name: "Pickdi TikTok Agency",
    code: "PICKDI",
    brandName: "Pickdi Affiliate Operator",
    category: "E-commerce & Beauty",
    color: "indigo",
    description: "H\u1EC7 th\u1ED1ng v\u1EADn h\xE0nh Creator TikTok Shop CRM",
    isAgency: true,
    memberCount: 5,
    creatorCount: 12,
    activeCampaignCount: 3
  }
];
export const INITIAL_CREATORS: Creator[] = [];
export const INITIAL_CAMPAIGNS: Campaign[] = [];
export const INITIAL_OUTREACH: OutreachEmail[] = [];
export const INITIAL_CONVERSATIONS: Conversation[] = [];
export const INITIAL_REVIEWS: ContentReview[] = [];
export const INITIAL_TASKS: Task[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_ACTIVITIES: ActivityItem[] = [];
export const INITIAL_KPIS: DashboardKPIs = {
  todayEmailsSent: 0,
  todayRepliesReceived: 0,
  pendingReviewsCount: 0,
  overdueTasksCount: 0,
  activeCampaignsCount: 0,
  creatorsAddedThisWeek: 0,
  conversionRate: 0
};