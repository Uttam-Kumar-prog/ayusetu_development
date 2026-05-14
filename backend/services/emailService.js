const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return _transporter;
}

function wrap(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0fdf4;margin:0;padding:0}
.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.1)}
.hdr{background:linear-gradient(135deg,#14532d,#16a34a);padding:32px 40px;text-align:center}
.hdr h1{color:#fff;font-size:22px;margin:0;font-weight:800;letter-spacing:.5px}
.hdr p{color:#bbf7d0;font-size:13px;margin:6px 0 0}
.body{padding:36px 40px}
.body h2{font-size:20px;color:#1e293b;margin:0 0 8px;font-weight:700}
.body p{color:#475569;font-size:15px;line-height:1.75;margin:0 0 14px}
.box{background:#f0fdf4;border-left:4px solid #16a34a;border-radius:10px;padding:16px 20px;margin:18px 0}
.box p{margin:4px 0;color:#166534;font-size:14px}
.box strong{color:#14532d}
.btn{display:inline-block;background:#16a34a;color:#fff!important;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px;margin:8px 0}
.badge{display:inline-block;background:#dcfce7;color:#15803d;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase}
.disc{background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:13px;color:#713f12}
.ftr{background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 40px;text-align:center}
.ftr p{color:#94a3b8;font-size:12px;margin:0}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th,td{padding:9px 12px;border:1px solid #e2e8f0;text-align:left}
thead tr{background:#f0fdf4}
</style></head><body><div class="wrap">
<div class="hdr"><h1>🌿 AyuSetu — AyuSetu Health</h1><p>Ayurvedic Telemedicine Platform</p></div>
<div class="body">${content}</div>
<div class="ftr"><p>This is an automated message. Do not reply. &copy; ${new Date().getFullYear()} AyuSetu Healthcare</p></div>
</div></body></html>`;
}

async function send({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email LOG] To:${to} | Subject:${subject}`);
    return { logged: true };
  }
  return t.sendMail({ from: `"AyuSetu Health" <${process.env.EMAIL_USER}>`, to, subject, html });
}

exports.bookingConfirmToPatient = async ({ patient, doctor, appt }) => {
  if (!patient?.email) return;
  const isVideo = appt.consultationType === 'telemedicine';
  return send({
    to: patient.email, subject: `Appointment Confirmed — ${appt.slotDate} at ${appt.slotTime}`,
    html: wrap(`
      <h2>Your appointment is confirmed ✅</h2>
      <p>Hi <strong>${patient.fullName}</strong>, your consultation has been booked.</p>
      <div class="box">
        <p><strong>Doctor:</strong> Dr. ${doctor.fullName} (${doctor.doctorProfile?.specialty || 'Specialist'})</p>
        <p><strong>Date:</strong> ${appt.slotDate} &nbsp; <strong>Time:</strong> ${appt.slotTime}</p>
        <p><strong>Type:</strong> <span class="badge">${appt.consultationType}</span></p>
        <p><strong>Code:</strong> ${appt.appointmentCode}</p>
      </div>
      ${isVideo ? `<p>Your video room is ready. Join on time.</p><a href="${appt.meeting.joinUrl}" class="btn">Join Consultation Room</a>` : '<p>Please arrive at the clinic on time.</p>'}
      <div class="disc">⚠️ Be present 5 min early. For video calls, test your camera and mic beforehand.</div>
    `),
  });
};

exports.bookingNotifyDoctor = async ({ patient, doctor, appt, symptomSummary }) => {
  if (!doctor?.email) return;
  return send({
    to: doctor.email, subject: `New Appointment: ${patient.fullName} on ${appt.slotDate}`,
    html: wrap(`
      <h2>New patient appointment 📋</h2>
      <p>Hi Dr. <strong>${doctor.fullName}</strong>, a new appointment has been booked.</p>
      <div class="box">
        <p><strong>Patient:</strong> ${patient.fullName}</p>
        <p><strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
        <p><strong>Date:</strong> ${appt.slotDate} &nbsp; <strong>Time:</strong> ${appt.slotTime}</p>
        <p><strong>Type:</strong> <span class="badge">${appt.consultationType}</span></p>
        <p><strong>Code:</strong> ${appt.appointmentCode}</p>
      </div>
      ${symptomSummary ? `<div class="box" style="border-color:#2563eb;background:#eff6ff"><p><strong>🤖 Patient Symptom Summary (AI-structured):</strong></p><p style="white-space:pre-wrap;color:#1e40af">${symptomSummary}</p></div>` : ''}
      <a href="${process.env.WEB_URL || 'http://localhost:5173'}/doctor-dashboard" class="btn">Open Doctor Dashboard</a>
    `),
  });
};

exports.reminderToPatient = async ({ patient, doctor, appt }) => {
  if (!patient?.email) return;
  const isVideo = appt.consultationType === 'telemedicine';
  return send({
    to: patient.email, subject: `Reminder: Consultation with Dr. ${doctor.fullName} soon`,
    html: wrap(`
      <h2>Upcoming consultation reminder ⏰</h2>
      <p>Hi <strong>${patient.fullName}</strong>, your consultation is starting soon.</p>
      <div class="box">
        <p><strong>Doctor:</strong> Dr. ${doctor.fullName}</p>
        <p><strong>Date:</strong> ${appt.slotDate} &nbsp; <strong>Time:</strong> ${appt.slotTime}</p>
        <p><strong>Type:</strong> <span class="badge">${appt.consultationType}</span></p>
      </div>
      ${isVideo ? `<a href="${appt.meeting.joinUrl}" class="btn">Join Consultation Now</a>` : '<p>Please head to the clinic.</p>'}
    `),
  });
};

exports.reminderToDoctor = async ({ patient, doctor, appt }) => {
  if (!doctor?.email) return;
  return send({
    to: doctor.email, subject: `Reminder: Consultation with ${patient.fullName} soon`,
    html: wrap(`
      <h2>Upcoming consultation reminder ⏰</h2>
      <p>Hi Dr. <strong>${doctor.fullName}</strong>, you have an upcoming consultation.</p>
      <div class="box">
        <p><strong>Patient:</strong> ${patient.fullName}</p>
        <p><strong>Date:</strong> ${appt.slotDate} &nbsp; <strong>Time:</strong> ${appt.slotTime}</p>
        <p><strong>Type:</strong> <span class="badge">${appt.consultationType}</span></p>
      </div>
      <a href="${process.env.WEB_URL || 'http://localhost:5173'}/doctor-dashboard" class="btn">Open Dashboard</a>
    `),
  });
};

exports.doctorStartedCall = async ({ patient, doctor, appt }) => {
  if (!patient?.email) return;
  return send({
    to: patient.email, subject: `Dr. ${doctor.fullName} has started your consultation — Join Now`,
    html: wrap(`
      <h2>Your doctor is ready 🟢</h2>
      <p>Hi <strong>${patient.fullName}</strong>, Dr. <strong>${doctor.fullName}</strong> has started the video consultation.</p>
      <div class="box">
        <p><strong>Appointment:</strong> ${appt.slotDate} at ${appt.slotTime}</p>
      </div>
      <p>Please join now to begin your session.</p>
      <a href="${appt.meeting.joinUrl}" class="btn">Join Now →</a>
      <div class="disc">Please join within a few minutes. If you face issues, refresh the page.</div>
    `),
  });
};

exports.manualReminderToPatient = async ({ patient, doctor, appt }) => {
  if (!patient?.email) return;
  return send({
    to: patient.email, subject: `Dr. ${doctor.fullName} is waiting — Join your consultation`,
    html: wrap(`
      <h2>Reminder from your doctor 👨‍⚕️</h2>
      <p>Hi <strong>${patient.fullName}</strong>, Dr. <strong>${doctor.fullName}</strong> is waiting in the consultation room.</p>
      <a href="${appt.meeting.joinUrl}" class="btn">Join Consultation Now →</a>
    `),
  });
};

exports.prescriptionIssuedToPatient = async ({ patient, doctor, appt, rx }) => {
  if (!patient?.email) return;
  const rows = (rx.medicines || []).map(m =>
    `<tr><td>${m.name}</td><td>${m.dose}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${m.instructions || '—'}</td></tr>`
  ).join('');
  return send({
    to: patient.email, subject: `Prescription from Dr. ${doctor.fullName} — ${appt.slotDate}`,
    html: wrap(`
      <h2>Your prescription is ready 💊</h2>
      <p>Dr. <strong>${doctor.fullName}</strong> has issued a prescription for your recent consultation.</p>
      <div class="box"><p><strong>Date:</strong> ${appt.slotDate}</p>
      ${rx.diagnosis?.length ? `<p><strong>Diagnosis:</strong> ${rx.diagnosis.join(', ')}</p>` : ''}</div>
      <table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${rx.advice ? `<div class="box" style="margin-top:14px"><p><strong>Advice:</strong> ${rx.advice}</p></div>` : ''}
      ${rx.followUpDate ? `<p>📅 <strong>Follow-up:</strong> ${new Date(rx.followUpDate).toLocaleDateString()}</p>` : ''}
      <a href="${process.env.WEB_URL || 'http://localhost:5173'}/dashboard" class="btn">View in Dashboard</a>
      <div class="disc">⚠️ Follow prescribed dosage. Consult your doctor before any changes.</div>
    `),
  });
};
