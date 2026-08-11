// Pool of reminder-#2 subject+body variants — same anti-duplicate-fingerprint motivation as
// REMINDER_1_VARIANT_POOL in reminder1Variants.ts. Reminder #2 tone: still warm, but each
// variant adds a concrete incentive/flexibility (sample first, negotiable rate, no pressure)
// since a first light nudge alone didn't get a reply. Body text is the hero's intro
// paragraph (see introText in emailTemplate.ts) — must NOT open with "Hi {{creatorName}},"
// since the greeting is already rendered separately above it.
export interface Reminder2Variant {
  subject: string;
  body: string;
}

export const REMINDER_2_VARIANT_POOL: Reminder2Variant[] = [
  { subject: "Don't Miss This — Paid Collaboration | {{brandName}}", body: "Following up once more so this doesn't slip through the cracks — happy to be flexible on the commission rate or send {{productName}} for you to try first, whatever makes it easier to say yes." },
  { subject: "Happy to Be Flexible — Paid Collaboration | {{brandName}}", body: "Checking back in — {{brandName}} is happy to negotiate on the rate or send {{productName}} over first so you can see it before committing to anything." },
  { subject: "No Pressure, Just Checking — Paid Collaboration | {{brandName}}", body: "No pressure at all, just checking if timing works better now — we're open to adjusting the commission on {{productName}} if that helps." },
  { subject: "We Can Work Around Your Rate — Paid Collaboration | {{brandName}}", body: "Wanted to follow up — {{brandName}} is genuinely flexible on the rate for {{productName}}, so if the offer wasn't quite right before, let's talk numbers." },
  { subject: "Second Follow-Up — Paid Collaboration | {{brandName}}", body: "Second follow-up here — happy to send {{productName}} your way first so you can try it before we finalize anything on the collaboration." },
  { subject: "Let's Make This Easier — Paid Collaboration | {{brandName}}", body: "Want to make this easier — {{brandName}} can be flexible on the flat fee for {{productName}}, or start with a sample if that's more your speed." },
  { subject: "Still Flexible on Terms — Paid Collaboration | {{brandName}}", body: "Following up again — the rate on {{productName}} isn't fixed, and we're happy to adjust based on what works for you." },
  { subject: "Open to Discussing the Rate — Paid Collaboration | {{brandName}}", body: "Just checking back — if the original offer for {{productName}} wasn't quite it, we're fully open to discussing a different rate." },
  { subject: "One More Try, With More Flexibility — Paid Collaboration | {{brandName}}", body: "One more try — this time with more flexibility. {{brandName}} can send {{productName}} first or adjust the commission, whichever helps." },
  { subject: "Timing Not Right Before? — Paid Collaboration | {{brandName}}", body: "If timing wasn't right before, no worries — following up to see if now works better for a paid collaboration on {{productName}}." },
  { subject: "Happy to Send a Sample First — Paid Collaboration | {{brandName}}", body: "Circling back — happy to send {{productName}} over first so you can try it before deciding on the collaboration." },
  { subject: "Following Up With a Better Offer — Paid Collaboration | {{brandName}}", body: "Following up with more room to negotiate — {{brandName}} can be flexible on the rate for {{productName}} if that's what's been holding things up." },
  { subject: "Checking Back — Paid Collaboration | {{brandName}}", body: "Checking back in, no pressure — if you'd like to try {{productName}} first before agreeing to anything, that's totally fine with us." },
  { subject: "We Can Adjust the Offer — Paid Collaboration | {{brandName}}", body: "Wanted to reach out again — the offer on {{productName}} can be adjusted, so let us know what would work better for you." },
  { subject: "Second Nudge, More Flexibility — Paid Collaboration | {{brandName}}", body: "A second nudge, this time with more flexibility — {{brandName}} is open to negotiating the commission on {{productName}}." },
  { subject: "Still Interested? We Can Work With You — Paid Collaboration | {{brandName}}", body: "Still interested in {{productName}}? {{brandName}} is happy to work around your rate or send a sample first — whatever's easier." },
  { subject: "Let's Find Something That Works — Paid Collaboration | {{brandName}}", body: "Let's find something that works for both sides — happy to adjust the compensation on {{productName}} or start with a free sample." },
  { subject: "Rate Not Quite Right? Let's Talk — Paid Collaboration | {{brandName}}", body: "If the rate wasn't quite right the first time, let's talk — {{brandName}} has room to negotiate on {{productName}}." },
  { subject: "Trying Again, More Room to Negotiate — Paid Collaboration | {{brandName}}", body: "Trying again — this time with more room to negotiate on {{productName}}. Happy to hear what would make this work for you." },
  { subject: "We'd Love to Make This Work — Paid Collaboration | {{brandName}}", body: "We'd genuinely love to make this work — {{brandName}} can flex on the rate for {{productName}}, or send it over for you to try first." },
  { subject: "Checking If Now's a Better Time — Paid Collaboration | {{brandName}}", body: "Checking if now's a better time — no pressure, just want to see if a paid collaboration on {{productName}} still interests you." },
  { subject: "Following Up With More Options — Paid Collaboration | {{brandName}}", body: "Following up with a couple more options — sample first, or a different rate on {{productName}}, whichever helps you decide." },
  { subject: "We Can Be Flexible — Paid Collaboration | {{brandName}}", body: "Just a reminder that {{brandName}} can be flexible here — whether it's the rate or trying {{productName}} first, we're open to it." },
  { subject: "Wanted to Check In Again — Paid Collaboration | {{brandName}}", body: "Wanted to check in again — happy to negotiate the commission on {{productName}} if that's what's been the holdup." },
  { subject: "Still Open to a Different Arrangement — Paid Collaboration | {{brandName}}", body: "Still open to a different arrangement on {{productName}} — sample first, different rate, whatever makes this easier for you." },
  { subject: "No Rush, Just Following Up — Paid Collaboration | {{brandName}}", body: "No rush at all, just following up — {{brandName}} is happy to be flexible on the rate for {{productName}} whenever you're ready." },
  { subject: "Second Follow-Up, With Flexibility — Paid Collaboration | {{brandName}}", body: "This is our second follow-up — wanted to add that we're flexible on the commission for {{productName}} if that helps move things along." },
  { subject: "Happy to Adjust If Needed — Paid Collaboration | {{brandName}}", body: "Happy to adjust the offer if needed — following up on {{productName}} in case the original terms weren't quite right." },
  { subject: "Let Us Know What Works — Paid Collaboration | {{brandName}}", body: "Let us know what would work better for you — {{brandName}} can be flexible on the rate or sample terms for {{productName}}." },
  { subject: "Still Room to Talk Numbers — Paid Collaboration | {{brandName}}", body: "Still room to talk numbers on {{productName}} — following up in case the first offer wasn't quite the right fit." },
  { subject: "We're Happy to Meet You Halfway — Paid Collaboration | {{brandName}}", body: "We're happy to meet you halfway — {{brandName}} can adjust the rate or send {{productName}} first if that helps." },
  { subject: "Checking In With More Flexibility — Paid Collaboration | {{brandName}}", body: "Checking in with a bit more flexibility this time — open to negotiating on {{productName}}, whatever makes sense for you." },
  { subject: "Following Up, Terms Are Negotiable — Paid Collaboration | {{brandName}}", body: "Following up to say the terms on {{productName}} are negotiable — happy to hear what would work better for you." },
  { subject: "One More Follow-Up, More Options — Paid Collaboration | {{brandName}}", body: "One more follow-up with a couple more options on the table for {{productName}} — sample first, or a different rate." },
  { subject: "We Can Sweeten the Deal — Paid Collaboration | {{brandName}}", body: "We can sweeten the deal a bit — {{brandName}} is open to adjusting the commission on {{productName}} if that helps." },
  { subject: "Still Hoping to Work Something Out — Paid Collaboration | {{brandName}}", body: "Still hoping to work something out on {{productName}} — happy to be flexible on rate or terms, just let us know." },
  { subject: "Wanted to Add More Flexibility — Paid Collaboration | {{brandName}}", body: "Wanted to add a bit more flexibility to the offer — {{brandName}} can adjust the rate for {{productName}} or send a sample first." },
  { subject: "Following Up With Better Terms — Paid Collaboration | {{brandName}}", body: "Following up with better terms in mind — open to negotiating the rate on {{productName}} if the first offer didn't quite fit." },
  { subject: "No Pressure — Just an Open Offer — Paid Collaboration | {{brandName}}", body: "No pressure here, just keeping the door open — {{brandName}} is flexible on {{productName}}'s terms whenever you're ready to chat." },
  { subject: "Circling Back With More to Offer — Paid Collaboration | {{brandName}}", body: "Circling back with a bit more to offer — happy to negotiate on {{productName}} or send a sample your way first." },
  { subject: "Still Available, Terms Can Flex — Paid Collaboration | {{brandName}}", body: "Still available and the terms can flex — following up on {{productName}} in case rate was the sticking point." },
  { subject: "Let's Revisit the Offer — Paid Collaboration | {{brandName}}", body: "Let's revisit the offer on {{productName}} — {{brandName}} is open to adjusting things to make this work for you." },
  { subject: "We Want to Get This Right — Paid Collaboration | {{brandName}}", body: "We want to get this right for you — happy to negotiate the rate on {{productName}} or start with a free sample." },
  { subject: "Following Up With a Flexible Offer — Paid Collaboration | {{brandName}}", body: "Following up with a more flexible offer — {{brandName}} can adjust the commission on {{productName}} if that helps you decide." },
  { subject: "Checking If Terms Are the Holdup — Paid Collaboration | {{brandName}}", body: "Just checking if terms were the holdup — we're happy to adjust the rate or send {{productName}} first, whichever's easier." },
  { subject: "Still Keen to Work Together — Paid Collaboration | {{brandName}}", body: "Still keen to work together on {{productName}} — happy to be flexible on the rate if that helps move things forward." },
  { subject: "One More Note, More Flexibility — Paid Collaboration | {{brandName}}", body: "One more note — {{brandName}} has more flexibility now on {{productName}}'s terms, so let us know what would work." },
  { subject: "Open to Whatever Works Best — Paid Collaboration | {{brandName}}", body: "Open to whatever works best for you — sample first, different rate, {{brandName}} is flexible on {{productName}}." },
  { subject: "Following Up, No Strings Attached — Paid Collaboration | {{brandName}}", body: "Following up, no strings attached — happy to adjust the offer on {{productName}} if the timing or terms weren't right before." },
  { subject: "Let's Try a Different Approach — Paid Collaboration | {{brandName}}", body: "Let's try a different approach — {{brandName}} can offer more flexibility on {{productName}}'s rate, or send it over first so you can see it in person." },
];

export function pickRandomReminder2Variant(): Reminder2Variant {
  return REMINDER_2_VARIANT_POOL[Math.floor(Math.random() * REMINDER_2_VARIANT_POOL.length)];
}
