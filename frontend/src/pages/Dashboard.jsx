import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentsAPI, symptomsAPI, prescriptionsAPI } from '../utils/api';
import { jsPDF } from 'jspdf';

// ── Helpers ─────────────────────────────────────────────────────────────────
const statusColor = (s) => ({
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  NO_SHOW: 'bg-slate-100 text-slate-600',
}[s] || 'bg-slate-100 text-slate-600');

function PrescriptionCard({ rx, onDownload }) {
  const doctor = rx?.doctorId?.fullName ? `Dr. ${rx.doctorId.fullName}` : 'Doctor';
  const spec   = rx?.doctorId?.doctorProfile?.specialty || '';
  const date   = rx?.appointmentId?.slotDate || new Date(rx.createdAt).toLocaleDateString();

  return (
    <div className="bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-800">{doctor}</p>
          {spec && <p className="text-xs text-slate-500">{spec}</p>}
          <p className="text-xs text-slate-400 mt-0.5">📅 {date}</p>
        </div>
        <button
          onClick={() => onDownload(rx)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors shadow-sm"
        >
          ⬇ PDF
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-4 space-y-3">
        {rx.diagnosis?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Diagnosis</p>
            <div className="flex flex-wrap gap-1">
              {rx.diagnosis.map((d, i) => (
                <span key={i} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">{d}</span>
              ))}
            </div>
          </div>
        )}

        {rx.medicines?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Medicines</p>
            <div className="space-y-1.5">
              {rx.medicines.map((m, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-green-600 mt-0.5">💊</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.dose} — {m.frequency} — {m.duration}</p>
                    {m.instructions && <p className="text-xs text-slate-400 italic">{m.instructions}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rx.advice && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-amber-700 uppercase mb-1">Doctor's Advice</p>
            <p className="text-sm text-amber-900">{rx.advice}</p>
          </div>
        )}

        {rx.followUpDate && (
          <p className="text-sm text-slate-600">
            📅 <strong>Follow-up:</strong> {new Date(rx.followUpDate).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Generate PDF ─────────────────────────────────────────────────────────────
function downloadPrescriptionPDF(rx) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = doc.internal.pageSize.getWidth();
  let y = 18;

  const line = (text, fontSize = 11, bold = false, color = [30, 30, 30]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, W - 30);
    doc.text(lines, 15, y);
    y += lines.length * (fontSize * 0.45 + 2);
  };
  const gap = (h = 5) => { y += h; };
  const rule = () => { doc.setDrawColor(200, 230, 200); doc.setLineWidth(0.3); doc.line(15, y, W - 15, y); gap(4); };

  // Header
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('IU Setu — AyuSetu Health', 15, 14);
  doc.setFontSize(9);
  doc.text('Ayurvedic Telemedicine Platform', W - 15, 14, { align: 'right' });
  y = 30;

  line('PRESCRIPTION', 14, true, [20, 83, 45]);
  gap(2);
  rule();

  const doctor  = rx?.doctorId?.fullName ? `Dr. ${rx.doctorId.fullName}` : 'Doctor';
  const spec    = rx?.doctorId?.doctorProfile?.specialty || '';
  const patient = rx?.patientId?.fullName || 'Patient';
  const date    = rx?.appointmentId?.slotDate || new Date(rx.createdAt).toLocaleDateString();

  line(`Doctor: ${doctor}${spec ? ` (${spec})` : ''}`, 10, true);
  line(`Patient: ${patient}`, 10);
  line(`Date: ${date}`, 10);
  gap(3);
  rule();

  if (rx.diagnosis?.length) {
    line('Diagnosis:', 10, true);
    line(rx.diagnosis.join(', '), 10);
    gap(3);
  }

  line('Medicines:', 10, true);
  gap(1);
  (rx.medicines || []).forEach((m, i) => {
    line(`${i + 1}. ${m.name}`, 10, true);
    line(`   Dose: ${m.dose}  |  Frequency: ${m.frequency}  |  Duration: ${m.duration}`, 9);
    if (m.instructions) line(`   Note: ${m.instructions}`, 9, false, [100, 100, 100]);
    gap(1.5);
  });

  if (rx.advice) {
    gap(2);
    rule();
    line('Advice:', 10, true);
    line(rx.advice, 10);
  }

  if (rx.followUpDate) {
    gap(3);
    line(`Follow-up Date: ${new Date(rx.followUpDate).toLocaleDateString()}`, 10, true, [22, 163, 74]);
  }

  gap(8);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by IU Setu (AyuSetu) — This prescription was issued by a licensed Ayurvedic practitioner.', 15, y);

  doc.save(`prescription_${patient.replace(/\s+/g, '_')}_${date}.pdf`);
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history,       setHistory]       = useState([]);
  const [appointments,  setAppointments]  = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeTab,     setActiveTab]     = useState('appointments');
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [histRes, apptRes, rxRes] = await Promise.allSettled([
          symptomsAPI.history(),
          appointmentsAPI.mine(),
          prescriptionsAPI.mine(),
        ]);

        if (histRes.status === 'fulfilled') {
          setHistory((histRes.value?.data?.records || []).map(r => ({
            id: r._id,
            date: new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            symptoms: r.symptoms || [],
            doshaImbalance: r?.triage?.doshaImbalance || 'General Imbalance',
            severityLevel:  r?.triage?.severityLevel  || 'moderate',
            recommendedSpecialty: r?.triage?.recommendedSpecialty || 'Kayachikitsa',
            recommendations: r.recommendations || [],
            disclaimer: r?.triage?.disclaimer || '',
          })));
        }

        if (apptRes.status === 'fulfilled') {
          setAppointments((apptRes.value?.data?.appointments || []).map(a => ({
            id: a._id,
            doctorName:     a?.doctorId?.fullName || 'Doctor',
            doctorSpecialty:a?.doctorId?.doctorProfile?.specialty || a?.consultationType || 'Specialist',
            date:           a.slotDate,
            time:           a.slotTime,
            status:         a.status,
            consultationType: a.consultationType,
            roomId:         a?.meeting?.roomId || '',
            symptomSummary: a.symptomSummary || '',
            aiSummary:      a.aiSymptomSummary || '',
          })));
        }

        if (rxRes.status === 'fulfilled') {
          setPrescriptions(rxRes.value?.data?.prescriptions || []);
        }
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  const upcoming   = appointments.filter(a => !['COMPLETED','CANCELLED','NO_SHOW'].includes(a.status));
  const past       = appointments.filter(a => ['COMPLETED','CANCELLED','NO_SHOW'].includes(a.status));

  const handleJoinCall = (appt) => {
    if (!appt.roomId) { alert('Consultation room not available yet.'); return; }
    navigate(`/consultation/${appt.roomId}`);
  };

  const handleViewReport = (r) => navigate('/results', { state: { reportData: r } });
  const handleFindSpec   = (r) => navigate('/doctors', { state: { specialty: r.recommendedSpecialty } });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-28 pb-20 px-6 bg-slate-50 font-sans">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif">
              Hello, {user?.fullName || 'Patient'} 👋
            </h1>
            <p className="text-slate-500 mt-1">Your personal wellness dashboard.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/symptoms" className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors text-sm">
              New Assessment
            </Link>
            <Link to="/doctors" className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-colors text-sm">
              Find a Doctor
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
          {[
            { label: 'Reports',     val: history.length,                 color: 'text-slate-800' },
            { label: 'Upcoming',    val: upcoming.length,                color: 'text-blue-600' },
            { label: 'Completed',   val: past.filter(a=>a.status==='COMPLETED').length, color: 'text-emerald-600' },
            { label: 'Prescriptions', val: prescriptions.length,         color: 'text-indigo-600' },
          ].map(s => (
            <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <h3 className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</h3>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 mb-6 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm w-fit">
          {[
            { id: 'appointments', label: '📅 Appointments' },
            { id: 'prescriptions', label: '💊 Prescriptions' },
            { id: 'history', label: '📋 Assessments' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading your data...</div>
        ) : (
          <>
            {/* ── Appointments tab ── */}
            {activeTab === 'appointments' && (
              <div className="space-y-10">
                {/* Upcoming */}
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 font-serif mb-5">Upcoming Consultations</h2>
                  {upcoming.length === 0 ? (
                    <div className="bg-white/60 border border-dashed border-slate-300 rounded-[2rem] p-10 text-center">
                      <p className="text-slate-500 mb-4">No upcoming appointments.</p>
                      <Link to="/doctors" className="text-blue-600 font-bold hover:underline">Book a consultation →</Link>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-5">
                      {upcoming.map(appt => (
                        <div key={appt.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center justify-center bg-blue-50 w-16 h-16 rounded-2xl text-blue-800 flex-shrink-0">
                              <span className="text-xs font-bold uppercase">{new Date(appt.date + 'T00:00:00').toLocaleString('default', { month: 'short' })}</span>
                              <span className="text-2xl font-bold leading-none">{new Date(appt.date + 'T00:00:00').getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-bold text-slate-900 text-base truncate">{appt.doctorName}</h4>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor(appt.status)}`}>{appt.status}</span>
                              </div>
                              <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">{appt.doctorSpecialty}</p>
                              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                <span>🕐 {appt.time}</span>
                                <span>{appt.consultationType === 'telemedicine' ? '📹 Video' : '🏥 In-Person'}</span>
                              </div>

                              {/* AI symptom summary if available */}
                              {(appt.aiSummary || appt.symptomSummary) && (
                                <div className="mt-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                                  <p className="text-xs font-bold text-green-700 mb-0.5">{appt.aiSummary ? '🤖 AI Symptoms' : '📝 Your Symptoms'}</p>
                                  <p className="text-xs text-green-800 line-clamp-2">{appt.aiSummary || appt.symptomSummary}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {appt.consultationType === 'telemedicine' && appt.roomId && (
                            <div className="mt-4">
                              <button
                                onClick={() => handleJoinCall(appt)}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition-colors"
                              >
                                📹 Join Consultation
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Past */}
                {past.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 font-serif mb-5">Past Appointments</h2>
                    <div className="space-y-3">
                      {past.map(appt => (
                        <div key={appt.id} className="bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-slate-800">{appt.doctorName}</p>
                            <p className="text-sm text-slate-500">{appt.date} at {appt.time}</p>
                          </div>
                          <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${statusColor(appt.status)}`}>{appt.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Prescriptions tab ── */}
            {activeTab === 'prescriptions' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 font-serif mb-5">My Prescriptions</h2>
                {prescriptions.length === 0 ? (
                  <div className="bg-white/60 border border-dashed border-slate-300 rounded-[2rem] p-10 text-center">
                    <div className="text-5xl mb-3">💊</div>
                    <p className="text-slate-500">No prescriptions yet.</p>
                    <p className="text-sm text-slate-400 mt-1">Prescriptions from your consultations will appear here.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {prescriptions.map(rx => (
                      <PrescriptionCard key={rx._id} rx={rx} onDownload={downloadPrescriptionPDF} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Assessment history tab ── */}
            {activeTab === 'history' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 font-serif mb-5">Assessment History</h2>
                {history.length === 0 ? (
                  <div className="bg-white/60 border border-dashed border-slate-300 rounded-[2rem] p-10 text-center">
                    <p className="text-slate-500 mb-4">No health reports found.</p>
                    <Link to="/symptoms" className="text-blue-600 font-bold hover:underline">Start your first assessment →</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map(r => (
                      <div key={r.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl">📋</div>
                          <div>
                            <h4 className="font-bold text-slate-800">Health Assessment</h4>
                            <p className="text-slate-500 text-sm">Submitted {r.date}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{r.doshaImbalance} — {r.severityLevel}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleViewReport(r)}
                            className="text-sm font-semibold text-slate-600 hover:text-blue-600 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                            View Report
                          </button>
                          <button onClick={() => handleFindSpec(r)}
                            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl shadow transition-colors">
                            Find Specialist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
