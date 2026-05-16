const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, '../config/rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

const severityKey = (level) => {
  if (level <= 1) return 'mild';
  if (level === 2) return 'moderate';
  return 'severe';
};

const clampSeverity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(3, Math.round(parsed)));
};

const clampDuration = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3650, Math.round(parsed)));
};

const normalizeToken = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

const symptomAliases = {
  headache: ['headache', 'migraine', 'head pain'],
  indigestion: ['indigestion', 'acidity', 'gas', 'bloating'],
  joint_pain: ['joint pain', 'knee pain', 'stiffness'],
  cold_cough: ['cold', 'cough', 'congestion', 'sneeze'],
  fatigue: ['fatigue', 'tired', 'low energy', 'weakness'],
  anxiety: ['anxiety', 'stress', 'restless', 'panic'],
  insomnia: ['insomnia', 'sleepless', 'sleep problem', 'cannot sleep'],
  skin_rash: ['skin rash', 'itching', 'rash', 'redness'],
  fever: ['fever', 'temperature', 'high temperature', 'chills'],
  stomach_pain: ['stomach pain', 'abdominal pain', 'abdomen pain', 'belly pain'],
  back_pain: ['back pain', 'lower back pain', 'upper back pain', 'spine pain'],
  nausea: ['nausea', 'queasy', 'vomit feeling', 'nauseous'],
  constipation: ['constipation', 'hard stool', 'infrequent stool', 'no motion'],
  diarrhea: ['diarrhea', 'loose motion', 'loose stools', 'watery stool'],
  sore_throat: ['sore throat', 'throat pain', 'throat irritation', 'scratchy throat'],
};

const directAliasMap = new Map(
  Object.entries(symptomAliases).flatMap(([canonical, aliases]) => {
    return [canonical, ...aliases].map((alias) => [normalizeToken(alias), canonical]);
  })
);

const doshaSpecialtyMap = {
  Vata: 'Nadi Pariksha',
  Pitta: 'Diet & Nutrition',
  Kapha: 'Panchakarma',
  'Vata/Pitta': 'Nadi Pariksha',
  'Pitta/Vata': 'Nadi Pariksha',
  'Kapha/Pitta': 'Kayachikitsa',
  'Pitta/Kapha': 'Kayachikitsa',
  'Vata/Kapha': 'Diet & Nutrition',
  'Kapha/Vata': 'Diet & Nutrition',
};

const severityWeight = {
  1: 1.0,
  2: 1.75,
  3: 2.6,
};

const lifestyleRiskSignals = [
  { id: 'high_stress', regex: /(high stress|chronic stress|overwork|burnout)/i, boost: 0.7 },
  { id: 'poor_sleep', regex: /(poor sleep|sleep deprived|night shift|late sleep)/i, boost: 0.6 },
  { id: 'irregular_meals', regex: /(irregular meals|skip meals|late meals|junk food)/i, boost: 0.5 },
  { id: 'dehydration', regex: /(dehydration|not enough water|dry mouth)/i, boost: 0.4 },
  { id: 'sedentary', regex: /(sedentary|no exercise|sitting all day)/i, boost: 0.4 },
  { id: 'tobacco', regex: /(smoking|tobacco|vape)/i, boost: 0.7 },
  { id: 'alcohol_excess', regex: /(alcohol daily|heavy drinking|binge)/i, boost: 0.6 },
];

