const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

function buildResetUrl(token) {
  return `${env.frontendUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = buildResetUrl(token);
  if (!transporter) {
    console.log("\n[email][dev] Password reset requested for", email);
    console.log(`[email][dev] Reset link: ${resetUrl}`);
    return { delivered: false, method: "console" };
  }
  await transporter.sendMail({
    from: env.smtp.from,
    to: email,
    subject: "Reset your Nouri password",
    html: `
      <p>Hi,</p>
      <p>We received a request to reset your Nouri password. Use the link below to choose a new one. It expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
  return { delivered: true, method: "smtp" };
}

module.exports = { sendPasswordResetEmail, buildResetUrl };