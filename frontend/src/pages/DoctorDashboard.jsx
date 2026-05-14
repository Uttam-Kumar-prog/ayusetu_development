import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentsAPI, prescriptionsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ManageAvailabilityModal from '../components/ManageAvailabilityModal';

// ── Small helpers ───────────────────────────────────────────────────────────
const statusColor = (s) => ({
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  NO_SHOW: 'bg-slate-100 text-slate-600',
}[s] || 'bg-slate-100 text-slate-600');

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-[2rem] shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} p-8 max-h-[92vh] overflow-auto`}>
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        <h3 className="text-2xl font-bold text-slate-900 font-serif mb-1">{title}</h3>
        {subtitle && <p className="text-slate-500 text-sm mb-5">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// ── Prescription form component ─────────────────────────────────────────────
function PrescriptionForm({ appointmentId, existingRx, onSaved, onClose }) {
  const [diagnosis, setDiagnosis] = useState((existingRx?.diagnosis || []).join(', '));
  const [advice, setAdvice] = useState(existingRx?.advice || '');
  const [followUpDate, setFollowUpDate] = useState(
    existingRx?.followUpDate ? new Date(existingRx.followUpDate).toISOString().split('T')[0] : ''
  );
  const [medicines, setMedicines] = useState(
    existingRx?.medicines?.length ? existingRx.medicines : [{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addMed = () => setMedicines(m => [...m, { name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const removeMed = (i) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMed = (i, field, val) => setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med));

  const handleSave = async () => {
    setErr('');
    const cleanMeds = medicines.filter(m => m.name.trim());
    if (!cleanMeds.length) { setErr('Add at least one medicine.'); return; }
    setSaving(true);
    try {
      const { data } = await prescriptionsAPI.create({
        appointmentId,
        diagnosis: diagnosis.split(',').map(d => d.trim()).filter(Boolean),
        medicines: cleanMeds,
        advice,
        followUpDate: followUpDate || null,
      });
      onSaved(data.prescription);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Could not save prescription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{err}</div>}

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Diagnosis / Findings</label>
        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="e.g., Vata imbalance, chronic fatigue (comma separated)"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 text-sm" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Medicines</label>
          <button onClick={addMed} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1">
            + Add Medicine
          </button>
        </div>
        <div className="space-y-3">
          {medicines.map((med, i) => (
            <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <input value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} placeholder="Medicine name"
                  className="col-span-2 md:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-green-500" />
                <input value={med.dose} onChange={e => updateMed(i, 'dose', e.target.value)} placeholder="Dose (e.g. 500mg)"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-green-500" />
                <input value={med.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} placeholder="Frequency (e.g. 2x/day)"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={med.duration} onChange={e => updateMed(i, 'duration', e.target.value)} placeholder="Duration (e.g. 7 days)"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-green-500" />
                <div className="flex gap-2">
                  <input value={med.instructions} onChange={e => updateMed(i, 'instructions', e.target.value)} placeholder="Special instructions"
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-green-500" />
                  {medicines.length > 1 && (
                    <button onClick={() => removeMed(i)} className="px-2 text-rose-400 hover:text-rose-600 font-bold">✕</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Doctor's Advice / Instructions</label>
        <textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={3} placeholder="Dietary advice, lifestyle recommendations, precautions..."
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 resize-none text-sm" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Follow-up Date (optional)</label>
        <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 text-sm" />
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm">
          {saving ? 'Saving...' : existingRx ? 'Update Prescription' : 'Save Prescription'}
        </button>
      </div>
    </div>
  );
}

// ── Main DoctorDashboard ────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Modals
  const [selectedAppt, setSelectedAppt]     = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCaseModal, setShowCaseModal]    = useState(false);
  const [showRxModal, setShowRxModal]        = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // Status editor state
  const [editStatus, setEditStatus] = useState('IN_PROGRESS');
  const [editNotes, setEditNotes]   = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  // Case summary state
  const [caseSummary, setCaseSummary]   = useState(null);
  const [caseLoading, setCaseLoading]   = useState(false);
  const [caseError, setCaseError]       = useState('');

  // Prescription state
  const [existingRx, setExistingRx]   = useState(null);
  const [rxLoading, setRxLoading]     = useState(false);

  // Per-appointment action loading
  const [actionLoading, setActionLoading] = useState({});

  // Toast
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await appointmentsAPI.mine();
        setAppointments(data?.appointments || []);
      } catch (e) {
        setError(e?.response?.data?.message || 'Could not load appointments.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => ({
    total:     appointments.length,
    pending:   appointments.filter(a => ['CONFIRMED', 'IN_PROGRESS'].includes(a.status)).length,
    completed: appointments.filter(a => a.status === 'COMPLETED').length,
    earnings:  `₹${appointments.length * 800}`,
  }), [appointments]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleJoinCall = (appt) => {
    const roomId = appt?.meeting?.roomId;
    if (!roomId) { showToast('No meeting room found.', 'error'); return; }
    navigate(`/consultation/${roomId}`);
  };

  const handleStartCall = async (appt) => {
    setActionLoading(p => ({ ...p, [`start_${appt._id}`]: true }));
    try {
      await appointmentsAPI.startConsultation(appt._id);
      setAppointments(prev => prev.map(a => a._id === appt._id ? { ...a, status: 'IN_PROGRESS' } : a));
      showToast('Consultation started! Patient has been notified by email.');
      handleJoinCall(appt);
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not start consultation.', 'error');
    } finally {
      setActionLoading(p => ({ ...p, [`start_${appt._id}`]: false }));
    }
  };

  const handleRemindPatient = async (appt) => {
    setActionLoading(p => ({ ...p, [`remind_${appt._id}`]: true }));
    try {
      await appointmentsAPI.remindPatient(appt._id);
      showToast('Reminder sent to patient successfully!');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not send reminder.', 'error');
    } finally {
      setActionLoading(p => ({ ...p, [`remind_${appt._id}`]: false }));
    }
  };

  const openStatusModal = (appt) => {
    setSelectedAppt(appt);
    setEditStatus(appt.status || 'IN_PROGRESS');
    setEditNotes(appt.notesByDoctor || '');
    setShowStatusModal(true);
  };

  const saveStatus = async () => {
    if (!selectedAppt) return;
    setIsSaving(true);
    try {
      const { data } = await appointmentsAPI.updateStatus(selectedAppt._id, { status: editStatus, notesByDoctor: editNotes });
      setAppointments(prev => prev.map(a => a._id === data.appointment._id ? data.appointment : a));
      setShowStatusModal(false);
      showToast('Appointment updated.');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not update.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openCaseModal = async (appt) => {
    setSelectedAppt(appt);
    setShowCaseModal(true);
    setCaseLoading(true);
    setCaseError('');
    setCaseSummary(null);
    try {
      const { data } = await appointmentsAPI.caseSummary(appt._id);
      setCaseSummary(data?.summary || null);
    } catch (e) {
      setCaseError(e?.response?.data?.message || 'Could not load case report.');
    } finally {
      setCaseLoading(false);
    }
  };

  const openRxModal = useCallback(async (appt) => {
    setSelectedAppt(appt);
    setShowRxModal(true);
    setRxLoading(true);
    setExistingRx(null);
    try {
      const { data } = await prescriptionsAPI.byAppointment(appt._id);
      setExistingRx(data?.prescription || null);
    } catch {
      setExistingRx(null); // 404 is fine — means no existing Rx
    } finally {
      setRxLoading(false);
    }
  }, []);

  const onRxSaved = (rx) => {
    setExistingRx(rx);
    showToast('Prescription saved! Patient notified by email.');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-28 pb-20 px-6 bg-slate-50 font-sans">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
      </div>

      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-20 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg font-semibold text-sm ${
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              🩺 Clinician Portal
            </div>
            <h1 className="text-4xl font-bold text-slate-900 font-serif">Welcome, Dr. {user?.fullName || 'Doctor'}</h1>
          </div>
          <div className="flex flex-col gap-3 items-end">
            <div className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button 
              onClick={() => setShowAvailabilityModal(true)}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 text-sm transition-all"
            >
              Manage Availability
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total Appointments', val: stats.total,     color: 'text-slate-800' },
            { label: 'Pending / Active',   val: stats.pending,   color: 'text-amber-600' },
            { label: 'Completed',          val: stats.completed, color: 'text-emerald-600' },
            { label: 'Est. Earnings',      val: stats.earnings,  color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <h3 className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</h3>
            </div>
          ))}
        </div>

        {/* Appointments table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden min-h-[300px] p-8">
          <h2 className="text-2xl font-bold text-slate-800 font-serif mb-6">Patient Appointments</h2>

          {loading ? (
            <div className="text-center py-20 text-slate-500">Loading appointments...</div>
          ) : error ? (
            <div className="text-center py-20 text-rose-600 font-semibold">{error}</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No appointments assigned yet.</div>
          ) : (
            <div className="grid gap-4">
              {appointments.map((appt) => {
                const patientName = appt?.patientId?.fullName || 'Patient';
                const isActive    = ['CONFIRMED', 'IN_PROGRESS'].includes(appt.status);
                const isVideo     = appt.consultationType === 'telemedicine';

                return (
                  <div key={appt._id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-green-200 transition-colors gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-slate-800 truncate">{patientName}</h3>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor(appt.status)}`}>
                          {appt.status}
                        </span>
                        {isVideo && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">📹 Video</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">{appt.slotDate} at {appt.slotTime}</p>

                      {/* Symptom summary */}
                      {(appt.aiSymptomSummary || appt.symptomSummary) && (
                        <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-green-700 uppercase mb-1">
                            {appt.aiSymptomSummary ? '🤖 AI-Structured Symptoms' : '📝 Patient Symptoms'}
                          </p>
                          <p className="text-sm text-green-800 line-clamp-2">
                            {appt.aiSymptomSummary || appt.symptomSummary}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                      {/* Case Report */}
                      <button onClick={() => openCaseModal(appt)}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors">
                        Case Report
                      </button>

                      {/* Prescription */}
                      <button onClick={() => openRxModal(appt)}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                        💊 Prescription
                      </button>

                      {/* Start Call (doctor initiates) */}
                      {isVideo && isActive && appt.status !== 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleStartCall(appt)}
                          disabled={actionLoading[`start_${appt._id}`]}
                          className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                          {actionLoading[`start_${appt._id}`] ? 'Starting...' : '▶ Start Call'}
                        </button>
                      )}

                      {/* Join Call (if already in progress) */}
                      {isVideo && appt.status === 'IN_PROGRESS' && (
                        <button onClick={() => handleJoinCall(appt)}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors">
                          📹 Join Call
                        </button>
                      )}

                      {/* Send Reminder */}
                      {isVideo && isActive && (
                        <button
                          onClick={() => handleRemindPatient(appt)}
                          disabled={actionLoading[`remind_${appt._id}`]}
                          className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors">
                          {actionLoading[`remind_${appt._id}`] ? 'Sending...' : '🔔 Remind Patient'}
                        </button>
                      )}

                      {/* Update Status */}
                      <button onClick={() => openStatusModal(appt)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors">
                        Update
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Status update modal ── */}
      {showStatusModal && selectedAppt && (
        <Modal title="Update Appointment" subtitle={selectedAppt?.patientId?.fullName || 'Patient'} onClose={() => setShowStatusModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 text-sm">
                {['CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Doctor Notes</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                className="w-full h-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 resize-none text-sm"
                placeholder="Add consultation notes..." />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowStatusModal(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
              <button onClick={saveStatus} disabled={isSaving} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Case summary modal ── */}
      {showCaseModal && (
        <Modal wide title="Patient Case Report" subtitle={selectedAppt?.patientId?.fullName || 'Patient'} onClose={() => { setShowCaseModal(false); setCaseSummary(null); }}>
          {caseLoading ? (
            <p className="text-slate-500">Loading case report...</p>
          ) : caseError ? (
            <p className="text-rose-600 font-semibold">{caseError}</p>
          ) : caseSummary ? (
            <div className="space-y-5">
              <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">Appointment</h4>
                <p className="text-sm text-slate-600">{caseSummary?.appointment?.slotDate} at {caseSummary?.appointment?.slotTime} — <strong>{caseSummary?.appointment?.status}</strong></p>
                {caseSummary?.appointment?.symptomSummary && (
                  <p className="text-sm text-slate-600 mt-2">📝 <strong>Patient's symptoms:</strong> {caseSummary.appointment.symptomSummary}</p>
                )}
                {caseSummary?.appointment?.aiSymptomSummary && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-green-700 uppercase mb-1">🤖 AI-Structured Summary</p>
                    <p className="text-sm text-green-800">{caseSummary.appointment.aiSymptomSummary}</p>
                  </div>
                )}
              </section>

              <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">Symptom History</h4>
                {caseSummary?.symptomMemory ? (
                  <>
                    {caseSummary.symptomMemory.topSymptoms?.length > 0 && (
                      <p className="text-sm text-slate-600">🔁 Recurring: <strong>{caseSummary.symptomMemory.topSymptoms.join(', ')}</strong></p>
                    )}
                    {caseSummary.symptomMemory.likelyCauses?.length > 0 && (
                      <p className="text-sm text-slate-600 mt-1">⚡ Likely factors: {caseSummary.symptomMemory.likelyCauses.join(', ')}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {(caseSummary.symptomMemory.recentConversationSignals || []).map((e, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-slate-400 uppercase">{e.source} — {new Date(e.createdAt).toLocaleString()}</p>
                          <p className="text-sm text-slate-700 mt-1">{e.snippet || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-sm text-slate-500">No longitudinal symptom data yet.</p>}
              </section>

              <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">Recent Assessments</h4>
                {(caseSummary.recentAssessments || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No recent assessments.</p>
                ) : (caseSummary.recentAssessments || []).map(item => (
                  <div key={item._id} className="bg-white border border-slate-200 rounded-xl p-3 mb-2">
                    <p className="text-xs font-bold text-slate-400">{new Date(item.createdAt).toLocaleString()} | {item?.triage?.severityLevel || 'N/A'}</p>
                    <p className="text-sm text-slate-700 mt-1">Symptoms: {(item.symptoms || []).map(s => s.name).join(', ') || 'N/A'}</p>
                  </div>
                ))}
              </section>
            </div>
          ) : null}
        </Modal>
      )}

      {/* ── Prescription modal ── */}
      {showRxModal && selectedAppt && (
        <Modal wide title={existingRx ? 'Update Prescription' : 'Write Prescription'}
          subtitle={selectedAppt?.patientId?.fullName || 'Patient'}
          onClose={() => { setShowRxModal(false); setExistingRx(null); }}>
          {rxLoading ? (
            <p className="text-slate-500">Loading prescription...</p>
          ) : (
            <PrescriptionForm
              appointmentId={selectedAppt._id}
              existingRx={existingRx}
              onSaved={onRxSaved}
              onClose={() => { setShowRxModal(false); setExistingRx(null); }}
            />
          )}
        </Modal>
      )}

      {/* ── Manage Availability modal ── */}
      {showAvailabilityModal && (
         <ManageAvailabilityModal
           doctorId={user?._id || user?.id}
           onClose={() => setShowAvailabilityModal(false)}
         />
      )}
    </div>
  );
}
