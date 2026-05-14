// AI-powered symptom structuring service
// Uses OpenAI if available, falls back to rule-based parsing

async function structureSymptoms(rawText) {
  if (!rawText || !rawText.trim()) return null;

  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = `You are a clinical data structuring assistant for an Ayurvedic telemedicine platform.
A patient has described their symptoms in natural language. Convert this into a structured clinical summary for the doctor.

Patient's raw input: "${rawText}"

Return a JSON object with ONLY these fields (no extra keys, no markdown):
{
  "chiefComplaint": "one-line main complaint",
  "duration": "estimated duration or 'Not specified'",
  "severity": "mild | moderate | severe | not specified",
  "associatedSymptoms": ["list", "of", "other", "symptoms"],
  "structuredSummary": "2-3 sentence professional clinical summary for doctor",
  "clarificationNeeded": "any important missing info, or empty string"
}

Rules: Do not diagnose. Do not invent symptoms not mentioned. Label all output as AI-assisted.`;

      const response = await fetch(
        `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2,
            messages: [{ role: 'user', content: prompt }] }),
        }
      );
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      // Strip markdown code blocks if present
      const cleaned = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { ...parsed, rawText, aiGenerated: true };
    } catch (err) {
      console.error('[AISymptom] OpenAI error, using fallback:', err.message);
    }
  }

  // Fallback: rule-based
  return fallbackStructure(rawText);
}

function fallbackStructure(rawText) {
  const lower = rawText.toLowerCase();
  const severity = /(severe|unbearable|extreme|intense|worst)/.test(lower) ? 'severe'
    : /(moderate|medium|quite|fairly)/.test(lower) ? 'moderate' : 'mild';
  const duration = lower.match(/(\d+\s*(?:day|week|month|hour|year)s?)/)?.[1] || 'Not specified';

  const allSymptoms = ['headache','fever','cough','cold','vomiting','nausea','pain','fatigue',
    'weakness','rash','swelling','dizziness','breathlessness','anxiety','insomnia','indigestion',
    'joint pain','back pain','chest pain','sore throat','stomach ache','acidity','constipation'];
  const found = allSymptoms.filter(s => lower.includes(s));
  const chief = found[0] || 'General discomfort';
  const associated = found.slice(1);

  return {
    rawText,
    chiefComplaint: chief,
    duration,
    severity,
    associatedSymptoms: associated,
    structuredSummary: `Patient reports ${chief}${associated.length ? ` with associated ${associated.join(', ')}` : ''}. Duration: ${duration}. Severity described as ${severity}.`,
    clarificationNeeded: '',
    aiGenerated: false,
  };
}

module.exports = { structureSymptoms };
