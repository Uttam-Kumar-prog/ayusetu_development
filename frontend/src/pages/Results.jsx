import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const toTitle = (value = '') => {
  const text = String(value || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'N/A';
};

const safeHtml = (value = '') =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const Results = () => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);

    if (location.state?.reportData) {
      setRecommendations(location.state.reportData);
      setLoading(false);
      return;
    }

    const data = JSON.parse(
      localStorage.getItem('last_report') || localStorage.getItem('recommendations') || 'null'
    );
    if (data) {
      setTimeout(() => {
        setRecommendations(data);
        setLoading(false);
      }, 350);
    } else {
      setLoading(false);
    }
  }, [location.state]);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = setTimeout(() => setCopyStatus(''), 2200);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const normalizedRecommendations = useMemo(() => {
    const list = Array.isArray(recommendations?.recommendations) ? recommendations.recommendations : [];
    return list.map((item) => {
      const symptom = item?.symptom || item?.name || 'general';
      const severity = String(item?.severity || recommendations?.severityLevel || 'moderate').toLowerCase();
      const homeRemedy = item?.home || item?.homeRemedy || '';
      const herbalSupport = item?.med || '';
      const urgentAction = item?.action || '';
      const ayurvedicExplanation = item?.reason || item?.explanation || item?.ayurvedicExplanation || '';
      return {
        symptom,
        severity,
        homeRemedy,
        herbalSupport,
        urgentAction,
        ayurvedicExplanation,
      };
    });
  }, [recommendations]);

  const hasHighSeverity = useMemo(() => {
    const reportLevel = String(recommendations?.severityLevel || '').toLowerCase();
    const byReport = reportLevel === 'severe' || reportLevel === 'high';
    const bySymptoms = normalizedRecommendations.some((item) =>
      ['severe', 'high', 'severe/high'].includes(item.severity)
    );
    return byReport || bySymptoms;
  }, [recommendations, normalizedRecommendations]);

  const reportDate = recommendations?.date || new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const reportId = recommendations?.id || `AYU-${Date.now().toString().slice(-8)}`;
  const severityLabel = toTitle(recommendations?.severityLevel || 'moderate');
  const urgencyLabel = toTitle(recommendations?.urgency || recommendations?.severityLevel || 'medium');
  const specialtyLabel = recommendations?.recommendedSpecialty || 'Kayachikitsa';
  const chiefConcerns = normalizedRecommendations.map((rec) => toTitle(rec.symptom)).filter(Boolean);
  const nextSteps = hasHighSeverity
    ? [
        'Consult a specialist today for in-person assessment.',
        'Use home remedies only as temporary supportive care.',
        'If severe warning symptoms appear, seek emergency care immediately.',
      ]
    : [
        'Follow the recommended home and herbal guidance for 3-5 days.',
        'Track symptom intensity daily and monitor progression.',
        `Book a ${specialtyLabel} consultation if symptoms persist or worsen.`,
      ];

  const handleConsultSpecialist = () => {
    navigate('/doctors', {
      state: {
        specialty: recommendations?.recommendedSpecialty,
        reason: 'Recommended based on your recent report',
      },
    });
  };

  const buildSummaryText = () => {
    const lines = [
      `AyuSetu Report: ${reportId}`,
      `Date: ${reportDate}`,
      `Dosha Imbalance: ${recommendations?.doshaImbalance || 'N/A'}`,
      `Severity: ${toTitle(recommendations?.severityLevel || 'moderate')}`,
      `Urgency: ${toTitle(recommendations?.urgency || 'medium')}`,
      `Recommended Specialty: ${recommendations?.recommendedSpecialty || 'N/A'}`,
      '',
      'Recommendations:',
      ...normalizedRecommendations.map((rec, idx) => {
        const parts = [
          `${idx + 1}. ${toTitle(rec.symptom)} (${toTitle(rec.severity)})`,
          rec.homeRemedy ? `Home: ${rec.homeRemedy}` : '',
          rec.herbalSupport ? `Herbal: ${rec.herbalSupport}` : '',
          rec.urgentAction ? `Action: ${rec.urgentAction}` : '',
          rec.ayurvedicExplanation ? `Reason: ${rec.ayurvedicExplanation}` : '',
        ].filter(Boolean);
        return parts.join(' | ');
      }),
      '',
      `Disclaimer: ${recommendations?.disclaimer || 'Consult a qualified doctor for final diagnosis.'}`,
    ];
    return lines.join('\n');
  };

  const createPrintableHtml = () => {
    const recommendationRows = normalizedRecommendations
      .map(
        (rec) => `
        <div class="item">
          <h3>${safeHtml(toTitle(rec.symptom))}</h3>
          <p><strong>Severity:</strong> ${safeHtml(toTitle(rec.severity))}</p>
          ${rec.homeRemedy ? `<p><strong>Home Remedy:</strong> ${safeHtml(rec.homeRemedy)}</p>` : ''}
          ${rec.herbalSupport ? `<p><strong>Herbal Support:</strong> ${safeHtml(rec.herbalSupport)}</p>` : ''}
          ${rec.urgentAction ? `<p><strong>Urgent Action:</strong> ${safeHtml(rec.urgentAction)}</p>` : ''}
          ${rec.ayurvedicExplanation ? `<p><strong>Ayurvedic Rationale:</strong> ${safeHtml(rec.ayurvedicExplanation)}</p>` : ''}
        </div>
      `
      )
      .join('');

    return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>AyuSetu Report ${safeHtml(String(reportId))}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          .header { border: 1px solid #dbe4ff; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-top: 10px; }
          .item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin-top: 10px; }
          .warn { border: 1px solid #fca5a5; background: #fff1f2; color: #b91c1c; border-radius: 10px; padding: 10px; margin: 12px 0; }
          h1,h2,h3,p { margin: 0 0 8px; }
          .muted { color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AyuSetu Clinical Summary Report</h1>
          <p class="muted"><strong>Report ID:</strong> ${safeHtml(String(reportId))}</p>
          <p class="muted"><strong>Date:</strong> ${safeHtml(reportDate)}</p>
          <div class="grid">
            <p><strong>Dosha:</strong> ${safeHtml(recommendations?.doshaImbalance || 'N/A')}</p>
            <p><strong>Severity:</strong> ${safeHtml(severityLabel)}</p>
            <p><strong>Urgency:</strong> ${safeHtml(urgencyLabel)}</p>
            <p><strong>Specialty:</strong> ${safeHtml(specialtyLabel || 'N/A')}</p>
          </div>
          ${
            hasHighSeverity
              ? '<div class="warn"><strong>Your symptom severity is high. While you can use these remedies for temporary relief, we strongly advise consulting a doctor immediately.</strong></div>'
              : ''
          }
        </div>
        <h2>Findings and Recommendations</h2>
        ${recommendationRows}
        <h2>Plan and Follow-up</h2>
        <ol>
          ${nextSteps.map((step) => `<li>${safeHtml(step)}</li>`).join('')}
        </ol>
        <p class="muted"><strong>Disclaimer:</strong> ${safeHtml(recommendations?.disclaimer || 'Consult a qualified doctor for final diagnosis.')}</p>
      </body>
    </html>
    `;
  };

  const handleDownloadHtml = () => {
    const html = createPrintableHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AyuSetu-Report-${reportId}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const html = createPrintableHtml();
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 44;
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;

    const addBlock = (text, size = 11, spacing = 16, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(String(text || ''), maxWidth);
      lines.forEach((line) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += spacing;
      });
    };

    addBlock('AyuSetu Clinical Summary Report', 18, 22, true);
    addBlock(`Report ID: ${reportId}`, 11, 15);
    addBlock(`Date: ${reportDate}`, 11, 15);
    addBlock(`Dosha Imbalance: ${recommendations?.doshaImbalance || 'N/A'}`, 11, 15);
    addBlock(`Severity: ${severityLabel}`, 11, 15);
    addBlock(`Urgency: ${urgencyLabel}`, 11, 15);
    addBlock(`Recommended Specialty: ${specialtyLabel || 'N/A'}`, 11, 18);

    if (hasHighSeverity) {
      addBlock(
        'Warning: Your symptom severity is high. Use home remedies only for temporary relief and consult a doctor immediately.',
        11,
        16,
        true
      );
    }

    addBlock('Findings and Recommendations', 14, 20, true);
    normalizedRecommendations.forEach((rec, idx) => {
      addBlock(`${idx + 1}. ${toTitle(rec.symptom)} (${toTitle(rec.severity)})`, 11, 16, true);
      if (rec.homeRemedy) addBlock(`Home Remedy: ${rec.homeRemedy}`);
      if (rec.herbalSupport) addBlock(`Herbal Support: ${rec.herbalSupport}`);
      if (rec.urgentAction) addBlock(`Urgent Action: ${rec.urgentAction}`);
      if (rec.ayurvedicExplanation) addBlock(`Ayurvedic Rationale: ${rec.ayurvedicExplanation}`);
      y += 6;
    });

    addBlock('Plan and Follow-up', 14, 20, true);
    nextSteps.forEach((step, index) => addBlock(`${index + 1}. ${step}`));

    addBlock(`Disclaimer: ${recommendations?.disclaimer || 'Consult a qualified doctor for final diagnosis.'}`);
    doc.save(`AyuSetu-Report-${reportId}.pdf`);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopyStatus('Summary copied');
    } catch (error) {
      setCopyStatus('Copy failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-blue-100 animate-pulse" />
          <div className="absolute inset-0 border-4 border-blue-500/30 border-t-blue-700 rounded-full animate-spin" />
        </div>
        <h2 className="mt-8 text-2xl font-bold text-slate-800 font-serif">Preparing your detailed report...</h2>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="bg-white p-10 rounded-[2rem] shadow-xl text-center max-w-md border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-800 mb-4 font-serif">No report found</h1>
          <Link
            to="/symptoms"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all"
          >
            Start New Assessment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-6 bg-[#f3f6fc] font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#c8d2e6_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">AyuSetu Clinical Summary</p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif mt-2">Patient Symptom Assessment Report</h1>
              <p className="text-slate-600 mt-2 text-sm">
                Generated on {reportDate} | Report ID {reportId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleDownloadPdf} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Download PDF</button>
              <button onClick={handleDownloadHtml} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Download HTML</button>
              <button onClick={handlePrint} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Print</button>
              <button onClick={handleCopySummary} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Copy</button>
              <button onClick={() => setShowDetailedModal(true)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Detailed</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to="/dashboard" className="text-blue-700 text-sm font-semibold hover:underline">Back to Dashboard</Link>
            {copyStatus ? <span className="text-sm font-semibold text-emerald-600">{copyStatus}</span> : null}
          </div>
        </header>

        <section className="grid lg:grid-cols-3 gap-4 mb-6">
          <article className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Clinical Overview</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <p className="text-slate-600"><span className="font-semibold text-slate-800">Dosha imbalance:</span> {recommendations?.doshaImbalance || 'N/A'}</p>
              <p className="text-slate-600"><span className="font-semibold text-slate-800">Recommended specialty:</span> {specialtyLabel}</p>
              <p className="text-slate-600"><span className="font-semibold text-slate-800">Overall severity:</span> {severityLabel}</p>
              <p className="text-slate-600"><span className="font-semibold text-slate-800">Urgency level:</span> {urgencyLabel}</p>
              <p className="text-slate-600 sm:col-span-2">
                <span className="font-semibold text-slate-800">Chief concerns:</span>{' '}
                {chiefConcerns.length ? chiefConcerns.join(', ') : 'Not captured'}
              </p>
            </div>
          </article>
          <article className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Triage Status</h2>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Severity</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                hasHighSeverity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {severityLabel}
              </span>
              <p className="text-sm text-slate-600 mt-1">Urgency: <span className="font-semibold text-slate-800">{urgencyLabel}</span></p>
              {hasHighSeverity ? (
                <p className="text-sm text-rose-700 font-medium">
                  Immediate specialist review is recommended.
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Continue supportive care and monitor progress.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 font-serif mb-4">Findings and Recommendations</h2>
          <div className="space-y-4">
            {normalizedRecommendations.map((rec, index) => (
              <article key={`${rec.symptom}-${index}`} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-900">{index + 1}. {toTitle(rec.symptom)}</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                    {toTitle(rec.severity)}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <p className="text-slate-700"><span className="font-semibold">Home remedy:</span> {rec.homeRemedy || 'Not specified'}</p>
                  <p className="text-slate-700"><span className="font-semibold">Herbal support:</span> {rec.herbalSupport || 'Not specified'}</p>
                  <p className="text-slate-700 md:col-span-2"><span className="font-semibold">Ayurvedic rationale:</span> {rec.ayurvedicExplanation || 'Not specified'}</p>
                  {rec.urgentAction ? (
                    <p className="text-rose-700 md:col-span-2"><span className="font-semibold">Urgent action:</span> {rec.urgentAction}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 font-serif mb-4">Plan and Follow-up</h2>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700 text-sm">
            {nextSteps.map((step, idx) => (
              <li key={`step-${idx}`}>{step}</li>
            ))}
          </ol>
          <div className="mt-5">
            <button
              onClick={handleConsultSpecialist}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
            >
              Find Specialists
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Clinical disclaimer:</span>{' '}
            {recommendations?.disclaimer || 'Consult a qualified doctor for final diagnosis and treatment decisions.'}
          </p>
        </section>
      </div>

      {showDetailedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDetailedModal(false)} />
          <div className="relative bg-white w-full max-w-4xl max-h-[88vh] overflow-auto rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 font-serif">Detailed Medical Report</h3>
                <p className="text-slate-500 text-sm">Report ID {reportId} | Generated {reportDate}</p>
              </div>
              <button
                onClick={() => setShowDetailedModal(false)}
                className="w-9 h-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                X
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dosha Imbalance</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{recommendations?.doshaImbalance || 'N/A'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Urgency</p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {toTitle(recommendations?.urgency || recommendations?.severityLevel || 'medium')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {normalizedRecommendations.map((rec, index) => (
                <div key={`${rec.symptom}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-900 mb-2">
                    {index + 1}. {toTitle(rec.symptom)} ({toTitle(rec.severity)})
                  </p>
                  {rec.homeRemedy ? <p className="text-sm text-slate-700 mb-1"><strong>Home Remedy:</strong> {rec.homeRemedy}</p> : null}
                  {rec.herbalSupport ? <p className="text-sm text-slate-700 mb-1"><strong>Herbal Support:</strong> {rec.herbalSupport}</p> : null}
                  {rec.urgentAction ? <p className="text-sm text-slate-700 mb-1"><strong>Urgent Action:</strong> {rec.urgentAction}</p> : null}
                  {rec.ayurvedicExplanation ? (
                    <p className="text-sm text-slate-700"><strong>Ayurvedic Explanation:</strong> {rec.ayurvedicExplanation}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Print / Save
              </button>
              <button
                onClick={handleDownloadHtml}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Download HTML
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Results;
