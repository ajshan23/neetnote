import nodemailer from 'nodemailer';
import config from '../configs/env';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS
  }
});

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async ({ to, subject, text, html }: SendEmailOptions) => {
  if (config.NODE_ENV === 'test') return;
  
  await transporter.sendMail({
    from: `"NEET Prep App" <${config.FROM_EMAIL}>`,
    to,
    subject,
    text,
    html
  });
};