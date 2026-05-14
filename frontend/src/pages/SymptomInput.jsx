import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { symptomsAPI } from '../utils/api';

const SymptomInput = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ 
    symptoms: [], 
    lifestyle: '',
    age: '',
    gender: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  const symptomsList = [
    { id: 'headache', label: 'Headache', icon: '⚡' },
    { id: 'indigestion', label: 'Indigestion', icon: '🔥' },
    { id: 'joint_pain', label: 'Joint Pain', icon: '🦴' },
    { id: 'cold_cough', label: 'Cold / Cough', icon: '🤧' },
    { id: 'fatigue', label: 'Fatigue', icon: '🔋' },
    { id: 'anxiety', label: 'Anxiety', icon: '😰' },
    { id: 'insomnia', label: 'Insomnia', icon: '🌙' },
    { id: 'skin_rash', label: 'Skin Rash', icon: '🌵' }
  ];

  const isSelected = (id) => formData.symptoms.find(s => s.name === id);

  const toggleSymptom = (symptomId) => {
    if (isSelected(symptomId)) {
      setFormData(prev => ({
        ...prev,
        symptoms: prev.symptoms.filter(s => s.name !== symptomId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, { name: symptomId, severity: 1 }]
      }));
    }
  };

  const updateSymptomSeverity = (symptomId, severity) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.map(s => 
        s.name === symptomId ? { ...s, severity } : s
      )
    }));
  };

  // ===== SUBMIT LOGIC =====
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
    
    // 1. Analyze Primary Symptom to determine Specialist & Dosha
    const primarySymptom = formData.symptoms[0]?.name || 'general';
    let recommendedSpecialty = 'Kayachikitsa'; // Default
    let doshaPrediction = 'Vata/Pitta'; 

    // Simple Logic Map for Demo
    if (['joint_pain', 'cold_cough'].includes(primarySymptom)) {
        recommendedSpecialty = 'Panchakarma'; 
        doshaPrediction = 'Vata';
    } else if (['indigestion', 'fatigue'].includes(primarySymptom)) {
        recommendedSpecialty = 'Diet & Nutrition';
        doshaPrediction = 'Pitta';
    } else if (['anxiety', 'insomnia', 'headache'].includes(primarySymptom)) {
        recommendedSpecialty = 'Nadi Pariksha'; 
        doshaPrediction = 'Vata';
    } else if (['skin_rash'].includes(primarySymptom)) {
        recommendedSpecialty = 'Kayachikitsa';
        doshaPrediction = 'Pitta';
    }

    // 2. Generate Detailed Recommendations (So the report is useful when viewed later)
    const detailedRecommendations = formData.symptoms.map(s => {
       let remedies = { home: "Rest & Hydration", med: "Consult Specialist" };
       
       if(s.name === 'headache') remedies = { home: "Ginger tea, Dark room rest", med: "Brahmi Vati" };
       if(s.name === 'indigestion') remedies = { home: "Ajwain water", med: "Triphala Churna" };
       if(s.name === 'joint_pain') remedies = { home: "Warm Sesame Oil Massage", med: "Maharasnadi Kwath" };
       if(s.name === 'cold_cough') remedies = { home: "Turmeric Milk (Haldi Doodh)", med: "Sitopaladi Churna" };
       if(s.name === 'anxiety') remedies = { home: "Deep Breathing, Meditation", med: "Ashwagandha" };
       if(s.name === 'insomnia') remedies = { home: "Nutmeg milk before bed", med: "Jatamansi" };
       if(s.name === 'skin_rash') remedies = { home: "Aloe Vera Gel", med: "Neem Capsules" };
       
       return {
          symptom: s.name,
          ...remedies,
          explanation: `Balances the ${doshaPrediction} aggravation.`
       };
    });

    // 3. Create the Full Report Object
    const medicalReport = {
        id: Date.now(),
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        symptoms: formData.symptoms,
        doshaImbalance: doshaPrediction,
        severityLevel: formData.symptoms.some(s => s.severity === 3) ? 'severe' : 'moderate',
        recommendedSpecialty: recommendedSpecialty,
        recommendations: detailedRecommendations, 
        disclaimer: "Consult a specialist before starting any treatment.",
        status: 'Unreviewed' 
    };

    try {
      const payload = {
        symptoms: formData.symptoms,
        lifestyle: [
          formData.lifestyle,
          formData.age ? `Age: ${formData.age}` : '',
          formData.gender ? `Gender: ${formData.gender}` : '',
        ].filter(Boolean).join(' | '),
        language: 'en',
        inputMode: 'text',
      };

      const { data } = await symptomsAPI.submit(payload);

      const reportData = {
        ...medicalReport,
        id: data?.assessmentId || medicalReport.id,
        doshaImbalance: data?.doshaImbalance || medicalReport.doshaImbalance,
        severityLevel: data?.severityLevel || medicalReport.severityLevel,
        recommendedSpecialty: data?.recommendedSpecialty || medicalReport.recommendedSpecialty,
        recommendations: data?.recommendations || medicalReport.recommendations,
        disclaimer: data?.disclaimer || medicalReport.disclaimer,
        urgency: data?.urgency,
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
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl rounded-[2rem] overflow-hidden">
          
          {/* Header */}
          <div className="bg-white border-b border-slate-100 p-8 pb-0">
            <h1 className="text-3xl font-bold text-slate-800 text-center font-serif mb-2">
              Health Assessment
            </h1>
            <p className="text-slate-500 text-center mb-8 text-sm">
              Please answer accurately for the best Ayurvedic analysis.
            </p>

            {/* Stepper */}
            <div className="flex items-center justify-between relative px-4 mb-8 mt-6">
               <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
               <div 
                  className="absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500"
                  style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
               ></div>

               {[1, 2, 3].map((s) => (
                  <div key={s} className={`flex flex-col items-center gap-2 bg-white px-2 ${step >= s ? 'text-blue-600' : 'text-slate-400'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                        step >= s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'
                     }`}>
                        {step > s ? '✓' : s}
                     </div>
                  </div>
               ))}
            </div>
          </div>

          <div className="p-8">
            {/* STEP 1: SYMPTOMS */}
            {step === 1 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   What are you experiencing?
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {symptomsList.map(symptom => {
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
                        <span className="text-3xl">{symptom.icon}</span>
                        <span className={`font-medium text-sm ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                           {symptom.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: SEVERITY */}
            {step === 2 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   How severe is it?
                </h3>
                <div className="space-y-4">
                  {formData.symptoms.map(symptom => {
                     const label = symptomsList.find(s => s.id === symptom.name)?.label || symptom.name;
                     return (
                        <div key={symptom.name} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex justify-between items-center">
                           <span className="font-bold text-slate-700 text-lg flex items-center gap-2">
                              {symptomsList.find(s => s.id === symptom.name)?.icon} {label}
                           </span>
                           
                           <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                              {[1, 2, 3].map(level => (
                                 <button
                                    key={level}
                                    onClick={() => updateSymptomSeverity(symptom.name, level)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                       symptom.severity === level 
                                       ? level === 1 ? 'bg-emerald-100 text-emerald-700' : level === 2 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                       : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                 >
                                    {level === 1 ? 'Mild' : level === 2 ? 'Mod' : 'Severe'}
                                 </button>
                              ))}
                           </div>
                        </div>
                     )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS */}
            {step === 3 && (
              <div className="animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   Personal Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                   <input
                     type="number"
                     placeholder="Age"
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                     value={formData.age}
                     onChange={(e) => setFormData({...formData, age: e.target.value})}
                   />
                   <select
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                     value={formData.gender}
                     onChange={(e) => setFormData({...formData, gender: e.target.value})}
                   >
                     <option value="">Select Gender</option>
                     <option value="male">Male</option>
                     <option value="female">Female</option>
                   </select>
                   <textarea
                     placeholder="Lifestyle factors (diet, sleep, stress)..."
                     className="md:col-span-2 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none h-32 resize-none"
                     value={formData.lifestyle}
                     onChange={(e) => setFormData({...formData, lifestyle: e.target.value})}
                   />
                </div>
              </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex flex-col-reverse sm:flex-row gap-4 mt-10 pt-8 border-t border-slate-100">
              {step > 1 ? (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="px-8 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Back
                </button>
              ) : (
                 <div className="hidden sm:block"></div>
              )}
              
              <button 
                onClick={step === 3 ? submitSymptoms : () => setStep(step + 1)}
                disabled={(step === 1 && formData.symptoms.length === 0) || isLoading}
                className="flex-1 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <>
                     <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
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