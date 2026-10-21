const ALLOWED_PRACTICES = new Set([
  'Litigation & Dispute Resolution',
  'Corporate & Commercial',
  'Real Estate & Property',
  'Family Law',
  'Arbitration',
  'Energy & Natural Resources',
  'Maritime',
  'Employment & Pension',
  'Telecommunications',
  'Administrative Law',
  'Election Petition',
  'Other'
]);

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
    }
  });

const clean = (value, maxLength) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export default async (request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json(415, { error: 'Unsupported request format.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Please check the form and try again.' });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'Please check the form and try again.' });
  }

  // Quietly accept honeypot submissions without sending email.
  if (clean(body.company, 200)) return json(200, { ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 40);
  const practice = clean(body.practice, 100);
  const preferredDate = clean(body.preferredDate, 10);
  const preferredTime = clean(body.preferredTime, 5);
  const message = clean(body.message, 5000);

  const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  if (!name || !email || !practice || !preferredDate || !preferredTime || !message) {
    return json(400, { error: 'Please complete all required fields.' });
  }
  if (!emailPattern.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' });
  }
  if (!ALLOWED_PRACTICES.has(practice)) {
    return json(400, { error: 'Please select a valid area of law.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
      Number.isNaN(Date.parse(`${preferredDate}T00:00:00.000Z`)) ||
      new Date(`${preferredDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== preferredDate ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
    return json(400, { error: 'Please provide a valid preferred date and time.' });
  }
  const [year, month, day] = preferredDate.split('-').map(Number);
  const [hours, minutes] = preferredTime.split(':').map(Number);
  const preferredAt = Date.UTC(year, month - 1, day, hours - 1, minutes);
  if (preferredAt <= Date.now()) {
    return json(400, { error: 'Please choose a future date and time in West Africa Time.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const firmEmail = process.env.FIRM_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !firmEmail || !fromEmail) {
    console.error('Contact form email environment variables are not configured.');
    return json(503, { error: 'The enquiry service is not configured yet. Please contact the firm directly.' });
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || 'Not provided');
  const safePractice = escapeHtml(practice);
  const safeDate = escapeHtml(preferredDate);
  const safeTime = escapeHtml(preferredTime);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const text = [
    'New consultation request — Adoration Chambers',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Area of law: ${practice}`,
    `Preferred date: ${preferredDate}`,
    `Preferred time: ${preferredTime} WAT`,
    '',
    'Message:',
    message,
    '',
    'Note: This enquiry was submitted through the website. Do not assume a solicitor-client relationship has been created.'
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [firmEmail],
        reply_to: email,
        subject: `Consultation request: ${practice}`,
        text,
        html: `<h2>New consultation request</h2><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Phone:</strong> ${safePhone}</p><p><strong>Area of law:</strong> ${safePractice}</p><p><strong>Preferred date:</strong> ${safeDate}</p><p><strong>Preferred time:</strong> ${safeTime} WAT</p><hr><p><strong>Message:</strong></p><p>${safeMessage}</p><hr><p style="color:#666;font-size:12px">The requested date and time are not confirmed. Contact the visitor to confirm availability. This request does not create a solicitor-client relationship.</p>`
      })
    });

    if (!response.ok) {
      const providerError = await response.text();
      console.error('Email provider rejected contact form submission:', response.status, providerError.slice(0, 500));
      return json(502, { error: 'We could not send your enquiry right now. Please try again later.' });
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error('Contact form delivery failed:', error?.message || 'Unknown error');
    return json(502, { error: 'We could not send your enquiry right now. Please try again later.' });
  }
};
