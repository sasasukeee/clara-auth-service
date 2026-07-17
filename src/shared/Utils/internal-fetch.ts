/**
 * Global fetch middleware to append internal headers on every outbound request.
 * This ensures gateway requests are marked as internal without repeating code.
 */
const internalSecret = process.env.INTERNAL_SECRET;

if (!internalSecret) {
  throw new Error('INTERNAL_SECRET env is required for outbound requests');
}

const originalFetch = globalThis.fetch;

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers ?? {});
  headers.set('x-internal-secret', internalSecret);

  return originalFetch(input, {
    ...init,
    headers,
  });
};
