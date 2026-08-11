// Pool of reminder-#3 (final/close-out) subject+body variants — same anti-duplicate-
// fingerprint motivation as REMINDER_1_VARIANT_POOL in reminder1Variants.ts. Tone: this is
// the last message in the sequence, respectful and no pressure, but leans into
// scarcity/FOMO ("last chance", "closing out this round") rather than the "don't want this
// to get buried" framing used in reminders #1/#2. Body text is the hero's intro paragraph
// (see introText in emailTemplate.ts) — must NOT open with "Hi {{creatorName}}," since the
// greeting is already rendered separately above it.
export interface Reminder3Variant {
  subject: string;
  body: string;
}

export const REMINDER_3_VARIANT_POOL: Reminder3Variant[] = [
  { subject: "Last Chance: Paid Collaboration Opportunity | {{brandName}}", body: "This will be our last note on this — we're closing out this round of paid collaborations soon and didn't want you to miss out on {{productName}} with {{brandName}}. The door's always open if the timing works better later." },
  { subject: "Final Call — Paid Collaboration | {{brandName}}", body: "Final call on this one — we're wrapping up this round for {{productName}} shortly. No pressure at all, and the offer stands anytime you're ready down the line." },
  { subject: "Closing This Out — Paid Collaboration | {{brandName}}", body: "Closing this out on our end for now — didn't want to let it go without one last check-in on {{productName}} with {{brandName}}. Feel free to reach out anytime if interested later." },
  { subject: "Last Note From Us — Paid Collaboration | {{brandName}}", body: "Last note from us on this one — {{brandName}} is finalizing this round of collaborations for {{productName}} soon. If interested down the line, the door's always open." },
  { subject: "Wrapping Up This Round — Paid Collaboration | {{brandName}}", body: "We're wrapping up this round of paid collaborations for {{productName}} — this is our final follow-up. No worries if now isn't the time, feel free to reach out whenever." },
  { subject: "One Last Check-In — Paid Collaboration | {{brandName}}", body: "One last check-in before we move on — {{brandName}} would still love to have you for {{productName}}, but we understand if timing isn't right. Door's open anytime." },
  { subject: "Final Follow-Up — Paid Collaboration | {{brandName}}", body: "This is our final follow-up on {{productName}} — we're closing out this round soon. No pressure to respond, just wanted to leave the door open for later." },
  { subject: "Last Chance Before We Close This — Paid Collaboration | {{brandName}}", body: "Last chance before we close this out — {{brandName}}'s spots for {{productName}} are filling up for this round. Totally fine if it's not the right time, just say the word later." },
  { subject: "Closing the Loop — Paid Collaboration | {{brandName}}", body: "Just closing the loop on this — this will be our last note about {{productName}}. If you're ever interested down the road, we'd love to hear from you." },
  { subject: "Final Note on This Opportunity — Paid Collaboration | {{brandName}}", body: "Final note on this one — we're moving forward with our creator lineup for {{productName}} soon. No pressure, and the offer's always open if timing changes." },
  { subject: "This Round Is Wrapping Up — Paid Collaboration | {{brandName}}", body: "This round of collaborations for {{productName}} is wrapping up — didn't want to close it out without one more note. Feel free to reach out anytime if interested later." },
  { subject: "Last Word From Us on This — Paid Collaboration | {{brandName}}", body: "Last word from us on this — {{brandName}} is finalizing plans for {{productName}} shortly. No demand for a response, just leaving the door open." },
  { subject: "Final Chance This Round — Paid Collaboration | {{brandName}}", body: "Final chance to join this round for {{productName}} — completely understand if the timing hasn't worked out. We'd love to reconnect down the line either way." },
  { subject: "We're Finalizing Our Lineup — Paid Collaboration | {{brandName}}", body: "We're finalizing our creator lineup for {{productName}} soon, so this will be our last note here. No pressure — always happy to hear from you later if interested." },
  { subject: "Last Note Before We Move On — Paid Collaboration | {{brandName}}", body: "Last note before we move forward without a reply — {{brandName}} would still love to work with you on {{productName}}, but totally understand if it's not the right time." },
  { subject: "Closing Out This Round — Paid Collaboration | {{brandName}}", body: "Closing out this round of paid collaborations for {{productName}} — this is our final message. Feel free to reach out anytime in the future if you're interested." },
  { subject: "One Final Note — Paid Collaboration | {{brandName}}", body: "One final note from {{brandName}} — we're wrapping up outreach for {{productName}}. No response needed, just wanted to leave this open for later." },
  { subject: "Last Chance to Join This Round — Paid Collaboration | {{brandName}}", body: "Last chance to join this round for {{productName}} before we move on to other creators. No pressure — always open to reconnecting down the line." },
  { subject: "Final Message on {{productName}} — Paid Collaboration | {{brandName}}", body: "This is our final message about {{productName}} for now — we're closing out this round. The door stays open anytime you'd like to revisit this." },
  { subject: "Wrapping This Up — Paid Collaboration | {{brandName}}", body: "Wrapping this up on our end — didn't want to let {{productName}} go without one last note. Feel free to come back to this whenever the timing's better." },
  { subject: "This Is Our Last Follow-Up — Paid Collaboration | {{brandName}}", body: "This is our last follow-up on {{productName}} — no pressure at all, just wanted to close the loop. We'd love to hear from you anytime down the line." },
  { subject: "Final Spot Check — Paid Collaboration | {{brandName}}", body: "A final check before we finalize this round for {{productName}} — completely fine if now isn't the time, the offer stands for later." },
  { subject: "Last Time We'll Bring This Up — Paid Collaboration | {{brandName}}", body: "Last time we'll bring this up for now — {{brandName}} is moving ahead with plans for {{productName}} soon. Always happy to reconnect if things change." },
  { subject: "Closing This Chapter — Paid Collaboration | {{brandName}}", body: "Closing this chapter on our end for {{productName}} — this is the last note in this sequence. Reach out anytime if you'd like to pick this back up." },
  { subject: "Final Reminder Before We Close Out — Paid Collaboration | {{brandName}}", body: "Final reminder before we close this out — {{brandName}}'s offer for {{productName}} remains open, just not through this sequence anymore. Feel free to reach out whenever." },
  { subject: "This Round's Coming to a Close — Paid Collaboration | {{brandName}}", body: "This round is coming to a close for {{productName}} — wanted to send one last note before we move forward. No pressure, and the door's always open later." },
  { subject: "Last Message in This Sequence — Paid Collaboration | {{brandName}}", body: "This is the last message in this sequence about {{productName}} — no need to respond if now isn't the time. We'd love to work together whenever it does." },
  { subject: "Final Opportunity This Round — Paid Collaboration | {{brandName}}", body: "Final opportunity to join this round for {{productName}} — totally understand if it's not the right fit right now. Feel free to circle back anytime." },
  { subject: "We're Moving Forward Soon — Paid Collaboration | {{brandName}}", body: "We're moving forward with our plans for {{productName}} soon, so this is our last check-in. No pressure — the door stays open if you're interested later." },
  { subject: "Last Note in This Round — Paid Collaboration | {{brandName}}", body: "Last note in this round for {{productName}} — didn't want to close this out without saying we'd still love to work with you anytime down the line." },
  { subject: "Final Heads-Up — Paid Collaboration | {{brandName}}", body: "A final heads-up before we wrap up this round — {{brandName}}'s spot for {{productName}} won't stay open forever, but reach out anytime if you're interested later." },
  { subject: "Closing Things Out Here — Paid Collaboration | {{brandName}}", body: "Closing things out here for now on {{productName}} — no pressure to respond, just wanted to leave this open for whenever timing works better." },
  { subject: "This Is Goodbye, For Now — Paid Collaboration | {{brandName}}", body: "This is goodbye for now on {{productName}} — we're moving forward with other creators, but would love to reconnect anytime you're interested." },
  { subject: "Final Note From the Team — Paid Collaboration | {{brandName}}", body: "A final note from the {{brandName}} team — we're closing out this round for {{productName}}. Feel free to reach back out anytime in the future." },
  { subject: "Last Opportunity to Respond — Paid Collaboration | {{brandName}}", body: "Last opportunity to respond before we move on — {{brandName}} would still love to have you for {{productName}}, but understand if the timing isn't right." },
  { subject: "Wrapping Up Our Outreach — Paid Collaboration | {{brandName}}", body: "Wrapping up our outreach for {{productName}} — this is the final message in this sequence. No pressure, and we're always happy to reconnect later." },
  { subject: "One Last Time — Paid Collaboration | {{brandName}}", body: "One last time before we close this out — {{brandName}} would love to work with you on {{productName}} whenever the timing's right, now or later." },
  { subject: "Final Word on This Offer — Paid Collaboration | {{brandName}}", body: "Final word on this offer for {{productName}} — we're moving ahead with our creator lineup soon. The door's always open if you'd like to revisit this." },
  { subject: "This Round Is Closing Soon — Paid Collaboration | {{brandName}}", body: "This round is closing soon for {{productName}} — wanted to reach out one more time. No pressure at all, feel free to reach out anytime down the line." },
  { subject: "Last Message From {{brandName}} — Paid Collaboration | {{brandName}}", body: "Last message from {{brandName}} on this one — closing out this round for {{productName}}. Always happy to hear from you anytime in the future." },
  { subject: "Final Round Update — Paid Collaboration | {{brandName}}", body: "Final update on this round for {{productName}} — we're moving forward with our lineup shortly. Feel free to reach out anytime if interested later on." },
  { subject: "This Is Our Last Attempt — Paid Collaboration | {{brandName}}", body: "This is our last attempt to connect on {{productName}} — no worries if it's not the right time, we'd love to hear from you whenever it is." },
  { subject: "Closing Out for Now — Paid Collaboration | {{brandName}}", body: "Closing out for now on {{productName}} — this sequence ends here, but {{brandName}} is always open to reconnecting whenever works for you." },
  { subject: "Final Note Before Moving On — Paid Collaboration | {{brandName}}", body: "Final note before we move on to other creators for {{productName}} — completely understand if timing's off. Reach out anytime if that changes." },
  { subject: "Last Chance for This Round — Paid Collaboration | {{brandName}}", body: "Last chance for this round of {{productName}} — no pressure to respond now, the door stays open for whenever you're ready." },
  { subject: "We're Closing This Out Respectfully — Paid Collaboration | {{brandName}}", body: "We're closing this out respectfully — this is our final note on {{productName}}. Always happy to pick this back up anytime in the future." },
  { subject: "Final Nudge Before We Move Forward — Paid Collaboration | {{brandName}}", body: "A final nudge before we move forward without a reply — {{brandName}} would love to work with you on {{productName}} whenever the timing's better." },
  { subject: "This Sequence Ends Here — Paid Collaboration | {{brandName}}", body: "This sequence ends here for now on {{productName}} — no need to respond if it's not the right time. We'd love to hear from you anytime after." },
  { subject: "Last Look Before We Close This — Paid Collaboration | {{brandName}}", body: "One last look before we close this out — {{brandName}}'s offer for {{productName}} remains open beyond this sequence, just reach out whenever." },
  { subject: "Signing Off for Now — Paid Collaboration | {{brandName}}", body: "Signing off for now on {{productName}} — this is the last note in this sequence, but {{brandName}} would love to hear from you anytime after." },
];

export function pickRandomReminder3Variant(): Reminder3Variant {
  return REMINDER_3_VARIANT_POOL[Math.floor(Math.random() * REMINDER_3_VARIANT_POOL.length)];
}
