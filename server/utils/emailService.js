const https = require("https");
const nodemailer = require("nodemailer");

// ── Resend (HTTPS API — works on Render and any platform) ────────────────────

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    from: process.env.RESEND_FROM || "LetzChat <onboarding@resend.dev>",
  };
}

function sendViaResend(cfg, to, subject, html, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: cfg.from,
      to: [to],
      subject,
      html,
      text,
    });

    const req = https.request(
      {
        hostname: "api.resend.com",
        port: 443,
        path: "/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ sent: true });
          } else {
            reject(new Error(`Resend API ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Nodemailer SMTP (local development fallback) ─────────────────────────────

function getSmtpConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || 587);
  if (!user || !pass) return null;
  return { user, pass, host, port, from: process.env.SMTP_FROM || user };
}

async function sendViaSmtp(smtp, to, subject, html, text) {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.verify();
  await transporter.sendMail({ from: smtp.from, to, subject, text, html });
  return { sent: true };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function sendResetCodeEmail(to, code) {
  const subject = "LetzChat password reset code";
  const text = `Your LetzChat password reset code is: ${code}\n\nIt expires in 15 minutes.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2>LetzChat password reset</h2>
      <p>Use this code to reset your password:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
      <p>This code expires in <strong>15 minutes</strong>.</p>
      <p style="color:#6b7280;font-size:0.85rem">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  const isProduction = process.env.NODE_ENV === "production";

  // 1. Try Resend (works on Render / any cloud host — HTTPS, never blocked)
  const resend = getResendConfig();
  if (resend) {
    console.log(`[LetzChat] Sending reset email via Resend to ${to}`);
    const result = await sendViaResend(resend, to, subject, html, text);
    console.log(`[LetzChat] Resend: email sent to ${to}`);
    return result;
  }

  // 2. Try SMTP only in local development (Render blocks port 587/465 on free tier)
  if (!isProduction) {
    const smtp = getSmtpConfig();
    if (smtp) {
      console.log(`[LetzChat] Sending reset email via SMTP to ${to}`);
      const result = await sendViaSmtp(smtp, to, subject, html, text);
      console.log(`[LetzChat] SMTP: email sent to ${to}`);
      return result;
    }
  }

  // 3. Nothing configured
  if (isProduction) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your Render environment variables."
    );
  }
  console.log(`[LetzChat] No email provider configured. Reset code for ${to}: ${code}`);
  return { sent: false, reason: "not_configured" };
}

module.exports = { sendResetCodeEmail, getSmtpConfig, getResendConfig };
