import nodemailer from 'nodemailer';
import { getEmailConfig, DEFAULT_SENDER_NAME } from './emailConfig';
import { DEFAULT_SENDER_TITLE } from './emailTemplate';

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

  // SMTP account profile name (set at the mail provider, e.g. Naver Works admin console)
  // controls the From display name whenever nodemailer isn't given one explicitly — that's
  // why outreach emails were showing the raw account name instead of a professional title.
  const senderName = (config.senderName || DEFAULT_SENDER_NAME).replace(/[\r\n"]/g, '').trim();
  const brand = config.brand?.replace(/[\r\n"]/g, '').trim();
  const fromName = brand ? `${senderName} – ${brand} ${DEFAULT_SENDER_TITLE}` : senderName;

  const mailOptions: nodemailer.SendMailOptions = {
    from: { name: fromName, address: config.email },
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