const criticalRedFlags = [
  { code: 'CHEST_PAIN', regex: /\bchest pain\b/i, message: 'Chest pain can be serious.' },
  { code: 'BREATHLESSNESS', regex: /(shortness of breath|breathlessness|difficulty breathing)/i, message: 'Breathing difficulty needs urgent care.' },
  { code: 'NEURO_DEFICIT', regex: /(one sided weakness|slurred speech|facial droop|confusion)/i, message: 'Possible neurological emergency signs.' },
  { code: 'SEVERE_BLEEDING', regex: /(vomiting blood|blood in stool|severe bleeding)/i, message: 'Possible severe bleeding signs.' },
  { code: 'HIGH_FEVER', regex: /(high fever|104|103f|40c)/i, message: 'High fever needs urgent medical review.' },
  { code: 'SEIZURE_OR_FAINT', regex: /(seizure|fits|fainted|unconscious)/i, message: 'Loss of consciousness or seizures require emergency care.' },
  { code: 'SELF_HARM', regex: /(suicidal|self harm|want to die)/i, message: 'Immediate mental health emergency support is needed.' },
];

const likelyCauseHints = {
  headache: ['stress load', 'sleep disruption', 'dehydration', 'pitta aggravation'],
  indigestion: ['irregular meals', 'heavy/oily food', 'low digestive fire'],
  joint_pain: ['vata aggravation', 'inflammation', 'poor posture or strain'],
  cold_cough: ['kapha accumulation', 'weather exposure', 'low immunity'],
  fatigue: ['sleep debt', 'nutritional imbalance', 'chronic stress'],
  anxiety: ['high stress load', 'vata imbalance', 'poor sleep'],
  insomnia: ['mental overactivity', 'late-night routine', 'stress and anxiety'],
  skin_rash: ['allergic trigger', 'pitta aggravation', 'environmental irritants'],
  fever: ['acute infection trigger', 'immune activation', 'pitta aggravation'],
  stomach_pain: ['indigestion', 'gut irritation', 'food intolerance'],
  back_pain: ['muscle strain', 'poor posture', 'vata aggravation'],
  nausea: ['gastric upset', 'food intolerance', 'motion sensitivity'],
  constipation: ['low fiber intake', 'dehydration', 'vata dryness'],
  diarrhea: ['gut infection', 'food contamination', 'pitta-kapha imbalance'],
  sore_throat: ['respiratory irritation', 'viral trigger', 'kapha congestion'],
};

const toCanonicalSymptom = (name = '') => {
  const normalized = normalizeToken(name);
  if (!normalized) return '';
  if (directAliasMap.has(normalized)) return directAliasMap.get(normalized);
  return normalized;
};

const inferSeverityFromMessage = (loweredMessage) => {
  if (/(severe|high|intense|unbearable|extreme)/.test(loweredMessage)) return 3;
  if (/(moderate|medium)/.test(loweredMessage)) return 2;
  return 1;
};

const inferSymptomsFromMessage = (message = '') => {
  const lowered = String(message || '').toLowerCase();
  return Object.entries(symptomAliases)
    .filter(([, aliases]) => aliases.some((alias) => lowered.includes(alias)))
    .map(([canonical]) => canonical);
};

const parseAgeFromLifestyle = (lifestyle = '') => {
  const match = String(lifestyle).match(/age\s*:\s*(\d{1,3})/i);
  if (!match?.[1]) return null;
  const age = Number(match[1]);
  if (!Number.isFinite(age)) return null;
  return Math.max(0, Math.min(120, age));
};

const getDurationMultiplier = (durationDays) => {
  if (durationDays <= 3) return 1;
  if (durationDays <= 14) return 1.2;
  if (durationDays <= 30) return 1.35;
  return 1.5;
};

const detectLifestyleRisk = (lifestyle = '') => {
  const text = String(lifestyle || '');
  const matched = lifestyleRiskSignals.filter((item) => item.regex.test(text));
  const score = matched.reduce((sum, item) => sum + item.boost, 0);
  return {
    tags: matched.map((item) => item.id),
    score,
  };
};

const detectCriticalRedFlags = ({ symptoms = [], lifestyle = '' }) => {
  const notes = symptoms
    .map((item) => [item.name, item.notes].filter(Boolean).join(' '))
    .join(' | ');
  const source = `${lifestyle || ''} ${notes}`.trim();
  const flags = criticalRedFlags
    .filter((flag) => flag.regex.test(source))
    .map((flag) => ({ code: flag.code, message: flag.message }));

  return {
    hasCritical: flags.length > 0,
    flags,
  };
};

