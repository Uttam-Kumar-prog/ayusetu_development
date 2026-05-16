const {
  analyzeSymptoms,
  inferSymptomsFromMessage,
  inferSeverityFromMessage,
  predictLikelyCauses,
} = require('./recommendationEngine');

const outOfScopeReply =
  'I am unaware about that. Please ask about symptoms or AyuSetu support.';

const platformKeywords = [
  'ayusetu',
  'account',
  'login',
  'sign in',
  'signup',
  'sign up',
  'register',
  'dashboard',
  'appointment',
  'book',
  'doctor',
  'consultation',
  'prescription',
  'upload',
  'report',
  'chat',
  'session',
];

const healthKeywords = [
  'symptom',
  'pain',
  'fever',
  'cough',
  'cold',
  'headache',
  'anxiety',
  'sleep',
  'insomnia',
  'stress',
  'fatigue',
  'fever',
  'stomach pain',
  'back pain',
  'nausea',
  'constipation',
  'diarrhea',
  'sore throat',
  'indigestion',
  'acidity',
  'bloating',
  'rash',
  'itching',
  'medicine',
  'dosha',
  'ayurveda',
  'triage',
  'urgent',
  'emergency',
  'chest pain',
  'breath',
  'breathing',
  'loose motion',
  'throat pain',
  'temperature',
];

const greetingRegex = /^(hi|hello|hey|namaste|good morning|good afternoon|good evening)\b/;
const acknowledgementRegex = /^(thanks|thank you|ok|okay|yes|no|got it|fine|sure)\b/;

const outOfScopePatterns = [
  /\bwho is\b/,
  /\bwhat is\b/,
  /\bwhen is\b/,
  /\bwhere is\b/,
  /\bprime minister\b/,
  /\bpresident\b/,
  /\bcapital of\b/,
  /\bstock price\b/,
  /\bcricket score\b/,
  /\bfootball score\b/,
  /\bmovie\b/,
  /\bcelebrity\b/,
  /\bbitcoin\b/,
  /\bcrypto\b/,
  /\belection\b/,
];

const hasKeyword = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const isOutOfScopeMessage = (message = '') => {
  const lowered = String(message || '').toLowerCase().trim();
  if (!lowered) return false;
  if (greetingRegex.test(lowered) || acknowledgementRegex.test(lowered)) return false;

  const inScopeByKeywords =
    hasKeyword(lowered, platformKeywords) ||
    hasKeyword(lowered, healthKeywords) ||
    inferSymptomsFromMessage(lowered).length > 0;

  if (inScopeByKeywords) return false;
  return outOfScopePatterns.some((pattern) => pattern.test(lowered));
};

const fallbackAssistantReply = ({ message, triage, assistantName = 'AyuBot', memorySummary = null }) => {
  const lowered = String(message || '').toLowerCase();
  if (isOutOfScopeMessage(lowered)) {
    return outOfScopeReply;
  }

  if (/(emergency|chest pain|shortness of breath|difficulty breathing|faint|seizure)/.test(lowered)) {
    return 'This may be urgent. Please seek emergency medical help immediately or call your local emergency number.';
  }

  if (lowered.includes('doctor') || lowered.includes('not satisfied') || lowered.includes('dissatisfied')) {
    return 'I understand. I can escalate your case to a doctor right now. Please share your preferred consultation time.';
  }

  if (/(book|appointment|consultation)/.test(lowered)) {
    return 'I can help with booking. Please tell me your preferred specialty and time, and I will guide you to the doctor consultation flow.';
  }

  let effectiveTriage = triage || null;
  if (!effectiveTriage) {
    const inferredSymptoms = inferSymptomsFromMessage(lowered);
    if (inferredSymptoms.length) {
      const inferredSeverity = inferSeverityFromMessage(lowered);
      effectiveTriage = analyzeSymptoms({
        symptoms: inferredSymptoms.map((name) => ({ name, severity: inferredSeverity })),
        lifestyle: '',
        language: 'en',
      });
    }
  }

  if (effectiveTriage?.recommendations?.length) {
    const primary = effectiveTriage.recommendations[0];
    const step = primary.home || primary.med || primary.action || 'Hydrate well and rest';
    const reason = primary.reason || 'supports dosha rebalancing';
    const memoryHint =
      memorySummary?.topSymptoms?.length
        ? ` I also noted previous recurring symptoms: ${memorySummary.topSymptoms.join(', ')}.`
        : '';

    const urgencyHint =
      effectiveTriage.urgency === 'HIGH'
        ? ' Because your risk appears high, please seek doctor consultation urgently.'
        : '';

    return `I noted a likely ${effectiveTriage.doshaImbalance} pattern.${memoryHint} A practical next step is: ${step}. Ayurvedic reasoning: ${reason}.${urgencyHint}`;
  }

  if (/(hello|hi|hey|namaste)/.test(lowered)) {
    return `Namaste, I am ${assistantName}. I can help with symptom guidance, home support, and doctor consultation when needed. Tell me your main symptom to begin.`;
  }

  return 'Thanks for sharing. Please mention your key symptoms (for example headache, joint pain, indigestion), duration, and severity so I can provide safer guidance.';
};

const generateAssistantReply = async ({ message, triage, assistantName = 'AyuBot', memorySummary = null }) => {
  if (isOutOfScopeMessage(message)) {
    return outOfScopeReply;
  }

  if (!process.env.OPENAI_API_KEY) {
    return fallbackAssistantReply({ message, triage, assistantName, memorySummary });
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    const prompt = [
      'You are an Ayurvedic telemedicine assistant.',
      'Give safe, non-diagnostic guidance and suggest doctor consultation when needed.',
      'If user asks outside symptoms/Ayurveda/AyuSetu support, reply exactly:',
      `"${outOfScopeReply}"`,
      `Assistant display name: ${assistantName}`,
      `Known triage context: ${JSON.stringify(triage || {})}`,
      `Longitudinal symptom memory: ${JSON.stringify(memorySummary || {})}`,
      `Patient message: ${message}`,
    ].join('\n');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return (
      data?.choices?.[0]?.message?.content ||
      fallbackAssistantReply({ message, triage, assistantName, memorySummary })
    );
  } catch (err) {
    return fallbackAssistantReply({ message, triage, assistantName, memorySummary });
  }
};

module.exports = {
  analyzeSymptoms,
  generateAssistantReply,
  inferSymptomsFromMessage,
  inferSeverityFromMessage,
  predictLikelyCauses,
};
