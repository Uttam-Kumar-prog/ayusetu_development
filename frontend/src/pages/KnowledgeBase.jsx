import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const KnowledgeBase = () => {
  // Data for the 8 Symptoms
  const symptomData = [
    {
      id: 'headache',
      title: 'Headache',
      icon: '⚡',
      dosha: 'Vata / Pitta',
      color: 'blue', // Vata dominance usually
      description: 'Often caused by dehydration, stress, or tension. In Ayurveda, sharp pain is Vata, burning is Pitta.',
      remedies: ['Ginger tea', 'Warm oil massage on scalp', 'Rest in a dark room']
    },
    {
      id: 'indigestion',
      title: 'Indigestion',
      icon: '🔥',
      dosha: 'Pitta / Kapha',
      color: 'amber', // Pitta (Fire)
      description: 'Weak digestive fire (Agni). Can manifest as acidity (Pitta) or heaviness/bloating (Kapha/Vata).',
      remedies: ['Cumin, Coriander, Fennel tea', 'Triphala powder', 'Avoid cold drinks']
    },
    {
      id: 'joint_pain',
      title: 'Joint Pain',
      icon: '🦴',
      dosha: 'Vata',
      color: 'blue', // Vata governs movement
      description: 'Accumulation of toxins (Ama) in joints or excess air causing dryness and cracking sounds.',
      remedies: ['Sesame oil massage', 'Turmeric milk (Golden Latte)', 'Castor oil packs']
    },
    {
      id: 'cold_cough',
      title: 'Cold / Cough',
      icon: '🤧',
      dosha: 'Kapha',
      color: 'emerald', // Kapha (Mucus/Earth)
      description: 'Excess mucus accumulation in the respiratory tract. Often worse in spring and winter.',
      remedies: ['Honey & Black Pepper', 'Steam inhalation with Eucalyptus', 'Tulsi tea']
    },
    {
      id: 'fatigue',
      title: 'Fatigue',
      icon: '🔋',
      dosha: 'Kapha / Vata',
      color: 'emerald', // Heaviness
      description: 'Low Ojas (vitality). Can range from mental exhaustion (Vata) to physical lethargy (Kapha).',
      remedies: ['Ashwagandha supplement', 'Warm cooked meals', 'Early bedtime']
    },
    {
      id: 'anxiety',
      title: 'Anxiety',
      icon: '😰',
      dosha: 'Vata',
      color: 'blue', // Air/Movement of mind
      description: 'Excess movement in the mind. Characterized by racing thoughts, fear, and restlessness.',
      remedies: ['Deep breathing (Pranayama)', 'Brahmi tea', 'Grounding foods (root veg)']
    },
    {
      id: 'insomnia',
      title: 'Insomnia',
      icon: '🌙',
      dosha: 'Vata',
      color: 'blue', // Restlessness
      description: 'Inability to calm the mind or body before sleep. Often linked to high Vata or stress.',
      remedies: ['Warm milk with Nutmeg', 'Foot massage before bed', 'No screens 1h before sleep']
    },
    {
      id: 'skin_rash',
      title: 'Skin Rash',
      icon: '🌵',
      dosha: 'Pitta',
      color: 'amber', // Heat/Redness
      description: 'Excess heat in the blood tissue. Manifests as redness, itching, or inflammation.',
      remedies: ['Aloe Vera gel', 'Neem water bath', 'Avoid spicy/sour foods']
    }
  ];

  return (
    <div className="min-h-screen pt-28 pb-20 px-6 bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* ===== BACKGROUND GRAPHICS ===== */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
         <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-3xl opacity-50" />
         <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* ===== HERO HEADER ===== */}
        <div className="text-center mb-16">
           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm mb-6">
              <span className="text-2xl">📚</span>
              <span className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Symptom Library</span>
           </div>
           
           <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">
             Understanding Your <br className="hidden md:block"/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
               Body Signals
             </span>
           </h1>
           
           <p className="max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed mb-10">
             Every symptom is your body's way of communicating a Dosha imbalance. 
             Explore the Ayurvedic perspective on common health issues.
           </p>

           {/* Search Bar */}
           <div className="max-w-xl mx-auto relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search symptoms (e.g. Headache, Anxiety)..." 
                className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800"
              />
           </div>
        </div>

        {/* ===== SYMPTOM GRID (4 Columns for 8 Items) ===== */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
           {symptomData.map((item) => (
             <div 
                key={item.id}
                className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2rem] p-6 flex flex-col hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 group h-full"
             >
                {/* Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                      item.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                      item.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                      'bg-emerald-50 text-emerald-600'
                   }`}>
                      {item.icon}
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{item.title}</h3>
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                         item.color === 'blue' ? 'text-blue-500' : 
                         item.color === 'amber' ? 'text-amber-500' : 
                         'text-emerald-500'
                      }`}>
                         {item.dosha}
                      </span>
                   </div>
                </div>

                {/* Description */}
                <p className="text-slate-600 text-sm leading-relaxed mb-6 border-b border-slate-100 pb-4 flex-grow">
                   {item.description}
                </p>

                {/* Remedies Section */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Quick Remedies
                   </h4>
                   <ul className="space-y-1.5">
                      {item.remedies.map((remedy, i) => (
                         <li key={i} className="text-slate-700 text-xs font-medium flex items-start gap-1.5">
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                               item.color === 'blue' ? 'bg-blue-400' : 
                               item.color === 'amber' ? 'bg-amber-400' : 
                               'bg-emerald-400'
                            }`}></span> 
                            {remedy}
                         </li>
                      ))}
                   </ul>
                </div>

             </div>
           ))}
        </div>

        {/* ===== CTA FOOTER ===== */}
        <div className="bg-slate-900 rounded-[2.5rem] p-12 text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-slate-800 rounded-full blur-3xl opacity-50"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-900 rounded-full blur-3xl opacity-50"></div>

           <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white font-serif mb-4">Experiencing these symptoms?</h2>
              <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                 Get a full analysis of your health profile and a personalized treatment plan in less than 2 minutes.
              </p>
              <Link 
                 to="/symptoms" 
                 className="inline-block px-10 py-4 bg-white text-slate-900 font-bold rounded-xl shadow-xl hover:bg-blue-50 hover:scale-105 transition-all"
              >
                 Start Assessment
              </Link>
           </div>
        </div>

      </div>
    </div>
  );
};

export default KnowledgeBase;