const rankDosha = (doshaScores) => {
  const entries = Object.entries(doshaScores).filter(([, score]) => score > 0);
  if (!entries.length) return { doshaImbalance: 'General Imbalance', topDoshas: [] };
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [first, second] = sorted;
  if (!second) return { doshaImbalance: first[0], topDoshas: [first[0]] };
  const ratio = second[1] / first[1];
  if (ratio >= 0.65) {
    return { doshaImbalance: `${first[0]}/${second[0]}`, topDoshas: [first[0], second[0]] };
  }
  return { doshaImbalance: first[0], topDoshas: [first[0]] };
};

const predictLikelyCauses = (symptoms = []) => {
  const causes = symptoms.flatMap((symptom) => likelyCauseHints[symptom] || []);
  return [...new Set(causes)].slice(0, 6);
};

const buildRecommendation = ({ symptomName, severity, rule, durationDays, isUnknown }) => {
  const severityName = severityKey(severity);
  if (isUnknown) {
    return {
      symptom: symptomName,
      severity: severityName,
      score: 1,
      action: 'Symptom not fully recognized. Please consult a doctor for personalized advice.',
      reason: 'Unmapped symptom needs clinician validation.',
      confidence: 0.35,
      durationDays,
    };
  }

  const rec = rule.severity[severityName] || {};
  const baseScore = Number(rec.score || 1);
  const priorityScore = baseScore * severityWeight[severity] * getDurationMultiplier(durationDays);

  return {
    symptom: symptomName,
    severity: severityName,
    score: Number(priorityScore.toFixed(2)),
    home: rec.home || '',
    med: rec.med || '',
    action: rec.action || '',
    reason: rec.reason || '',
    durationDays,
    confidence: severity === 3 ? 0.88 : severity === 2 ? 0.82 : 0.76,
  };
};

