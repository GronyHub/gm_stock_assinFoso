// Sends over Resend's HTTPS API instead of raw SMTP -- DigitalOcean (and
// most cloud hosts) silently blocks outbound SMTP connections as an
// anti-spam measure, which made Gmail's SMTP transport hang for a long
// time and then fail on every reset request once this moved off Vercel.
// HTTPS on port 443 is never blocked the same way.
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? 'Grony Multimedia <onboarding@resend.dev>',
      to,
      subject: 'Reset your Grony password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="color:#1e293b">Password Reset</h2>
          <p>Hi ${name},</p>
          <p>Click the button below to reset your Grony app password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;
            background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
            Reset Password
          </a>
          <p style="color:#64748b;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
          <p style="color:#64748b;font-size:12px">Link: ${resetUrl}</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error (${res.status}): ${body}`)
  }
}
