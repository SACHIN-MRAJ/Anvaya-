/** Real SHA-256 in the browser (Web Crypto). Used by the evidence log and the Verify page. */
export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const shortHash = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : '');
