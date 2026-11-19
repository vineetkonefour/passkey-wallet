// P-256 curve constants (for the on-curve sanity check)
const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

export interface P256Point {
  x: bigint;
  y: bigint;
}

// ---------- byte helpers (no Buffer: it does not exist in the browser) ----------
export function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const bytesToHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const bytesToBigInt = (b: Uint8Array) => BigInt('0x' + bytesToHex(b));

// ---------- is (x, y) really on P-256? Catches extraction bugs ----------
export function isOnP256(x: bigint, y: bigint): boolean {
  const mod = (a: bigint) => ((a % P) + P) % P;
  return mod(y * y) === mod(x * x * x - 3n * x + B);
}

// ---------- public key: SPKI (response.getPublicKey()) -> (x, y) ----------
// SPKI for P-256 = 26-byte fixed header + 0x04 + X(32) + Y(32) = 91 bytes
const SPKI_P256_HEADER = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

export function pointFromSpki(spkiB64u: string): P256Point {
  const der = b64uToBytes(spkiB64u);
  if (der.length !== 91 || bytesToHex(der.slice(0, 26)) !== SPKI_P256_HEADER) {
    throw new Error(`Public key is not P-256 (length ${der.length}). The passkey must use ES256.`);
  }
  if (der[26] !== 0x04) throw new Error('Expected an uncompressed EC point (0x04).');
  return { x: bytesToBigInt(der.slice(27, 59)), y: bytesToBigInt(der.slice(59, 91)) };
}

// ---------- signature: DER (from the browser) -> (r, s) ----------
// DER: 30 len 02 rLen r 02 sLen s. For P-256 the lengths are always short-form (< 128 bytes).
// BigInt parsing already ignores the optional leading 0x00 byte, so no special-casing is needed.
export function parseASN1Signature(sig: Uint8Array): { r: bigint; s: bigint } {
  if (sig.length < 8 || sig[0] !== 0x30 || sig[2] !== 0x02) throw new Error('Malformed DER signature');
  const rLen = sig[3];
  const rEnd = 4 + rLen;
  if (rLen === 0 || sig[rEnd] !== 0x02) throw new Error('Malformed DER signature (r)');
  const sLen = sig[rEnd + 1];
  const sEnd = rEnd + 2 + sLen;
  if (sLen === 0 || sEnd > sig.length) throw new Error('Malformed DER signature (s)');
  const r = bytesToBigInt(sig.slice(4, rEnd));
  const s = bytesToBigInt(sig.slice(rEnd + 2, sEnd));
  if (r === 0n || s === 0n) throw new Error('Invalid signature (zero r or s)');
  return { r, s };
}

// ---------- UI helpers ----------
/** Accepts a decimal string or 0x-hex and returns a bigint. Throws a readable error otherwise. */
export function parseCoordinate(input: string): bigint {
  const v = input.trim();
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(v)) {
    throw new Error('Enter the X coordinate as a decimal number or 0x… hex.');
  }
  return BigInt(v);
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const shortNum = (n: string) => (n.length > 16 ? `${n.slice(0, 8)}…${n.slice(-6)}` : n);