// My Wise Bet: free coach proxy.
// Holds the Groq API key as a secret, adds the coach instructions, enforces limits,
// and streams the answer back to the page as plain text.

const SYSTEM = `You are the friendly coach inside "My Wise Bet", a web app where beginners learn Texas Hold'em poker and blackjack by playing against computer players.
Answer in plain, encouraging language for a complete beginner. Keep it short: usually 2 to 5 sentences or a few short dash points, unless they ask for more.
Use the game state you are given (cards, bets, whose turn it is) to make the answer concrete. Never invent cards you were not shown.
Write plain text only: no markdown headings, tables or bold.
Only help with the card game, its rules, strategy and the app. Politely decline anything else.`;

const MAX_MESSAGES = 8;
const MAX_CHARS_PER_MESSAGE = 12000;
const MAX_TOTAL_CHARS = 30000;

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  const ok = origin && (allowed.includes(origin) || local);
  return ok
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : null;
}

function reply(status, body, cors) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...(cors || {}) },
  });
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  let msgs = raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) }));
  while (msgs.length && msgs.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

async function callGroq(env, model, messages, extras) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      stream: true,
      max_completion_tokens: 2000,
      temperature: 0.6,
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
      ...extras,
    }),
  });
}

// Turn Groq's server-sent events into a plain text stream of just the answer.
function toTextStream(upstream) {
  const dec = new TextDecoder(),
    enc = new TextEncoder();
  let buf = '';
  return upstream.body.pipeThrough(
    new TransformStream({
      transform(chunk, ctl) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const piece = JSON.parse(data).choices?.[0]?.delta?.content;
            if (piece) ctl.enqueue(enc.encode(piece));
          } catch (e) {
            /* ignore keep-alives and partial lines */
          }
        }
      },
    }),
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS')
      return cors ? new Response(null, { status: 204, headers: cors }) : reply(403, 'Forbidden');
    if (request.method === 'GET') return reply(200, 'My Wise Bet coach is running.', cors);
    if (request.method !== 'POST') return reply(405, 'Method not allowed', cors);
    if (!cors) return reply(403, 'This coach only answers My Wise Bet.', null);
    if (!env.GROQ_API_KEY) return reply(500, 'The coach is not set up yet.', cors);

    // Per-visitor limit (requests per minute, per IP).
    if (env.COACH_LIMIT) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.COACH_LIMIT.limit({ key: ip });
      if (!success) return reply(429, 'Slow down a little and try again in a minute.', cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return reply(400, 'Bad request', cors);
    }
    const messages = cleanMessages(body && body.messages);
    if (!messages) return reply(400, 'Bad request', cors);

    // Try each model in order; skip to the next if one is busy, retired or rejects an option.
    const models = (env.MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    let sawLimit = false;
    for (const model of models) {
      for (const extras of [{ reasoning_effort: 'low', include_reasoning: false }, {}]) {
        const res = await callGroq(env, model, messages, extras);
        if (res.ok) {
          return new Response(toTextStream(res), {
            headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...cors },
          });
        }
        if (res.status === 429) {
          sawLimit = true;
          break;
        }
        if (res.status === 400 && Object.keys(extras).length) continue; // retry without the optional settings
        break; // model missing or other error: next model
      }
    }
    return sawLimit
      ? reply(503, 'The free coach is out of answers for now. Try again later.', cors)
      : reply(502, 'The coach could not answer right now.', cors);
  },
};
