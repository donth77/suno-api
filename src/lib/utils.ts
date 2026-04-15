import pino from "pino";
import { Page } from "rebrowser-playwright-core";

const logger = pino();

/**
 * Pause for a specified number of seconds.
 * @param x Minimum number of seconds.
 * @param y Maximum number of seconds (optional).
 */
export const sleep = (x: number, y?: number): Promise<void> => {
  let timeout = x * 1000;
  if (y !== undefined && y !== x) {
    const min = Math.min(x, y);
    const max = Math.max(x, y);
    timeout = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  }
  // console.log(`Sleeping for ${timeout / 1000} seconds`);
  logger.info(`Sleeping for ${timeout / 1000} seconds`);

  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * @param target A Locator or a page
 * @returns {boolean} 
 */
export const isPage = (target: any): target is Page => {
  return target.constructor.name === 'Page';
}

/**
 * Waits for an hCaptcha image requests and then waits for all of them to end
 * @param page
 * @param signal `const controller = new AbortController(); controller.status`
 * @returns {Promise<void>} 
 */
export const waitForRequests = (page: Page, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Suno proxies hCaptcha through their own domain now
    // (`hcaptcha-imgs-prod.suno.com` + `hcaptcha-assets-prod.suno.com`).
    // Match both the proxied Suno host AND the original img*.hcaptcha.com
    // host so this works on fresh Suno and on any other site that uses
    // vanilla hCaptcha.
    const urlPattern = /^https:\/\/(img[a-zA-Z0-9]*\.hcaptcha\.com|hcaptcha-(imgs|assets)-prod\.suno\.com)\/.*$/;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let activeRequestCount = 0;
    let requestOccurred = false;

    const cleanupListeners = () => {
      page.off('request', onRequest);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFinished);
    };

    const resetTimeout = () => {
      if (timeoutHandle)
        clearTimeout(timeoutHandle);
      if (activeRequestCount === 0) {
        timeoutHandle = setTimeout(() => {
          cleanupListeners();
          resolve();
        }, 1000); // 1 second of no requests
      }
    };

    const onRequest = (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        requestOccurred = true;
        activeRequestCount++;
        if (timeoutHandle)
          clearTimeout(timeoutHandle);
      }
    };

    const onRequestFinished = (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        activeRequestCount--;
        resetTimeout();
      }
    };

    // Wait for an hCaptcha request for up to 1 minute
    const initialTimeout = setTimeout(() => {
      if (!requestOccurred) {
        page.off('request', onRequest);
        cleanupListeners();
        reject(new Error('No hCaptcha request occurred within 1 minute.'));
      } else {
        // Start waiting for no hCaptcha requests
        resetTimeout();
      }
    }, 60000); // 1 minute timeout

    page.on('request', onRequest);
    page.on('requestfinished', onRequestFinished);
    page.on('requestfailed', onRequestFinished);

    // Cleanup the initial timeout if an hCaptcha request occurs
    page.on('request', (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        clearTimeout(initialTimeout);
      }
    });

    const onAbort = () => {
      cleanupListeners();
      clearTimeout(initialTimeout);
      if (timeoutHandle)
        clearTimeout(timeoutHandle);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  }); 
}

/**
 * CORS allow-origin is read from `ALLOWED_ORIGIN` env var at module load.
 * Production deployments should set this to the exact frontend origin
 * (e.g. `https://vibez.surf`) so random internet callers can't abuse the
 * proxy and burn the 2Captcha budget. Falls back to `*` for local dev.
 */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // x-suno-cookie: custom header used by vibez.surf so each user brings
  // their own Suno cookie instead of sharing the deployer's account.
  // x-api-key: shared-secret gate (see middleware.ts) keeping casual
  // abusers off the proxy.
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Suno-Cookie, X-API-Key',
}

/**
 * Extract the Suno cookie for the current request. Prefers the client-sent
 * `X-Suno-Cookie` header (BYOK model — each visitor uses their own Suno
 * account). Falls back to `SUNO_COOKIE` env var only when the header isn't
 * present, which is convenient for local development but should be left
 * UNSET in production so users are forced to provide their own.
 */
export function getCookieForRequest(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get('x-suno-cookie') || process.env.SUNO_COOKIE || '';
}