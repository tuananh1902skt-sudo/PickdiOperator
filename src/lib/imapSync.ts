import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getEmailConfig, saveLastImapUid } from './emailConfig';
import { stripQuotedReply, htmlToPlainText } from './emailQuote';
import {
  getAllCreators,
  getAllOutreach,
  getAllConversations,
  saveConversation,
  getCreatorById,
  saveCreator,
  saveUnmatchedInboundEmail,
} from '../db';
import { Message, Conversation, CheckInboxResult, UnmatchedInboundEmail, CreatorStatus } from '../types';

// Các status trước "đàm phán" — creator reply mail lần đầu ở giai đoạn nào trong nhóm này
// cũng được tự động đẩy sang 'Negotiating'. Không đụng tới creator đã qua Negotiating (Approved,
// Sample Sent, Posted...) hay đã Rejected/Archived, để tránh việc reply muộn kéo lùi pipeline.
const PRE_NEGOTIATION_STATUSES: CreatorStatus[] = [
  'New Lead',
  'Researching',
  'Qualified',
  'Contact lần 1',
  'Contact lần 2',
  'Contact lần 3',
  'Interested',
];

// Đoán reply có đang đàm phán giá không (rate card, báo giá, thương lượng) để tự chuyển
// Conversation.status sang 'Negotiating' — phục vụ cột "Reply Status" trong Export Google Sheet.
// Cố tình lỏng tay (OR giữa 2 nhóm) vì đây chỉ là gợi ý để operator xem lại, không phải kết luận cuối.
function looksLikeRateNegotiation(text: string): boolean {
  if (!text) return false;
  const priceLike = /(\$|usd|₫)\s?\d|\d[\d.,]*\s?(usd|k\b|nghìn|triệu|vnd|đô)/i.test(text);
  const negotiationKeyword = /(rate card|price per|per video|per post|per story|quote|negotiat|budget|báo giá|thương lượng|mức giá|mức phí|phí hợp tác|đàm phán)/i.test(text);
  return priceLike || negotiationKeyword;
}

