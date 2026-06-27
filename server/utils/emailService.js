const nodemailer = require("nodemailer");

function getSmtpConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || 587);

  if (!user || !pass) {
    return null;
  }

  return {
    user,
    pass,
    host,
    port,
    from: process.env.SMTP_FROM || user,
  };
}

async function sendResetCodeEmail(to, code) {
  const smtp = getSmtpConfig();

  if (!smtp) {
    console.log(`[LetzChat] SMTP not configured. Password reset code for ${to}: ${code}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: "LetzChat password reset code",
      text: `Your LetzChat password reset code is: ${code}\n\nIt expires in 15 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>LetzChat password reset</h2>
          <p>Use this code to reset your password:</p>
          <p style="font-size:28px;font-weight:bold;margin:16px 0">${code}</p>
          <p>This code expires in 15 minutes.</p>
        </div>
      `,
    });
    console.log(`[LetzChat] Password reset email sent to ${to}`);
    return { sent: true };
  } catch (error) {
    console.error("[LetzChat] Failed to send reset email:", error.message);
    throw error;
  }
}

module.exports = { sendResetCodeEmail, getSmtpConfig };
