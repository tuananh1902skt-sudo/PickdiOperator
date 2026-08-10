// Pool of first-contact subject lines, all rotating around the same "Paid Collaboration
// Opportunity | d'Alba Global" theme. Rotating through varied but professional-sounding
// subjects (rather than sending one identical line to every creator) reduces the
// identical-content fingerprint that spam filters key off of in bulk sends — see the
// deliverability discussion that motivated this file.
// Every entry must contain "Paid" — enforced below by ensurePaidSubject, but kept true here
// too so the pool itself never silently drifts away from that requirement.
export const FIRST_CONTACT_SUBJECT_POOL: string[] = [
  "Paid Collaboration Opportunity | d'Alba Global",
  "Paid Partnership Opportunity | d'Alba Global",
  "Paid Collaboration Invite | d'Alba Global",
  "d'Alba Global | Paid Collaboration Opportunity",
  "Paid Collab Opportunity — d'Alba Global",
  "Paid Collaboration Offer | d'Alba Global",
  "d'Alba Global x You — Paid Collaboration",
  "Paid Collaboration Opportunity — d'Alba Global Skincare",
  "Paid Collaboration Opportunity: d'Alba Global",
  "d'Alba Global Paid Collaboration Invite",
  "Paid Content Collaboration | d'Alba Global",
  "d'Alba Global | Paid Content Partnership",
  "Paid Collaboration Opportunity | d'Alba Global Skincare",
  "Paid Collaboration Opportunity - d'Alba",
  "d'Alba x Creators — Paid Collaboration",
  "Paid Collaboration Proposal | d'Alba Global",
  "d'Alba Global | Paid Collaboration Opportunity for You",
  "Paid Collaboration Opportunity | d'Alba Global Beauty",
  "d'Alba Global Invites You — Paid Collaboration",
  "Paid Collaboration | d'Alba Global Team",
  "Sponsored Collaboration Opportunity | d'Alba Global",
  "Paid Collaboration Opportunity — d'Alba Global Team",
  "d'Alba Global | Paid Collaboration",
  "Paid Collaboration Opportunity, d'Alba Global",
  "d'Alba Global Seeking Creator Partners — Paid Collaboration",
  "Paid Collaboration Opportunity || d'Alba Global",
  "Paid Collaboration Opportunity • d'Alba Global",
  "d'Alba Global | Paid Creator Collaboration",
  "Paid Collaboration Opportunity w/ d'Alba Global",
  "Paid Collaboration Opportunity | d'Alba Global Team",
  "d'Alba Global | Collaboration Opportunity (Paid)",
  "Paid Collaboration Opportunity from d'Alba Global",
  "d'Alba Global Creator Program — Paid Collaboration",
  "Paid Collaboration Opportunity | d'Alba Global Official",
  "d'Alba Global | Let's Collaborate (Paid)",
  "Paid Collaboration Opportunity | Team d'Alba Global",
  "Paid Collaboration Opportunity | d'Alba Global Partnerships",
  "d'Alba Global | Paid Collaboration Opportunity Awaits",
];

export function pickRandomFirstContactSubject(): string {
  return FIRST_CONTACT_SUBJECT_POOL[Math.floor(Math.random() * FIRST_CONTACT_SUBJECT_POOL.length)];
}

// Every outreach subject — first-contact or reminder, template or AI-drafted — must contain
// "Paid" so creators immediately see this is a paid opportunity, not organic outreach.
// AI-drafted subjects in particular aren't guaranteed to include it, so this is the one
// place that enforces it regardless of where the subject came from.
export function ensurePaidSubject(subject: string): string {
  if (/\bpaid\b/i.test(subject)) return subject;
  if (/^Re:\s*/i.test(subject)) return subject.replace(/^Re:\s*/i, 'Re: Paid ');
  return `Paid ${subject}`;
}
