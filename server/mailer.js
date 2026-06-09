const nodemailer = require('nodemailer')

let transporter = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })
  }
  return transporter
}

async function sendNewUserNotification({ userName, userEmail, placeName, city }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS ||
      process.env.MAIL_USER === 'your-gmail@gmail.com') {
    console.log('[mailer] Skipped — MAIL_USER/MAIL_PASS not configured in .env')
    return
  }

  const registeredAt = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })
  const subject = placeName
    ? `VIEW: новий заклад «${placeName}»`
    : `VIEW: новий користувач ${userName}`

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; color: #111;">
      <h2 style="margin:0 0 16px; font-size:20px;">Нова реєстрація на VIEW</h2>
      <table style="border-collapse:collapse; width:100%;">
        <tr>
          <td style="padding:8px 12px; background:#f7f7f7; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#999; width:120px;">Ім'я</td>
          <td style="padding:8px 12px; font-size:14px;">${userName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; background:#f7f7f7; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#999;">Email</td>
          <td style="padding:8px 12px; font-size:14px;"><a href="mailto:${userEmail}" style="color:#111;">${userEmail}</a></td>
        </tr>
        ${placeName ? `
        <tr>
          <td style="padding:8px 12px; background:#f7f7f7; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#999;">Заклад</td>
          <td style="padding:8px 12px; font-size:14px; font-weight:600;">${placeName}</td>
        </tr>` : ''}
        ${city ? `
        <tr>
          <td style="padding:8px 12px; background:#f7f7f7; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#999;">Місто</td>
          <td style="padding:8px 12px; font-size:14px;">${city}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 12px; background:#f7f7f7; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#999;">Час</td>
          <td style="padding:8px 12px; font-size:14px; color:#666;">${registeredAt}</td>
        </tr>
      </table>
    </div>
  `

  await getTransporter().sendMail({
    from: `"VIEW" <${process.env.MAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.MAIL_USER,
    subject,
    html,
  })

  console.log(`[mailer] Notification sent → ${process.env.NOTIFY_EMAIL}`)
}

module.exports = { sendNewUserNotification }
