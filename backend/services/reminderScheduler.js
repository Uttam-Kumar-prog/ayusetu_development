const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { createNotification } = require('./notificationService');
const email = require('./emailService');

const MINUTES = Number(process.env.REMINDER_MINUTES_BEFORE || 15);
const sent = new Set();

async function processReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (MINUTES - 1) * 60000);
  const windowEnd   = new Date(now.getTime() + (MINUTES + 1) * 60000);
  try {
    const upcoming = await Appointment.find({
      startAt: { $gte: windowStart, $lte: windowEnd },
      status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
    })
      .populate('patientId', 'fullName email phone')
      .populate('doctorId',  'fullName email doctorProfile');

    for (const appt of upcoming) {
      const key = `reminder:${appt._id}`;
      if (sent.has(key)) continue;
      sent.add(key);

      const patient = appt.patientId;
      const doctor  = appt.doctorId;

      await Promise.allSettled([
        email.reminderToPatient({ patient, doctor, appt }),
        email.reminderToDoctor({ patient, doctor, appt }),
        createNotification({ userId: patient._id, type: 'CONSULTATION_REMINDER', title: 'Consultation Reminder',
          body: `Your consultation with Dr. ${doctor?.fullName} starts in ${MINUTES} minutes.` }),
        createNotification({ userId: doctor._id, type: 'CONSULTATION_REMINDER', title: 'Upcoming Consultation',
          body: `Consultation with ${patient?.fullName} starts in ${MINUTES} minutes.` }),
      ]);
      console.log(`[Reminder] Sent for appointment ${appt.appointmentCode}`);
    }
  } catch (err) {
    console.error('[ReminderScheduler]', err.message);
  }
}

function startReminderScheduler() {
  cron.schedule('* * * * *', processReminders);
  console.log('[ReminderScheduler] Started — checking every minute');
}

module.exports = { startReminderScheduler };
