// Sends over Resend's HTTPS API instead of raw SMTP -- DigitalOcean (and
// most cloud hosts) silently blocks outbound SMTP connections as an
// anti-spam measure, which made Gmail's SMTP transport hang for a long
// time and then fail on every reset request once this moved off Vercel.
// HTTPS on port 443 is never blocked the same way.
async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? 'Grony Multimedia <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error (${res.status}): ${body}`)
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await sendEmail(to, 'Reset your Grony password', `
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
  `)
}

export async function sendRegistrationEmail(to: string, name: string, customerId: string) {
  await sendEmail(to, 'Welcome to Grony Multimedia!', `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#1e293b">Welcome!</h2>
      <p>Hi ${name},</p>
      <p>Thank you for registering with <strong>Grony Multimedia</strong>. Your customer account is now active!</p>
      <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:16px;margin:16px 0;border-radius:4px">
        <p style="margin:0;color:#1e293b;font-weight:600">Your Customer ID:</p>
        <p style="margin:8px 0;font-size:28px;font-weight:bold;color:#2563eb;font-family:monospace">${customerId}</p>
      </div>
      <p>Use this ID for all your orders and dealings with us. You can also contact us on WhatsApp at <strong>053 432 8977</strong>.</p>
      <p style="color:#64748b;font-size:13px">Keep this email safe for your records.</p>
    </div>
  `)
}

export async function sendTransactionEmail(to: string, name: string, customerId: string, items: Array<{ name: string; qty: number; price: number }>) {
  const itemsHtml = items.map(item => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px;text-align:left">${item.name}</td>
      <td style="padding:8px;text-align:right">${item.qty} × ₵${item.price.toFixed(2)}</td>
      <td style="padding:8px;text-align:right;font-weight:600">₵${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('')

  const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0)

  await sendEmail(to, 'Grony Multimedia - Transaction Confirmation', `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#1e293b">Transaction Confirmed</h2>
      <p>Hi ${name},</p>
      <p>Thank you for your purchase at <strong>Grony Multimedia</strong>. Here's your transaction summary:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead style="background:#f8fafc">
          <tr>
            <th style="padding:8px;text-align:left;color:#1e293b;font-weight:600">Item</th>
            <th style="padding:8px;text-align:right;color:#1e293b;font-weight:600">Qty × Price</th>
            <th style="padding:8px;text-align:right;color:#1e293b;font-weight:600">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div style="background:#f8fafc;padding:12px;border-radius:4px;text-align:right">
        <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600">Total: ₵${total.toFixed(2)}</p>
      </div>
      <p style="color:#64748b;font-size:13px;margin-top:16px">Customer ID: <strong>${customerId}</strong></p>
      <p style="color:#64748b;font-size:13px">Questions? Contact us on WhatsApp at <strong>053 432 8977</strong></p>
    </div>
  `)
}
