import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { symptomsAPI } from '../utils/api';

const symptomCatalog = [
  { id: 'headache', label: 'Headache', icon: '⚡', category: 'Pain', tags: ['migraine', 'head pain'] },
  { id: 'joint_pain', label: 'Joint Pain', icon: '🦴', category: 'Pain', tags: ['knee pain', 'stiffness'] },
  { id: 'back_pain', label: 'Back Pain', icon: '🧍', category: 'Pain', tags: ['lower back', 'spine'] },
  { id: 'indigestion', label: 'Indigestion', icon: '🔥', category: 'Digestive', tags: ['acidity', 'gas'] },
  { id: 'stomach_pain', label: 'Stomach Pain', icon: '🤢', category: 'Digestive', tags: ['abdomen', 'belly pain'] },
  { id: 'nausea', label: 'Nausea', icon: '🤮', category: 'Digestive', tags: ['queasy', 'vomit feeling'] },
  { id: 'constipation', label: 'Constipation', icon: '🚫', category: 'Digestive', tags: ['hard stool'] },
  { id: 'diarrhea', label: 'Loose Motion', icon: '💧', category: 'Digestive', tags: ['diarrhea', 'watery stool'] },
  { id: 'cold_cough', label: 'Cold / Cough', icon: '🤧', category: 'Respiratory', tags: ['sneeze', 'congestion'] },
  { id: 'sore_throat', label: 'Sore Throat', icon: '🗣️', category: 'Respiratory', tags: ['throat pain'] },
  { id: 'fever', label: 'Fever', icon: '🌡️', category: 'General', tags: ['temperature', 'chills'] },
  { id: 'fatigue', label: 'Fatigue', icon: '🔋', category: 'Energy', tags: ['weakness', 'tired'] },
  { id: 'anxiety', label: 'Anxiety', icon: '😰', category: 'Mind', tags: ['stress', 'panic'] },
  { id: 'insomnia', label: 'Insomnia', icon: '🌙', category: 'Sleep', tags: ['sleepless'] },
  { id: 'skin_rash', label: 'Skin Rash', icon: '🌵', category: 'Skin', tags: ['itching', 'redness'] },
];

const normalizeSymptomText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');

