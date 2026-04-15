import { NextResponse, type NextRequest } from 'next/server';

/**
 * Shared-secret gate for all `/api/*` routes.
 *
 * Set `API_KEY` in the deploy env; frontends must send a matching
 * `X-API-Key` header on every request. Blocks casual abuse that the CORS
 * lockdown can't stop (e.g. someone running `curl` against the proxy,
 * which skips browser CORS entirely).
 *
 * Security model: the key ships in the vibez.surf JS bundle, so anyone
 * who inspects the frontend can extract it. It's NOT a secret from
 * determined attackers — it's a speed bump against opportunistic
 * drive-by abuse. Combined with IP rate-limiting (TODO) it's enough for
 * a personal deployment.
 *
 * Leave `API_KEY` unset to disable the gate (useful locally).
 */

// CORS headers are duplicated here (rather than imported from lib/utils)
// because Next.js middleware runs on the Edge runtime which can't load
// libs that pull in Node-only deps (pino, playwright). Keep these in
// sync with the `corsHeaders` constant in `src/lib/utils.ts`.
//
// ALLOWED_ORIGIN is a comma-separated allowlist. The middleware echoes
// the matching request Origin back so multiple origins work (prod +
// localhost). A literal "*" disables the allowlist.
const ALLOWLIST = (process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
function corsHeadersFor(reqOrigin: string): Record<string, string> {
  const allow = ALLOWLIST.includes('*')
    ? '*'
    : ALLOWLIST.includes(reqOrigin) ? reqOrigin : '';
  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Suno-Cookie, X-API-Key',
    'Vary': 'Origin',
  };
  if (allow) base['Access-Control-Allow-Origin'] = allow;
  return base;
}

export function middleware(req: NextRequest): NextResponse | undefined {
  // Only gate the API + v1 routes; let the landing page / Swagger / etc.
  // through so the deploy status check doesn't 401.
  const path = req.nextUrl.pathname;
  if (!path.startsWith('/api/') && !path.startsWith('/v1/')) return;

  // Preflight requests shouldn't be gated — the actual request that
  // follows will be, and CORS handles the preflight response headers.
  if (req.method === 'OPTIONS') return;

  const expected = process.env.API_KEY;
  if (!expected) return; // disabled

  const provided = req.headers.get('x-api-key');
  if (provided === expected) return; // allowed

  // CORS headers on the 401 so browsers surface the actual error
  // ("invalid X-API-Key") instead of a generic "failed to fetch".
  return new NextResponse(
    JSON.stringify({ error: 'Missing or invalid X-API-Key header.' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeadersFor(req.headers.get('origin') ?? ''),
      },
    },
  );
}

export const config = {
  // Run on all /api/** and /v1/** paths.
  matcher: ['/api/:path*', '/v1/:path*'],
};
