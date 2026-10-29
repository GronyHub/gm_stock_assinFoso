// Sends over Resend's HTTPS API instead of raw SMTP -- DigitalOcean (and
// most cloud hosts) silently blocks outbound SMTP connections as an
// anti-spam measure, which made Gmail's SMTP transport hang for a long
// time and then fail on every reset request once this moved off Vercel.
// HTTPS on port 443 is never blocked the same way.
function esc(v: string) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Always sent from the shop's official address. Deliberately not read from
// RESEND_FROM: the droplet's env still held noreply@, and replies to that
// address went nowhere. info@ forwards to the shop Gmail (Namecheap).
const FROM = 'Grony Multimedia <info@gronymultimedia.com>'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      reply_to: 'info@gronymultimedia.com',
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

// To the shop owner (alerts such as phones whose notifications are off).
export async function sendOwnerAlertEmail(subject: string, html: string) {
  await sendEmail(process.env.OWNER_ALERT_EMAIL || 'gronymultimedia@gmail.com', subject, html)
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

export async function sendTransactionEmail(to: string, name: string, customerId: string, items: Array<{ name: string; qty: number; price: number }>, opts: { receiptNo?: string; lifetime?: number | null; prizeTarget?: number } = {}) {
  const itemsHtml = items.map(item => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px;text-align:left">${esc(item.name)}</td>
      <td style="padding:8px;text-align:right">${item.qty} × ₵${item.price.toFixed(2)}</td>
      <td style="padding:8px;text-align:right;font-weight:600">₵${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('')

  const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0)

  const loyalty = opts.lifetime != null && opts.prizeTarget
    ? (opts.lifetime < opts.prizeTarget
        ? `<p style="margin:16px 0 0;color:#1e293b"><strong>Your total work with us so far: ₵${opts.lifetime.toFixed(2)}</strong><br>Reach ₵${opts.prizeTarget.toFixed(2)} in total and you stand a chance to win an amazing prize from us! Only ₵${(opts.prizeTarget - opts.lifetime).toFixed(2)} to go.</p>`
        : `<p style="margin:16px 0 0;color:#1e293b"><strong>Your total work with us so far: ₵${opts.lifetime.toFixed(2)}</strong><br>You have passed ₵${opts.prizeTarget.toFixed(2)} with us, so you stand a chance to win an amazing prize from us! Thank you for your trust.</p>`)
    : ''
  await sendEmail(to, opts.receiptNo ? `Grony Multimedia - Receipt ${opts.receiptNo}` : 'Grony Multimedia - Transaction Confirmation', `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#1e293b">Transaction Confirmed</h2>
      <p>Hi ${esc(name)},</p>
      <p>Thank you for choosing <strong>Grony Multimedia</strong>, Assin Foso (near GCB Bank). ${opts.receiptNo ? `Receipt <strong>${esc(opts.receiptNo)}</strong>: ` : ''}here is what we did for you:</p>
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
      ${loyalty}
      <p style="color:#64748b;font-size:13px;margin-top:16px">Customer ID: <strong>${esc(customerId)}</strong></p>
      <p style="color:#64748b;font-size:13px">Call / WhatsApp / Mobile Money: <strong>053 432 8977</strong><br>
      Website: www.gronymultimedia.com<br>Email: info@gronymultimedia.com</p>
    </div>
  `)
}
