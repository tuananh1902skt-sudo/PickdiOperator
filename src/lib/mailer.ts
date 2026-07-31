import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfig';

export async function sendEmail(opts: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
}): Promise<{ messageId: string }> {
  const config = await getEmailConfig();

  if (!config.email || !config.password || !config.smtpHost || !config.smtpPort) {
    throw new Error('Email chưa được cấu hình đủ — vào Settings > Email để thiết lập');
  }

  const secure = config.smtpSecure !== undefined ? config.smtpSecure : config.smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
  });

  // Deliberately no display name here: dalbausa.com has no SPF/DKIM alignment for this
  // SMTP relay, so a custom From name gets flagged as unverified and Gmail shows the raw
  // address instead — worse than the bare-address fallback, where Gmail just shows the
  // local part ("juan"). Revisit once SPF/DKIM is fixed (see mailer.ts git history).
  const mailOptions: nodemailer.SendMailOptions = {
    from: config.email,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  };

  if (opts.cc && opts.cc.trim()) {
    mailOptions.cc = opts.cc.trim();
  }

  // Plain-text part always stays (spam-filter/deliverability fallback + clients that
  // block HTML); html is additive, never a replacement for it.
  if (opts.html) {
    mailOptions.html = opts.html;
  }

  if (opts.inReplyTo) {
    mailOptions.inReplyTo = opts.inReplyTo;
    mailOptions.references = [opts.inReplyTo];
  }

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId };
}