export async function checkInboxForReplies(): Promise<CheckInboxResult> {
  const config = await getEmailConfig();

  if (!config.email || !config.password || !config.imapHost || !config.imapPort) {
    throw new Error('Email chưa được cấu hình đủ — vào Settings > Email để thiết lập');
  }

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  });

  let imported = 0;
  let skipped = 0;
  let needsManualReview = 0;
  const skippedReasons = {
    forwarded: 0,
    duplicate: 0,
    no_match: 0,
    ambiguous_multi_match: 0,
  };

  let lock: any = null;

  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`IMAP ${label} timed out after ${ms}ms`)), ms)),
    ]);

  try {
    await withTimeout(client.connect(), 15000, 'connect');
    lock = await client.getMailboxLock('INBOX');

    const lastImapUid = config.lastImapUid;
    let maxSeenUid = lastImapUid || 0;

    // Mailbox metadata
    const mailboxStatus = client.mailbox;
    const currentHighestUid = (mailboxStatus && typeof mailboxStatus.uidNext === 'number')
      ? Math.max(1, mailboxStatus.uidNext - 1)
      : 1;

    // First time running: don't sync historical emails, set cursor to current highest UID
    if (lastImapUid === undefined || lastImapUid === null) {
      await saveLastImapUid(currentHighestUid);
      return {
        imported: 0,
        skipped: 0,
        skippedReasons,
        needsManualReview: 0,
      };
    }

    const startUid = lastImapUid + 1;
    if (startUid > currentHighestUid) {
      return {
        imported: 0,
        skipped: 0,
        skippedReasons,
        needsManualReview: 0,
      };
    }

    const searchRange = `${startUid}:*`;

    for await (const msg of client.fetch(searchRange, { source: true, uid: true }, { uid: true })) {
      if (msg.uid > maxSeenUid) {
        maxSeenUid = msg.uid;
        // Persist incrementally so a mid-batch failure (e.g. malformed MIME) doesn't
        // force a full re-scan of already-processed UIDs on the next run.
        await saveLastImapUid(maxSeenUid);
      }

      const parsed = await simpleParser(msg.source);
      const senderEmail = parsed.from?.value?.[0]?.address?.toLowerCase().trim();

      // Step 1 — Early exclusions (before trying to match)
      // Ignore emails sent by our own Gmail account
      if (senderEmail && senderEmail === config.email.toLowerCase().trim()) {
        continue;
      }

      // Ignore forwarded emails (Fwd: / Fw: subject)
      const cleanSubject = (parsed.subject || '').trim();
      if (/^(fwd|fw)\s*:/i.test(cleanSubject)) {
        skippedReasons.forwarded++;
        skipped++;
        continue;
      }

      // Deduplicate by messageId
      const currentConvs = await getAllConversations();
      if (parsed.messageId && parsed.messageId.trim()) {
        const isDuplicate = currentConvs.some((conv) =>
          (conv.messages || []).some(
            (m: Message) => m.messageId && m.messageId.trim() === parsed.messageId!.trim()
          )
        );
        if (isDuplicate) {
          skippedReasons.duplicate++;
          skipped++;
          continue;
        }
      }

      // Step 2 — Match by Message-ID / In-Reply-To / References (Highest priority)
      const targetMessageIds: string[] = [];
      if (typeof parsed.inReplyTo === 'string' && parsed.inReplyTo.trim()) {
        targetMessageIds.push(parsed.inReplyTo.trim());
      }
      if (typeof parsed.references === 'string' && parsed.references.trim()) {
        targetMessageIds.push(parsed.references.trim());
      } else if (Array.isArray(parsed.references)) {
        parsed.references.forEach((r) => {
          if (typeof r === 'string' && r.trim()) {
            targetMessageIds.push(r.trim());
          }
        });
      }

      let matchedCreatorId: string | null = null;

      if (targetMessageIds.length > 0) {
        const outreachEmails = await getAllOutreach();
        // Check outreach_emails first
        for (const targetId of targetMessageIds) {
          const matchedOutreach = outreachEmails.find(
            (o) => o.messageId && o.messageId.trim() === targetId
          );
          if (matchedOutreach) {
            matchedCreatorId = matchedOutreach.creatorId;
            break;
          }
        }

        // Check messages inside conversations if still not matched
        if (!matchedCreatorId) {
          for (const targetId of targetMessageIds) {
            for (const conv of currentConvs) {
              const hasMatchingMsg = (conv.messages || []).some(
                (m: Message) => m.messageId && m.messageId.trim() === targetId
              );
              if (hasMatchingMsg) {
                matchedCreatorId = conv.creatorId;
                break;
              }
            }
            if (matchedCreatorId) break;
          }
        }
      }

      // Step 3 — Fallback by email sender (Only runs if Step 2 found no match)
      if (!matchedCreatorId && senderEmail) {
        const creators = await getAllCreators();
        const matchingCreators = creators.filter(
          (c) => c.email && c.email.toLowerCase().trim() === senderEmail
        );

        if (matchingCreators.length === 1) {
          matchedCreatorId = matchingCreators[0].id;
        } else if (matchingCreators.length > 1) {
          // Multiple creators share same email (agency case) -> do not auto-match.
          // Save to unmatched_inbound_emails for manual assignment.
          const rawBody = parsed.text || (typeof parsed.html === 'string' ? htmlToPlainText(parsed.html) : '');
          const cleanedContent = stripQuotedReply(rawBody) || '(No text content)';

          const unmatchedItem: UnmatchedInboundEmail = {
            id: `unm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            senderEmail,
            senderName: parsed.from?.value?.[0]?.name || senderEmail,
            subject: cleanSubject || '(No subject)',
            content: cleanedContent,
            receivedAt: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
            candidateCreatorIds: matchingCreators.map((c) => c.id),
            resolved: false,
            messageId: parsed.messageId,
          };

          await saveUnmatchedInboundEmail(unmatchedItem);
          skippedReasons.ambiguous_multi_match++;
          skipped++;
          needsManualReview++;
          continue;
        } else {
          // 0 creators matched
          skippedReasons.no_match++;
          skipped++;
          continue;
        }
      } else if (!matchedCreatorId) {
        skippedReasons.no_match++;
        skipped++;
        continue;
      }

      // Step 4 — Insert message into matched Conversation
      const matchedCreator = await getCreatorById(matchedCreatorId);
      if (!matchedCreator) {
        skippedReasons.no_match++;
        skipped++;
        continue;
      }

      const rawBody = parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, '') : '');
      const cleanedContent = stripQuotedReply(rawBody) || '(No text content)';

      let conversation = currentConvs.find((c) => c.creatorId === matchedCreator.id);
      if (!conversation) {
        conversation = {
          id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          creatorId: matchedCreator.id,
          creatorName: matchedCreator.displayName,
          creatorHandle: matchedCreator.handle,
          creatorAvatar: matchedCreator.avatar || '',
          status: 'Need Reply',
          lastMessageAt: new Date().toISOString(),
          messages: [],
          unread: true,
        };
      }
      const newStatus = looksLikeRateNegotiation(cleanedContent) ? 'Negotiating' : 'Need Reply';

      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        senderType: 'CREATOR',
        senderName: parsed.from?.value?.[0]?.name || senderEmail || matchedCreator.displayName,
        content: cleanedContent,
        createdAt: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
        messageId: parsed.messageId,
        inReplyTo: typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : undefined,
        subject: parsed.subject,
      };

      conversation.messages.push(newMessage);
      conversation.unread = true;
      conversation.status = newStatus;
      conversation.lastMessageAt = newMessage.createdAt;

      await saveConversation(conversation);

      // Creator rep mail lần đầu -> tự chuyển sang Negotiating (chỉ khi còn ở giai đoạn
      // trước đàm phán; không kéo lùi creator đã Approved/Rejected/Archived...).
      if (PRE_NEGOTIATION_STATUSES.includes(matchedCreator.status)) {
        matchedCreator.status = 'Negotiating';
        matchedCreator.updatedAt = new Date().toISOString();
        await saveCreator(matchedCreator);
      }

      imported++;
    }

    if (maxSeenUid > (lastImapUid || 0)) {
      await saveLastImapUid(maxSeenUid);
    }

    return {
      imported,
      skipped,
      skippedReasons,
      needsManualReview,
    };
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch {}
    }
    try {
      await withTimeout(client.logout(), 5000, 'logout');
    } catch {
      client.close();
    }
  }
}
