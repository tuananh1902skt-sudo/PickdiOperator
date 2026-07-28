import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfig';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
}): Promise<{ messageId: string }> {
  const config = await getEmailConfig();

  if (!config.gmailUser || !config.appPassword) {
    throw new Error('Gmail chưa được cấu hình — vào Settings > Email để thiết lập');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmailUser,
      pass: config.appPassword,
    },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.gmailUser,
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
