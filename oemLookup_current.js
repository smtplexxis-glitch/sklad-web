const OEM_PROXY_URL = (process.env.OEM_PROXY_URL || '').replace('/recognize-oem', '/text');
const OEM_PROXY_TOKEN = process.env.OEM_PROXY_TOKEN;
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function buildPrompt(oemNumber, productName, brand) {
  return [
    'You are an automotive parts catalog expert with deep knowledge of OEM part numbers and vehicle fitment data (similar to TecDoc catalog data).',
    '',
    'CRITICAL ACCURACY WARNING: it is FAR better to return an EMPTY list than to guess a plausible-looking but incorrect cross-reference number or wrong vehicle fitment. A wrong cross-reference number could cause a warehouse worker to ship the completely wrong physical part to a customer. Do NOT invent numbers that merely look structurally correct. Only include a cross-reference number if you have genuine, specific knowledge that this exact aftermarket number corresponds to this exact OEM number for this exact part.',
    '',
    'Given an OEM part number, return:',
    '1) cross-reference numbers: equivalent part numbers from other aftermarket manufacturers (Febi, LEMFORDER, TRW, Sasic, Delphi, etc) that you are HIGHLY confident are correct for this specific OEM number and this specific part type. If you are not certain, omit the entry entirely rather than guessing.',
    '2) a list of vehicle make/model/generation combinations that use this exact part, each as a separate row. Again, only include entries you are confident about.',
    '',
    'OEM number: ' + oemNumber,
    'Part name (use this to sanity-check that any cross-reference or fitment you return is actually for THIS type of part, not a different part that happens to share styling): ' + (productName || 'unknown'),
    'Vehicle brand context: ' + (brand || 'unknown'),
    '',
    'Respond ONLY with valid JSON, no markdown, no explanation, in this exact shape:',
    '{"cross_references": [{"number": "string", "brand": "string"}], "applicability": [{"make": "string", "model": "string", "generation": "string or null", "years": "string like 2007-2015", "body_codes": "string like S204, W204 or null", "engine": "string like M271 (1.8 B) or null"}]}',
    'Rules for applicability:',
    '- ONE row per make+model+generation combination, do not merge multiple generations into one row.',
    '- If the part fits multiple engines for the same generation, either list multiple rows (one per engine) or combine engines in the engine field separated by comma.',
    '- generation should be a short ordinal like "3" or "Mk7" if known, else null.',
    '- body_codes are factory chassis codes like W204, S204 - comma separated if several, else null.',
    '- Include only entries you are genuinely confident about (up to 20 max). It is fine to return fewer or zero if uncertain.',
    'Rules for cross_references:',
    '- Maximum 8 entries, but return fewer or zero if you are not confident.',
    '- Never fabricate a number just to fill the list.',
    'If you cannot determine any applicability or cross references with confidence, return empty arrays for both.',
  ].join('\n');
}

async function lookupOemCrossAndApplicability(oemNumber, productName, brand) {
  if (!OEM_PROXY_URL || !OEM_PROXY_TOKEN) throw new Error('OEM_PROXY_URL/TOKEN not set');
  const prompt = buildPrompt(oemNumber, productName, brand);
  const response = await fetch(OEM_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-token': OEM_PROXY_TOKEN,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Proxy error ' + response.status + ': ' + errText);
  }
  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text in proxy response');
  let cleaned = textBlock.text.trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) cleaned = cleaned.slice(s, e+1);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e2) {
    throw new Error('Failed to parse AI response as JSON: ' + e2.message);
  }
  const crossRefs = Array.isArray(parsed.cross_references) ? parsed.cross_references
    .filter(r => r && r.number)
    .slice(0, 8)
    .map(r => ({ number: String(r.number).trim(), brand: r.brand ? String(r.brand).trim() : null }))
    : [];
  const applicability = Array.isArray(parsed.applicability) ? parsed.applicability
    .filter(a => a && a.make && a.model)
    .slice(0, 20)
    .map(a => ({
      make: String(a.make).trim(),
      model: String(a.model).trim(),
      generation: a.generation ? String(a.generation).trim() : null,
      years: a.years ? String(a.years).trim() : null,
      body_codes: a.body_codes ? String(a.body_codes).trim() : null,
      engine: a.engine ? String(a.engine).trim() : null,
    }))
    : [];
  return { crossRefs, applicability };
}

module.exports = { lookupOemCrossAndApplicability };
