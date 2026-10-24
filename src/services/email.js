// Email via AWS SES. Lazy-loaded; no-ops gracefully in local dev.
// Configure: verified SES sender in EMAIL_FROM, task role needs ses:SendEmail.
export async function sendEmail(toAddresses, subject, bodyText) {
  const from = process.env.EMAIL_FROM;
  const to = toAddresses.filter(Boolean);
  if (!from || to.length === 0) return { sent: 0, skipped: 'no EMAIL_FROM or recipients' };
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = new SESClient({ region: process.env.AWS_REGION || 'us-west-2' });
    // SES caps 50 recipients per call; batch it
    let sent = 0;
    for (let i = 0; i < to.length; i += 50) {
      await ses.send(new SendEmailCommand({
        Source: from,
        Destination: { BccAddresses: to.slice(i, i + 50) },
        Message: { Subject: { Data: subject }, Body: { Text: { Data: bodyText } } },
      }));
      sent += Math.min(50, to.length - i);
    }
    return { sent };
  } catch (err) {
    console.warn('email skipped:', err.message);
    return { sent: 0, skipped: err.message };
  }
}
