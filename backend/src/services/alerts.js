const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { prisma } = require('../db/client');

function severityRank(sev) {
  const order = ['EMERGENCY','ALERT','CRITICAL','ERROR','WARNING','NOTICE','INFO','DEBUG','UNKNOWN'];
  const idx = order.indexOf(sev);
  return idx === -1 ? order.length : idx;
}

async function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: process.env.MAIL_USER ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } : undefined,
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM || 'no-reply@example.com', to, subject, text });
}

async function sendSms(to, body) {
  if (!process.env.SMS_TWILIO_ACCOUNT_SID) return;
  const client = twilio(process.env.SMS_TWILIO_ACCOUNT_SID, process.env.SMS_TWILIO_AUTH_TOKEN);
  await client.messages.create({ from: process.env.SMS_TWILIO_FROM, to, body });
}

async function evaluateAndNotify(log) {
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });
  for (const rule of rules) {
    if (rule.deviceIp && rule.deviceIp !== log.deviceIp) continue;
    if (rule.minSeverity && severityRank(log.severity) > severityRank(rule.minSeverity)) continue;
    if (rule.keyword && !log.message.toLowerCase().includes(rule.keyword.toLowerCase())) continue;

    const subject = `Syslog Alert: ${rule.name}`;
    const body = `Time: ${log.timestamp}\nDevice: ${log.deviceIp}\nSeverity: ${log.severity}\nMessage: ${log.message}`;

    try {
      if (rule.emailTo) {
        await sendEmail(rule.emailTo, subject, body);
        await prisma.alertNotification.create({ data: { ruleId: rule.id, logId: log.id, channel: 'email', status: 'sent' } });
      }
      if (rule.smsTo) {
        await sendSms(rule.smsTo, body);
        await prisma.alertNotification.create({ data: { ruleId: rule.id, logId: log.id, channel: 'sms', status: 'sent' } });
      }
    } catch (err) {
      await prisma.alertNotification.create({ data: { ruleId: rule.id, logId: log.id, channel: 'email/sms', status: 'failed', error: String(err) } });
    }
  }
}

module.exports = { evaluateAndNotify };