const prettyLabelFromName = (name = '') =>
  String(name || '')
    .replace(/^custom_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const SymptomInput = () => {
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [customIssue, setCustomIssue] = useState('');
  const [formData, setFormData] = useState({
    symptoms: [],
    lifestyle: '',
    age: '',
    gender: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  const categories = useMemo(() => ['All', ...new Set(symptomCatalog.map((item) => item.category))], []);

  const symptomMeta = useMemo(() => {
    const map = new Map();
    symptomCatalog.forEach((item) => map.set(item.id, item));
    return map;
  }, []);

  const filteredSymptoms = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return symptomCatalog.filter((item) => {
      const categoryMatch = activeCategory === 'All' || item.category === activeCategory;
      if (!categoryMatch) return false;
      if (!query) return true;
      return [item.label, item.id, ...(item.tags || [])].some((token) => token.toLowerCase().includes(query));
    });
  }, [activeCategory, searchText]);

  const isSelected = (id) => formData.symptoms.some((symptom) => symptom.name === id);

  const toggleSymptom = (symptomId) => {
    if (isSelected(symptomId)) {
      setFormData((prev) => ({
        ...prev,
        symptoms: prev.symptoms.filter((symptom) => symptom.name !== symptomId),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      symptoms: [...prev.symptoms, { name: symptomId, severity: 1, durationDays: 0, notes: '' }],
    }));
  };

  const addCustomIssue = () => {
    const normalized = normalizeSymptomText(customIssue);
    if (normalized.length < 3) return;
    const symptomId = `custom_${normalized}`;
    if (!isSelected(symptomId)) {
      setFormData((prev) => ({
        ...prev,
        symptoms: [...prev.symptoms, { name: symptomId, severity: 1, durationDays: 0, notes: '' }],
      }));
    }
    setCustomIssue('');
  };

  const updateSymptomSeverity = (symptomId, severity) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.map((symptom) =>
        symptom.name === symptomId ? { ...symptom, severity } : symptom
      ),
    }));
  };

  const updateSymptomDuration = (symptomId, durationDays) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.map((symptom) =>
        symptom.name === symptomId ? { ...symptom, durationDays } : symptom
      ),
    }));
  };

  const updateSymptomNotes = (symptomId, notes) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.map((symptom) =>
        symptom.name === symptomId ? { ...symptom, notes } : symptom
      ),
    }));
  };

  const submitSymptoms = async () => {
    if (!user) {
      navigate('/login', {
        state: {
          from: '/symptoms',
          message: 'Please sign in to submit symptoms and view personalized recommendations.',
        },
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        symptoms: formData.symptoms,
        lifestyle: [
          formData.lifestyle,
          formData.age ? `Age: ${formData.age}` : '',
          formData.gender ? `Gender: ${formData.gender}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        language: 'en',
        inputMode: 'text',
      };

      const { data } = await symptomsAPI.submit(payload);

      const reportData = {
        id: data?.assessmentId || Date.now(),
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        symptoms: data?.normalizedSymptoms || formData.symptoms,
        doshaImbalance: data?.doshaImbalance || 'General Imbalance',
        severityLevel: data?.severityLevel || 'moderate',
        urgency: data?.urgency || 'MEDIUM',
        recommendedSpecialty: data?.recommendedSpecialty || 'Kayachikitsa',
        recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
        disclaimer: data?.disclaimer || 'Consult a qualified clinician for treatment decisions.',
        status: 'Unreviewed',
        riskScore: data?.riskScore,
        confidenceScore: data?.confidenceScore,
        likelyCauses: data?.likelyCauses || [],
        globalAdvice: data?.globalAdvice || [],
        redFlags: data?.redFlags || [],
        requiresImmediateCare: Boolean(data?.requiresImmediateCare),
      };

      const existingHistory = JSON.parse(localStorage.getItem('ayur_history') || '[]');
      localStorage.setItem('ayur_history', JSON.stringify([reportData, ...existingHistory]));
      localStorage.setItem('last_report', JSON.stringify(reportData));

      navigate('/results', { state: { reportData } });
    } catch (error) {
      const apiMessage = error?.response?.data?.message || 'Could not submit symptoms. Please try again.';
      alert(apiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 px-6 font-sans text-slate-900 bg-slate-50 selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl rounded-[2rem] overflow-hidden">
          <div className="bg-white border-b border-slate-100 p-8 pb-0">
            <h1 className="text-3xl font-bold text-slate-800 text-center font-serif mb-2">Health Assessment</h1>
            <p className="text-slate-500 text-center mb-8 text-sm">Please answer accurately for the best Ayurvedic analysis.</p>

            <div className="flex items-center justify-between relative px-4 mb-8 mt-6">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
              <div
                className="absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500"
                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
              />
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={`flex flex-col items-center gap-2 bg-white px-2 ${step >= item ? 'text-blue-600' : 'text-slate-400'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                      step >= item ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'
                    }`}
                  >
                    {step > item ? '✓' : item}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8">
            {step === 1 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-4">What are you experiencing?</h3>

                <div className="mb-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        activeCategory === category
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search symptom (e.g. fever, throat, pain)"
                  className="w-full mb-4 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {filteredSymptoms.map((symptom) => {
                    const active = isSelected(symptom.id);
                    return (
                      <div
                        key={symptom.id}
                        onClick={() => toggleSymptom(symptom.id)}
                        className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col items-center justify-center gap-3 text-center aspect-square ${
                          active
                            ? 'bg-blue-50 border-blue-500 shadow-md shadow-blue-500/10 transform scale-105'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-4xl leading-none">{symptom.icon}</span>
                        <span className={`font-medium text-sm ${active ? 'text-blue-700' : 'text-slate-600'}`}>{symptom.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-700 font-semibold mb-2">Other issue not listed?</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customIssue}
                      onChange={(event) => setCustomIssue(event.target.value)}
                      placeholder="Type your symptom (e.g. eye pain, earache)"
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomIssue}
                      className="px-4 py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-6">How severe is it?</h3>
                <div className="space-y-4">
                  {formData.symptoms.map((symptom) => {
                    const meta = symptomMeta.get(symptom.name);
                    const label = meta?.label || prettyLabelFromName(symptom.name);
                    const icon = meta?.icon || '🩺';

                    return (
                      <div key={symptom.name} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex justify-between items-center">
                        <div className="w-full">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <span className="font-bold text-slate-700 text-lg flex items-center gap-2">
                              <span className="text-2xl leading-none">{icon}</span>
                              {label}
                            </span>

                            <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                              {[1, 2, 3].map((level) => (
                                <button
                                  key={level}
                                  onClick={() => updateSymptomSeverity(symptom.name, level)}
                                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    symptom.severity === level
                                      ? level === 1
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : level === 2
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-rose-100 text-rose-700'
                                      : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {level === 1 ? 'Mild' : level === 2 ? 'Mod' : 'Severe'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 grid md:grid-cols-2 gap-3">
                            <select
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                              value={symptom.durationDays || 0}
                              onChange={(event) => updateSymptomDuration(symptom.name, Number(event.target.value || 0))}
                            >
                              <option value={0}>Duration: Not specified</option>
                              <option value={1}>Duration: 1-3 days</option>
                              <option value={7}>Duration: 4-14 days</option>
                              <option value={21}>Duration: 15-30 days</option>
                              <option value={45}>Duration: More than 30 days</option>
                            </select>

                            <input
                              type="text"
                              maxLength={120}
                              placeholder="Optional note (e.g. worse at night)"
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                              value={symptom.notes || ''}
                              onChange={(event) => updateSymptomNotes(symptom.name, event.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Personal Details</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <input
                    type="number"
                    placeholder="Age"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                    value={formData.age}
                    onChange={(event) => setFormData({ ...formData, age: event.target.value })}
                  />
                  <select
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                    value={formData.gender}
                    onChange={(event) => setFormData({ ...formData, gender: event.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  <textarea
                    placeholder="Lifestyle factors (diet, sleep, stress)..."
                    className="md:col-span-2 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none h-32 resize-none"
                    value={formData.lifestyle}
                    onChange={(event) => setFormData({ ...formData, lifestyle: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-4 mt-10 pt-8 border-t border-slate-100">
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-8 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Back
                </button>
              ) : (
                <div className="hidden sm:block" />
              )}

              <button
                onClick={step === 3 ? submitSymptoms : () => setStep(step + 1)}
                disabled={(step === 1 && formData.symptoms.length === 0) || isLoading}
                className="flex-1 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  step === 3 ? 'Find Specialists' : 'Next Step'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomInput;
