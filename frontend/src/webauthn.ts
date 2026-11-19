import { createPublicClient, http, parseEther, formatEther, encodeFunctionData, type Address, toAccount } from 'viem';

// Convert base64url string (from browser) to Uint8Array
export function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to hex string (for blockchain)
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse the ASN.1 DER signature from the browser into R and S values
export function parseASN1Signature(signature: Uint8Array) {
  let rStart = 4;
  let rLen = signature[3];
  let r = signature.slice(rStart, rStart + rLen);
  if (r.length === 33 && r[0] === 0) r = r.slice(1); // Remove leading zero

  let sStart = rStart + rLen + 2;
  let sLen = signature[sStart - 1];
  let s = signature.slice(sStart, sStart + sLen);
  if (s.length === 33 && s[0] === 0) s = s.slice(1); // Remove leading zero

  return {
    r: bytesToHex(r),
    s: bytesToHex(s)
  };
}

// The main function: Trigger fingerprint/PIN and format the signature
export async function signUserOperationWithPasskey(userOpHash: string): Promise<string> {
  // 1. Convert the hex hash to bytes for the WebAuthn challenge
  const hashBytes = new Uint8Array(userOpHash.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  // 2. Trigger the browser's native WebAuthn UI (Fingerprint / Windows Hello / FaceID)
  // We omit 'allowCredentials' so the browser shows a picker of all your registered passkeys for localhost
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: hashBytes,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : undefined,
      userVerification: 'required',
    }
  }) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAssertionResponse;

  // 3. Extract the raw data
  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
  
  // 4. Parse the cryptographic signature into R and S
  const sigBytes = new Uint8Array(response.signature);
  const { r, s } = parseASN1Signature(sigBytes);

  // 5. Find the indices in the JSON (Standard ERC-4337 Passkey format)
  const challengeIndex = clientDataJSON.indexOf('"challenge":');
  const typeIndex = clientDataJSON.indexOf('"type":');

  // 6. Pack everything into the exact ABI format your Smart Contract's validateUserOp expects
  return encodeAbiParameters(
    [
      { type: 'bytes' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' }
    ],
    [
      bytesToHex(authenticatorData),
      clientDataJSON,
      BigInt(challengeIndex),
      BigInt(typeIndex),
      BigInt(r),
      BigInt(s)
    ]
  );
}