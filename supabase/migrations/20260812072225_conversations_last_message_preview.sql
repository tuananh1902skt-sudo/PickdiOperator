-- Cuts Supabase egress on conversation LIST reads (Inbox list rows, Dashboard "recent replies")
-- which today require selecting the full `messages` jsonb column (entire email thread, every
-- message body) just to render a 1-line preview of the last message. These two columns hold a
-- denormalized copy of the last message, kept in sync by the app on every saveConversation() call
-- (see src/db.ts), so list reads can select everything except `messages` and skip that egress.
alter table "public"."conversations"
  add column "lastMessagePreview" text,
  add column "lastMessageSenderType" text;

-- Backfill existing rows from their current `messages` array (last element).
update "public"."conversations"
set
  "lastMessagePreview" = messages -> -1 ->> 'content',
  "lastMessageSenderType" = messages -> -1 ->> 'senderType'
where jsonb_array_length(coalesce(messages, '[]'::jsonb)) > 0;
