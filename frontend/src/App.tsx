import { useState } from 'react';
import { createPublicClient, http, zeroAddress, type Hex } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { baseSepolia } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Read the API key from the .env file
const apiKey = import.meta.env.VITE_PIMLICO_API_KEY as string;
const pimlicoUrl = `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${apiKey}`;

// Use the SAME EntryPoint everywhere (v0.7)
const entryPoint = { address: entryPoint07Address, version: '0.7' as const };

const publicClient = createPublicClient({ 
  chain: baseSepolia, 
  transport: http() 
});

const pimlicoClient = createPimlicoClient({
  chain: baseSepolia,
  transport: http(pimlicoUrl),
  entryPoint,
});

// Dev-only owner key, persisted so the smart account address stays the same across reloads
function getDevOwner() {
  let pk = localStorage.getItem('dev-owner-pk') as Hex | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem('dev-owner-pk', pk);
  }
  return privateKeyToAccount(pk);
}

export default function App() {
  const [status, setStatus] = useState('Ready.');
  const [address, setAddress] = useState('');
  const [txHash, setTxHash] = useState('');

  const send = async () => {
    setStatus('🔄 Building UserOperation...');
    setTxHash('');
    try {
      const account = await toSimpleSmartAccount({
        client: publicClient,
        owner: getDevOwner(),
        entryPoint,
      });
      setAddress(account.address);

      const smartAccountClient = createSmartAccountClient({
        account,
        chain: baseSepolia,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient, // Replaces the old middleware.sponsorUserOperation
        userOperation: {
          // Replaces the old middleware.gasPrice; uses Pimlico's own fee oracle
          estimateFeesPerGas: async () =>
            (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
      });

      setStatus('🚀 Sending (first op also deploys the account)...');
      const hash = await smartAccountClient.sendTransaction({
        to: zeroAddress,
        value: 0n,
        data: '0x',
      });

      setTxHash(hash);
      setStatus('✅ Success: sponsored transaction confirmed!');
    } catch (e: any) {
      console.error('Full error:', e);
      setStatus(`❌ Error: ${e.shortMessage || e.message}`);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', margin: '2rem', maxWidth: '800px' }}>
      <h1>🚀 Paymaster Test</h1>
      <p>This proves the wallet can transact without the user holding ETH.</p>
      
      <button 
        onClick={send} 
        style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0052ff', color: 'white', border: 'none', borderRadius: '8px' }}
      >
        Send gasless transaction
      </button>
      
      <p style={{ marginTop: '1rem', fontWeight: 'bold', color: status.includes('Success') ? 'green' : status.includes('Error') ? 'red' : 'black' }}>
        {status}
      </p>
      
      {address && <p>Smart account: <code style={{ wordBreak: 'break-all' }}>{address}</code></p>}
      
      {txHash && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f4f4f4', borderRadius: '8px' }}>
          <p><strong>Transaction Hash:</strong></p>
          <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all', color: '#0052ff' }}>
            {txHash}
          </a>
          <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '0.5rem' }}>
            Click the link. Look for "Paymaster" in the details to see Pimlico paid the gas!
          </p>
        </div>
      )}
    </div>
  );
}