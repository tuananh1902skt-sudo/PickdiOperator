// Pool of reminder-#1 subject+body variants — same "avoid an identical-content fingerprint
// across a bulk batch" motivation as FIRST_CONTACT_SUBJECT_POOL in outreachSubjects.ts, but
// here it covers both subject AND body since reminder_1's template-mode content used to be
// one single fixed pair (only {{creatorName}} differed), which read as obviously templated
// once a creator compared notes with another. Body text is the hero's intro paragraph (see
// introText in emailTemplate.ts) — it must NOT open with "Hi {{creatorName}}," since the
// greeting is already rendered separately above it. Every subject contains "Paid" already
// (ensurePaidSubject in outreachSubjects.ts still guarantees it as a backstop).
export interface Reminder1Variant {
  subject: string;
  body: string;
}

export const REMINDER_1_VARIANT_POOL: Reminder1Variant[] = [
  { subject: "Following Up: Paid Collaboration Opportunity | {{brandName}}", body: "Just want to make sure this doesn't get lost in your inbox — the paid collaboration opportunity with {{brandName}} for {{productName}} is still open, and we'd genuinely love to hear from you." },
  { subject: "Don't Want This to Get Buried — Paid Collaboration | {{brandName}}", body: "Circling back in case our last email slipped by — {{brandName}} would still love to have you on board for {{productName}}, paid collaboration and all." },
  { subject: "Quick Nudge: Paid Collaboration | {{brandName}}", body: "Just a quick nudge so this doesn't get lost in the shuffle — the paid collaboration for {{productName}} with {{brandName}} is still on the table if you're interested." },
  { subject: "Checking In: Paid Collaboration Opportunity | {{brandName}}", body: "Wanted to resurface this before it gets buried under newer emails — {{brandName}} is still hoping to collaborate with you (paid, of course) on {{productName}}." },
  { subject: "Paid Collaboration Still Open | {{brandName}}", body: "In case this got lost in a busy inbox — the paid collaboration opportunity for {{productName}} with {{brandName}} hasn't gone anywhere, and we'd love to hear back." },
  { subject: "Popping Back Into Your Inbox — Paid Collaboration | {{brandName}}", body: "Popping back in before this slips further down your inbox — {{brandName}} would still love to work with you on a paid collaboration for {{productName}}." },
  { subject: "One More Note: Paid Collaboration | {{brandName}}", body: "One more note so this doesn't quietly disappear — the paid collaboration offer from {{brandName}} for {{productName}} is still open whenever you're ready." },
  { subject: "Re-surfacing: Paid Collaboration Opportunity | {{brandName}}", body: "Re-surfacing this in case it got buried — {{brandName}} is still keen to collaborate with you, paid, on {{productName}}." },
  { subject: "Before This Gets Lost — Paid Collaboration | {{brandName}}", body: "Before this gets lost among everything else in your inbox, just wanted to check — is a paid collaboration on {{productName}} with {{brandName}} something you'd be open to?" },
  { subject: "Still Here: Paid Collaboration Opportunity | {{brandName}}", body: "Still here, still hoping to hear from you — {{brandName}}'s paid collaboration offer for {{productName}} hasn't expired, no pressure either way." },
  { subject: "Friendly Follow-Up — Paid Collaboration | {{brandName}}", body: "Just a friendly follow-up in case our first note got buried — we'd love to have you join {{brandName}} on a paid collaboration for {{productName}}." },
  { subject: "In Case You Missed It: Paid Collaboration | {{brandName}}", body: "In case our first email missed your radar — {{brandName}} would still love to team up with you on {{productName}}, and it's a paid collab." },
  { subject: "Making Sure This Reaches You — Paid Collaboration | {{brandName}}", body: "Just making sure this actually reaches you and doesn't get swept away — the paid collaboration for {{productName}} with {{brandName}} is still available." },
  { subject: "Don't Miss This: Paid Collaboration | {{brandName}}", body: "Didn't want you to miss this — {{brandName}} is still holding a spot open for a paid collaboration on {{productName}}, whenever works for you." },
  { subject: "Bumping This Up — Paid Collaboration | {{brandName}}", body: "Bumping this back to the top of your inbox — {{brandName}}'s offer for a paid collaboration on {{productName}} is still very much open." },
  { subject: "Second Try: Paid Collaboration Opportunity | {{brandName}}", body: "Giving this a second try in case the first one got lost — we'd love to explore a paid collaboration with you on {{productName}} for {{brandName}}." },
  { subject: "Quick Follow-Up — Paid Collaboration | {{brandName}}", body: "Quick follow-up, no pressure at all — just didn't want this paid collaboration opportunity with {{brandName}} for {{productName}} to slip through unnoticed." },
  { subject: "Wanted to Reconnect — Paid Collaboration | {{brandName}}", body: "Wanted to reconnect in case this fell through the cracks — {{brandName}} would still love to bring you on for a paid collaboration on {{productName}}." },
  { subject: "This Might've Gotten Buried — Paid Collaboration | {{brandName}}", body: "This might've gotten buried in a busy week, so here's a gentle bump — the paid collaboration for {{productName}} with {{brandName}} is still open." },
  { subject: "Just Checking — Paid Collaboration Opportunity | {{brandName}}", body: "Just checking this landed okay — {{brandName}} is still excited about the idea of a paid collaboration with you on {{productName}}." },
  { subject: "Didn't Want to Lose Touch — Paid Collaboration | {{brandName}}", body: "Didn't want to lose touch — following up on the paid collaboration opportunity for {{productName}} with {{brandName}}, still very much open." },
  { subject: "A Gentle Reminder — Paid Collaboration | {{brandName}}", body: "A gentle reminder in case this slipped by — {{brandName}}'s paid collaboration offer for {{productName}} is still on the table for you." },
  { subject: "Following Up on Our Last Note — Paid Collaboration | {{brandName}}", body: "Following up on our last note, which may have gotten buried — {{brandName}} would love to collaborate with you (paid) on {{productName}}." },
  { subject: "Still Hoping to Hear From You — Paid Collaboration | {{brandName}}", body: "Still hoping to hear from you — didn't want our paid collaboration offer for {{productName}} with {{brandName}} to get lost in the noise." },
  { subject: "Resending This Your Way — Paid Collaboration | {{brandName}}", body: "Resending this your way in case the first one didn't land — {{brandName}} would love to work with you on a paid collaboration for {{productName}}." },
  { subject: "Keeping This On Your Radar — Paid Collaboration | {{brandName}}", body: "Just keeping this on your radar — the paid collaboration opportunity for {{productName}} with {{brandName}} hasn't gone anywhere." },
  { subject: "Circling Back — Paid Collaboration Opportunity | {{brandName}}", body: "Circling back on this one — {{brandName}} is still hoping to team up with you for a paid collaboration on {{productName}}." },
  { subject: "One More Try — Paid Collaboration | {{brandName}}", body: "One more try, in case emails get buried as fast as they arrive — {{brandName}}'s paid collaboration for {{productName}} is still up for grabs." },
  { subject: "Hoping This Finds You — Paid Collaboration | {{brandName}}", body: "Hoping this one actually finds you — following up on the paid collaboration opportunity with {{brandName}} for {{productName}}." },
  { subject: "This Deserves a Second Look — Paid Collaboration | {{brandName}}", body: "This might deserve a second look — {{brandName}} would still love to bring you on board for a paid collaboration on {{productName}}." },
  { subject: "Don't Let This Slip By — Paid Collaboration | {{brandName}}", body: "Didn't want this to slip by unnoticed — the paid collaboration for {{productName}} with {{brandName}} is still open and waiting for you." },
  { subject: "A Second Nudge — Paid Collaboration | {{brandName}}", body: "A second, gentle nudge — {{brandName}} would love to hear your thoughts on a paid collaboration for {{productName}} whenever you get a moment." },
  { subject: "Worth a Second Glance — Paid Collaboration | {{brandName}}", body: "Might be worth a second glance — {{brandName}}'s paid collaboration offer on {{productName}} is still open, no rush on your end." },
  { subject: "Still On Offer — Paid Collaboration | {{brandName}}", body: "Still on offer — didn't want the paid collaboration opportunity for {{productName}} with {{brandName}} to disappear into an overflowing inbox." },
  { subject: "Reaching Out Again — Paid Collaboration | {{brandName}}", body: "Reaching out again in case the first message got buried — {{brandName}} would love to explore a paid collaboration with you on {{productName}}." },
  { subject: "Haven't Heard Back — Paid Collaboration | {{brandName}}", body: "Haven't heard back yet, so just checking this didn't get lost — {{brandName}}'s paid collaboration for {{productName}} is still available." },
  { subject: "Just in Case This Was Missed — Paid Collaboration | {{brandName}}", body: "Just in case this was missed the first time around — {{brandName}} would still love to collaborate with you (paid) on {{productName}}." },
  { subject: "Trying Again — Paid Collaboration Opportunity | {{brandName}}", body: "Trying again, since inboxes move fast — {{brandName}}'s paid collaboration opportunity for {{productName}} is still open for you." },
  { subject: "Wanted to Follow Up — Paid Collaboration | {{brandName}}", body: "Wanted to follow up before this gets buried for good — {{brandName}} would love to have you on for a paid collaboration on {{productName}}." },
  { subject: "Sending This Back to the Top — Paid Collaboration | {{brandName}}", body: "Sending this back to the top of your inbox — the paid collaboration for {{productName}} with {{brandName}} is still very much on the table." },
  { subject: "This One's Still Open — Paid Collaboration | {{brandName}}", body: "This one's still open! Didn't want it to get lost — {{brandName}} would love to work with you on a paid collaboration for {{productName}}." },
  { subject: "A Quick Bump — Paid Collaboration | {{brandName}}", body: "A quick bump in case this got buried under other emails — {{brandName}}'s paid collaboration offer for {{productName}} still stands." },
  { subject: "Checking This Landed — Paid Collaboration | {{brandName}}", body: "Just checking this actually landed in your inbox — {{brandName}} would love to collaborate with you (paid) on {{productName}}." },
  { subject: "Still Waiting to Hear From You — Paid Collaboration | {{brandName}}", body: "Still waiting to hear from you, no worries if things have been busy — the paid collaboration for {{productName}} with {{brandName}} is still open." },
  { subject: "One More Ping — Paid Collaboration | {{brandName}}", body: "One more ping so this doesn't vanish into the inbox abyss — {{brandName}} would love to bring you on for a paid collaboration on {{productName}}." },
  { subject: "Hope This Didn't Get Lost — Paid Collaboration | {{brandName}}", body: "Hope this didn't get lost the first time — {{brandName}}'s paid collaboration opportunity for {{productName}} is still open and waiting." },
  { subject: "Following Up Once More — Paid Collaboration | {{brandName}}", body: "Following up once more — just didn't want the paid collaboration offer for {{productName}} with {{brandName}} to slip away unanswered." },
  { subject: "A Friendly Bump — Paid Collaboration | {{brandName}}", body: "A friendly bump to the top of your inbox — {{brandName}} is still hoping to work with you on a paid collaboration for {{productName}}." },
  { subject: "Wanted to Check Back In — Paid Collaboration | {{brandName}}", body: "Wanted to check back in, since these things can easily get buried — {{brandName}}'s paid collaboration for {{productName}} is still open for you." },
  { subject: "Still Open, Still Hoping — Paid Collaboration | {{brandName}}", body: "Still open, still hoping to hear from you — the paid collaboration opportunity with {{brandName}} for {{productName}} hasn't gone anywhere." },
];

export function pickRandomReminder1Variant(): Reminder1Variant {
  return REMINDER_1_VARIANT_POOL[Math.floor(Math.random() * REMINDER_1_VARIANT_POOL.length)];
}
