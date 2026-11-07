import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

function App() {
  const [publicKey, setPublicKey] = useState<{ x: string; y: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePasskey = async () => {
    setLoading(true);
    setError(null);
    setPublicKey(null);

    try {
      // Step 1: Ask the browser to create a new Passkey
      // This will trigger FaceID/TouchID on your phone
      const attestationResponse = await startRegistration({
        optionsJSON: {
          rp: {
            name: 'Passkey Wallet PBL',
            id: 'localhost', // For local development
          },
          user: {
            id: 'user-' + Date.now(), // Unique user ID
            name: 'testuser@example.com',
            displayName: 'Test User',
          },
          challenge: btoa('random-challenge-' + Date.now()), // Random challenge
          pubKeyCredParams: [
            {
              alg: -7, // ES256 (P-256 curve) - This is what we need!
              type: 'public-key',
            },
          ],
          timeout: 60000,
          attestation: 'none',
        },
      });

      // Step 2: Extract the public key from the response
      // The public key is in the response.attestationObject
      // For now, we'll just show that it worked
      console.log('Passkey created successfully!', attestationResponse);

      // Step 3: Decode the public key (this is complex, so we'll simplify for now)
      // In a real app, you'd use a library to parse the CBOR-encoded public key
      // For this demo, we'll just show placeholder values
      setPublicKey({
        x: '0x' + '1'.repeat(64), // Placeholder - we'll decode this properly later
        y: '0x' + '2'.repeat(64), // Placeholder - we'll decode this properly later
      });
    } catch (err) {
      console.error('Error creating passkey:', err);
      setError(err instanceof Error ? err.message : 'Failed to create passkey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Passkey Wallet - Milestone 4</h1>
      
      <button
        onClick={handleCreatePasskey}
        disabled={loading}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Creating Passkey...' : 'Create Passkey Wallet'}
      </button>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {publicKey && (
        <div style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '8px' }}>
          <h2>Public Key Generated!</h2>
          <p><strong>ownerX:</strong> {publicKey.x}</p>
          <p><strong>ownerY:</strong> {publicKey.y}</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            These are the coordinates we'll use to deploy your smart contract!
          </p>
        </div>
      )}
    </div>
  );
}

export default App;