const analyzeSymptoms = ({ symptoms = [], lifestyle = '', language = 'en' }) => {
  const normalizedSymptoms = [];
  const unknownSymptoms = [];
  const recommendations = [];
  const doshaScores = { Vata: 0, Pitta: 0, Kapha: 0 };

  const lifestyleRisk = detectLifestyleRisk(lifestyle);
  const age = parseAgeFromLifestyle(lifestyle);

  symptoms.forEach((symptom, index) => {
    const canonicalName = toCanonicalSymptom(symptom?.name || '');
    if (!canonicalName) return;

    const severity = clampSeverity(symptom?.severity);
    const durationDays = clampDuration(symptom?.durationDays);
    const notes = String(symptom?.notes || '').trim().slice(0, 400);

    normalizedSymptoms.push({
      inputIndex: index,
      name: canonicalName,
      severity,
      durationDays,
      notes,
    });

    const rule = rules.symptoms[canonicalName];
    if (!rule) {
      unknownSymptoms.push(canonicalName);
      recommendations.push(
        buildRecommendation({
          symptomName: canonicalName,
          severity,
          durationDays,
          isUnknown: true,
        })
      );
      return;
    }

    const doshas = String(rule.dosha || '')
      .split('/')
      .map((item) => item.trim())
      .filter(Boolean);

    const impact = severityWeight[severity] * getDurationMultiplier(durationDays);
    doshas.forEach((dosha) => {
      if (doshaScores[dosha] !== undefined) {
        doshaScores[dosha] += impact;
      }
    });

    recommendations.push(
      buildRecommendation({
        symptomName: canonicalName,
        severity,
        durationDays,
        rule,
        isUnknown: false,
      })
    );
  });

  const redFlags = detectCriticalRedFlags({ symptoms: normalizedSymptoms, lifestyle });
  const severeCount = normalizedSymptoms.filter((symptom) => symptom.severity >= 3).length;
  const knownCount = normalizedSymptoms.length - unknownSymptoms.length;

  const recommendationRiskScore = recommendations.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const ageRiskBoost = age && age >= 60 ? 0.9 : 0;
  const unknownRiskBoost = unknownSymptoms.length * 0.6;
  const polySymptomBoost = normalizedSymptoms.length >= 4 ? 1.0 : normalizedSymptoms.length >= 2 ? 0.4 : 0;
  const riskScoreRaw =
    recommendationRiskScore +
    lifestyleRisk.score +
    ageRiskBoost +
    unknownRiskBoost +
    polySymptomBoost +
    (redFlags.hasCritical ? 3.5 : 0);

  const maxScoreReference = Math.max(8, normalizedSymptoms.length * 8);
  const riskScore = Math.min(100, Math.round((riskScoreRaw / maxScoreReference) * 100));

  let severityLevel = 'mild';
  if (riskScore >= 70 || severeCount >= 2) severityLevel = 'severe';
  else if (riskScore >= 40 || severeCount >= 1) severityLevel = 'moderate';

  let urgency = 'LOW';
  if (severityLevel === 'moderate') urgency = 'MEDIUM';
  if (severityLevel === 'severe') urgency = 'HIGH';
  if (redFlags.hasCritical) urgency = 'HIGH';

  const { doshaImbalance, topDoshas } = rankDosha(doshaScores);
  const recommendedSpecialty =
    urgency === 'HIGH'
      ? 'Kayachikitsa'
      : doshaSpecialtyMap[doshaImbalance] || doshaSpecialtyMap[topDoshas[0]] || 'Kayachikitsa';

  const knownRatio = normalizedSymptoms.length
    ? knownCount / normalizedSymptoms.length
    : 0;
  const richness = Math.min(
    1,
    (normalizedSymptoms.filter((symptom) => symptom.durationDays > 0 || symptom.notes).length +
      (String(lifestyle || '').trim() ? 1 : 0)) /
      Math.max(1, normalizedSymptoms.length + 1)
  );
  const confidenceScore = Number(Math.min(0.97, 0.42 + knownRatio * 0.38 + richness * 0.2).toFixed(2));

  const likelyCauses = predictLikelyCauses(normalizedSymptoms.map((symptom) => symptom.name));

  const orderedRecommendations = recommendations
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 8);

  const globalAdvice = [];
  if (lifestyleRisk.tags.includes('high_stress') || lifestyleRisk.tags.includes('poor_sleep')) {
    globalAdvice.push('Prioritize sleep regularity and stress regulation routines for 5-7 days.');
  }
  if (lifestyleRisk.tags.includes('irregular_meals') || lifestyleRisk.tags.includes('dehydration')) {
    globalAdvice.push('Adopt regular meals and hydration to stabilize digestion and energy.');
  }
  if (unknownSymptoms.length) {
    globalAdvice.push('Some symptoms were not fully recognized; a clinical review is recommended.');
  }
  if (!globalAdvice.length) {
    globalAdvice.push('Track symptom severity daily and seek consultation if symptoms persist or worsen.');
  }

  return {
    doshaImbalance,
    severityLevel,
    urgency,
    lifestyleSummary: lifestyle || 'Not provided',
    recommendedSpecialty,
    recommendations: orderedRecommendations,
    unknownSymptoms: [...new Set(unknownSymptoms)],
    likelyCauses,
    riskScore,
    confidenceScore,
    globalAdvice,
    redFlags: redFlags.flags,
    requiresImmediateCare: redFlags.hasCritical,
    normalizedSymptoms,
    disclaimer: rules.disclaimer,
    language,
  };
};

module.exports = {
  analyzeSymptoms,
  inferSymptomsFromMessage,
  inferSeverityFromMessage,
  predictLikelyCauses,
  toCanonicalSymptom,
};
