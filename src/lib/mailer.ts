import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfig';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
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

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.email,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  };

  if (opts.inReplyTo) {
    mailOptions.inReplyTo = opts.inReplyTo;
    mailOptions.references = [opts.inReplyTo];
  }

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId };
}
