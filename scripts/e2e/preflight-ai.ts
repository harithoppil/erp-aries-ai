// Preflight: verify the AI provider configured in .env is reachable and
// returns a sane completion. Run before the Puppeteer AI test so we don't
// chase UI bugs that are actually backend/key issues.
//
// Usage:  bun run scripts/e2e/preflight-ai.ts
//
// Exits 0 on success, non-zero on failure. Reads:
//   GOOGLE_GENERATIVE_AI_API_KEY  (Gemini)
//   ANTHROPIC_API_KEY              (fallback)
//   OPENAI_API_KEY                  (fallback)

const TIMEOUT_MS = 15000;

interface ProbeResult {
  provider: string;
  ok: boolean;
  status?: number;
  detail?: string;
  sample?: string;
}

async function probeGemini(): Promise<ProbeResult> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return { provider: 'gemini', ok: false, detail: 'missing API key' };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with just: OK' }] }],
          generationConfig: { maxOutputTokens: 20 },
        }),
        signal: ac.signal,
      },
    );
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        provider: 'gemini',
        ok: false,
        status: res.status,
        detail: json.error?.message ?? res.statusText,
      };
    }
    const sample = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { provider: 'gemini', ok: true, status: res.status, sample: sample.slice(0, 100) };
  } catch (err) {
    return {
      provider: 'gemini',
      ok: false,
      detail: err instanceof Error ? err.message : 'request failed',
    };
  } finally {
    clearTimeout(t);
  }
}

async function probeAnthropic(): Promise<ProbeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { provider: 'anthropic', ok: false, detail: 'missing API key' };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with just: OK' }],
      }),
      signal: ac.signal,
    });
    const json = (await res.json()) as {
      content?: { text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        provider: 'anthropic',
        ok: false,
        status: res.status,
        detail: json.error?.message ?? res.statusText,
      };
    }
    return {
      provider: 'anthropic',
      ok: true,
      status: res.status,
      sample: json.content?.[0]?.text?.slice(0, 100) ?? '',
    };
  } catch (err) {
    return {
      provider: 'anthropic',
      ok: false,
      detail: err instanceof Error ? err.message : 'request failed',
    };
  } finally {
    clearTimeout(t);
  }
}

async function probeOpenAI(): Promise<ProbeResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { provider: 'openai', ok: false, detail: 'missing API key' };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with just: OK' }],
      }),
      signal: ac.signal,
    });
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        provider: 'openai',
        ok: false,
        status: res.status,
        detail: json.error?.message ?? res.statusText,
      };
    }
    return {
      provider: 'openai',
      ok: true,
      status: res.status,
      sample: json.choices?.[0]?.message?.content?.slice(0, 100) ?? '',
    };
  } catch (err) {
    return {
      provider: 'openai',
      ok: false,
      detail: err instanceof Error ? err.message : 'request failed',
    };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log('=== AI preflight ===');
  const results = await Promise.all([probeGemini(), probeAnthropic(), probeOpenAI()]);
  let anyOk = false;
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.provider} (${r.status}) — sample: ${JSON.stringify(r.sample)}`);
      anyOk = true;
    } else {
      console.log(`  ✗ ${r.provider} — ${r.detail ?? 'failed'}${r.status ? ` (${r.status})` : ''}`);
    }
  }
  if (!anyOk) {
    console.error('\nNo AI provider is reachable. Set one of:');
    console.error(
      '  GOOGLE_GENERATIVE_AI_API_KEY=… (or GEMINI_API_KEY=…)\n  ANTHROPIC_API_KEY=…\n  OPENAI_API_KEY=…',
    );
    process.exit(1);
  }
  console.log('\nAt least one provider works — safe to run AI UI tests.');
}

main();
