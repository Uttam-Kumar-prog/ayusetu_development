const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    diagnosis: [{ type: String }],
    medicines: [
      {
        name: { type: String, required: true },
        dose: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        instructions: { type: String, default: '' },
      },
    ],
    advice: { type: String, default: '' },
    followUpDate: { type: Date, default: null },
    qrToken: { type: String, required: true, unique: true, index: true },
    pdfUrl: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
