import { useEffect, useState } from 'react';
import {
  createPublicClient, http, parseEther, formatEther, encodeAbiParameters,
  encodeFunctionData, decodeFunctionData, bytesToHex, hexToBytes, isAddress,
  type Address, type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  toSmartAccount, getUserOperationHash,
  entryPoint07Abi, entryPoint07Address,
} from 'viem/account-abstraction';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  pointFromSpki, isOnP256, parseASN1Signature, parseCoordinate,
  b64uToBytes, bytesToB64u, shortAddr, shortNum,
} from './passkeyUtils';

// =====================================================================
// Config
// =====================================================================
const FACTORY_ADDRESS = '0xa0508683199a7206c5f47857F5056C12DE938C99' as Address;
const GUARDIAN_ADDRESS = '0x69D0B674C889Cb9977eDf5771aAC538B6c3D26b1' as Address;
const RP_ID = window.location.hostname;
const BASE_SEPOLIA_HEX = '0x14a34';
const apiKey = import.meta.env.VITE_PIMLICO_API_KEY as string;
const pimlicoUrl = `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${apiKey}`;
const entryPoint = { abi: entryPoint07Abi, address: entryPoint07Address, version: '0.7' as const };
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const pimlicoClient = createPimlicoClient({
  chain: baseSepolia,
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: '0.7' },
});

// =====================================================================
// ABIs
// =====================================================================
const executeAbi = [{
  name: 'execute', type: 'function', stateMutability: 'payable', outputs: [],
  inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }],
}] as const;

const factoryAbi = [{
  name: 'getAddress', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'ownerXs', type: 'uint256[]' }, { name: 'ownerYs', type: 'uint256[]' }, { name: 'guardian', type: 'address' }, { name: 'salt', type: 'uint256' }],
  outputs: [{ name: '', type: 'address' }],
}, {
  name: 'createAccount', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'ownerXs', type: 'uint256[]' }, { name: 'ownerYs', type: 'uint256[]' }, { name: 'guardian', type: 'address' }, { name: 'salt', type: 'uint256' }],
  outputs: [{ name: '', type: 'address' }],
}] as const;

const guardianAbi = [{
  name: 'addPasskey', type: 'function', stateMutability: 'nonpayable', outputs: [],
  inputs: [{ name: '_ownerX', type: 'uint256' }, { name: '_ownerY', type: 'uint256' }],
}, {
  name: 'removePasskey', type: 'function', stateMutability: 'nonpayable', outputs: [],
  inputs: [{ name: '_ownerX', type: 'uint256' }],
}] as const;

const passkeysAbi = [{
  name: 'passkeys', type: 'function', stateMutability: 'view',
  inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }],
}] as const;

const sigAbi = [
  { type: 'bytes' }, { type: 'string' }, { type: 'uint256' },
  { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
] as const;

const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

// =====================================================================
// Signature encoding + the smart account
// =====================================================================
function encodePasskeySignature(authData: Hex, clientDataJSON: string, r: bigint, s: bigint, ownerX: bigint): Hex {
  return encodeAbiParameters(sigAbi, [
    authData, clientDataJSON,
    BigInt(clientDataJSON.indexOf('"challenge":')),
    BigInt(clientDataJSON.indexOf('"type":')),
    r, s, ownerX,
  ]);
}

async function toPasskeyAccount(opts: {
  ownerX: bigint;
  initial: { x: bigint; y: bigint };
  address: Address;
  credentialId: string;
  onStatus?: (s: string) => void;
}) {
  const { ownerX, initial, address, credentialId } = opts;

  async function signHash(hash: Hex): Promise<Hex> {
    opts.onStatus?.('Approve with your passkey…');
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(hexToBytes(hash)),
        rpId: RP_ID,
        userVerification: 'required',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(b64uToBytes(credentialId)) }],
      },
    })) as PublicKeyCredential;

    const resp = cred.response as AuthenticatorAssertionResponse;
    let { r, s } = parseASN1Signature(new Uint8Array(resp.signature));
    if (s > P256_N / 2n) s = P256_N - s;

    return encodePasskeySignature(
      bytesToHex(new Uint8Array(resp.authenticatorData)),
      new TextDecoder().decode(resp.clientDataJSON),
      r, s, ownerX,
    );
  }

  return toSmartAccount({
    client: publicClient,
    entryPoint,
    async getAddress() { return address; },
    async getFactoryArgs() {
      const code = await publicClient.getCode({ address });
      if (code && code !== '0x') return { factory: undefined, factoryData: undefined };
      return {
        factory: FACTORY_ADDRESS,
        factoryData: encodeFunctionData({
          abi: factoryAbi, functionName: 'createAccount',
          args: [[initial.x], [initial.y], GUARDIAN_ADDRESS, 0n],
        }),
      };
    },
    async encodeCalls(calls: readonly any[]) {
      if (calls.length !== 1) throw new Error('Batching is not supported yet');
      const c = calls[0];
      return encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [c.to, c.value ?? 0n, c.data ?? '0x'] });
    },
    async decodeCalls(data: Hex) {
      const { args } = decodeFunctionData({ abi: executeAbi, data });
      return [{ to: args[0] as Address, value: args[1] as bigint, data: args[2] as Hex }];
    },
    async getStubSignature() {
      const clientData = `{"type":"webauthn.get","challenge":"${'A'.repeat(43)}","origin":"${window.location.origin}","crossOrigin":false}`;
      const authData = ('0x' + '00'.repeat(32) + '05' + '00000001') as Hex;
      return encodePasskeySignature(authData, clientData, 1n << 200n, 1n << 200n, ownerX);
    },
    async signMessage() { throw new Error('signMessage is not supported'); },
    async signTypedData() { throw new Error('signTypedData is not supported'); },
    async signUserOperation(parameters: any) {
      const { chainId = baseSepolia.id, ...userOperation } = parameters;
      const hash = getUserOperationHash({
        chainId,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: '0.7',
        userOperation: { ...userOperation, sender: address },
      });
      return signHash(hash);
    },
  });
}

// =====================================================================
// Storage
// =====================================================================
type Device = { credId: string; label: string; x: string; y: string; addedAt: string };
type Stored = { address: Address; initial: { x: string; y: string }; devices: Device[] };
const STORAGE_KEY = 'passkeyWallet.v2';

function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
    
    // Migration from old keys
    const primary = JSON.parse(localStorage.getItem('passkeyWallet') || 'null');
    if (!primary?.credId || !primary?.address || !primary?.x || !primary?.y) return null;
    
    const legacyList: any[] = JSON.parse(localStorage.getItem('devices') || '[]');
    const recovery = JSON.parse(localStorage.getItem('recoveryDevice') || 'null');
    const seen = new Set<string>();
    const devices: Device[] = [];
    
    for (const d of [primary, ...legacyList, ...(recovery ? [recovery] : [])]) {
      if (!d?.credId || !d?.x || !d?.y || seen.has(d.credId)) continue;
      seen.add(d.credId);
      devices.push({
        credId: d.credId, label: d.label ?? 'Device',
        x: String(d.x), y: String(d.y), addedAt: d.addedAt ?? new Date().toISOString(),
      });
    }
    
    const migrated: Stored = { address: primary.address, initial: { x: String(primary.x), y: String(primary.y) }, devices };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (e) {
    console.error('Could not read saved wallet', e);
    return null;
  }
}

// =====================================================================
// Passkey creation + MetaMask helpers
// =====================================================================
async function createCredential(where: 'this' | 'other') {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Passkey Wallet', id: RP_ID },
      user: { id: crypto.getRandomValues(new Uint8Array(32)), name: 'wallet-user', displayName: 'Wallet user' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        userVerification: 'required',
        ...(where === 'other' ? { authenticatorAttachment: 'cross-platform' as const } : {}),
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('No passkey was created.');
  
  const spki = (credential.response as AuthenticatorAttestationResponse).getPublicKey();
  if (!spki) throw new Error('This authenticator did not return a public key.');
  
  const point = pointFromSpki(bytesToB64u(new Uint8Array(spki)));
  if (!isOnP256(point.x, point.y)) throw new Error('The extracted public key is not on the P-256 curve.');
  
  return { credId: credential.id, x: point.x, y: point.y };
}

async function connectGuardian(): Promise<Address> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask was not found in this browser.');
  
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_HEX }] });
  } catch (e: any) {
    if (e?.code !== 4902) throw e;
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: BASE_SEPOLIA_HEX, chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia.base.org'], blockExplorerUrls: ['https://sepolia.basescan.org'],
      }],
    });
  }
  
  const [account] = await eth.request({ method: 'eth_requestAccounts' });
  if (!account || account.toLowerCase() !== GUARDIAN_ADDRESS.toLowerCase()) {
    throw new Error(`Select the Guardian account in MetaMask (${shortAddr(GUARDIAN_ADDRESS)}).`);
  }
  
  return account as Address;
}

async function guardianCall(to: Address, data: Hex) {
  const from = await connectGuardian();
  const hash = (await (window as any).ethereum.request({
    method: 'eth_sendTransaction', params: [{ from, to, data }],
  })) as Hex;
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The transaction failed on-chain. Check it on BaseScan.');
  return hash;
}

function friendlyError(e: any): string {
  if (e?.name === 'NotAllowedError') return 'The passkey prompt was cancelled or timed out. Try again.';
  if (e?.code === 4001) return 'You rejected the request in MetaMask.';
  return e?.shortMessage || e?.message || 'Something went wrong.';
}

// =====================================================================
// UI
// =====================================================================
type Notice = { kind: 'info' | 'ok' | 'error'; text: string } | null;

const ui = {
  card: { background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: '1.5rem' } as const,
  input: { width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #d1d5db', marginTop: 6, boxSizing: 'border-box', fontSize: 14 } as const,
  h3: { margin: '0 0 1rem 0', fontSize: 18 } as const,
  muted: { color: '#6b7280', fontSize: 13 } as const,
};

const btn = (variant: 'primary' | 'secondary' | 'danger' = 'primary', disabled = false, small = false) => ({
  padding: small ? '0.4rem 0.75rem' : '0.7rem 1.25rem',
  fontSize: small ? 12 : 14, fontWeight: 600, border: 'none', borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer', color: '#fff',
  background: disabled ? '#d1d5db' : { primary: '#0052ff', secondary: '#4b5563', danger: '#dc2626' }[variant],
}) as const;

function NoticeBox({ n }: { n: Notice }) {
  if (!n) return null;
  const color = n.kind === 'ok' ? '#059669' : n.kind === 'error' ? '#dc2626' : '#0052ff';
  return <p style={{ margin: '1rem 0 0', fontWeight: 600, fontSize: 14, color }}>{n.text}</p>;
}

export default function App() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [balance, setBalance] = useState('0');
  const [deployed, setDeployed] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<Notice>(null);
  const [sendNotice, setSendNotice] = useState<Notice>(null);
  const [deviceNotice, setDeviceNotice] = useState<Notice>(null);
  const [lastTx, setLastTx] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [signerId, setSignerId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newWhere, setNewWhere] = useState<'this' | 'other'>('other');
  const [removeX, setRemoveX] = useState('');
  
  // Connect to existing wallet state
  const [existingAddress, setExistingAddress] = useState('');
  const [connectNotice, setConnectNotice] = useState<Notice>(null);

  const persist = (next: Stored | null) => {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
    setStored(next);
  };

  const refresh = async (s: Stored | null = stored) => {
    if (!s) return;
    try {
      const [bal, code] = await Promise.all([
        publicClient.getBalance({ address: s.address }),
        publicClient.getCode({ address: s.address }),
      ]);
      const isDeployed = !!code && code !== '0x';
      setBalance(formatEther(bal));
      setDeployed(isDeployed);

      const entries = await Promise.all(s.devices.map(async (d): Promise<[string, boolean]> => {
        if (!isDeployed) return [d.credId, d.x === s.initial.x];
        const y = await publicClient.readContract({
          address: s.address, abi: passkeysAbi, functionName: 'passkeys', args: [BigInt(d.x)],
        });
        return [d.credId, y !== 0n];
      }));
      const map = Object.fromEntries(entries);
      setActive(map);
      setSignerId((cur) => (cur && map[cur] ? cur : s.devices.find((d) => map[d.credId])?.credId ?? ''));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const s = loadStored();
    setStored(s);
    if (s) refresh(s);
  }, []);

  async function run(key: string, setN: (n: Notice) => void, fn: (say: (t: string) => void) => Promise<string | void>) {
    if (busy) return;
    setBusy(key);
    setN(null);
    try {
      const msg = await fn((t) => setN({ kind: 'info', text: t }));
      setN(msg ? { kind: 'ok', text: msg } : null);
    } catch (e: any) {
      console.error(e);
      setN({ kind: 'error', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  async function sendWithDevice(d: Device, to: Address, value: bigint, say: (t: string) => void) {
    if (!stored) throw new Error('No wallet.');
    const account = await toPasskeyAccount({
      ownerX: BigInt(d.x),
      initial: { x: BigInt(stored.initial.x), y: BigInt(stored.initial.y) },
      address: stored.address,
      credentialId: d.credId,
      onStatus: say,
    });

    const client = createSmartAccountClient({
      account, chain: baseSepolia, bundlerTransport: http(pimlicoUrl), paymaster: pimlicoClient,
      userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
    });

    say('Sending (gas is paid by the Paymaster)…');
    const hash = await client.sendTransaction({ to, value, data: '0x' });
    await publicClient.waitForTransactionReceipt({ hash });
    setLastTx(hash);
    await refresh();
    return hash;
  }

  // ----- actions -----
  const createWallet = () => run('create', setWalletNotice, async (say) => {
    say('Creating your passkey…');
    const c = await createCredential('this');
    const address = (await publicClient.readContract({
      address: FACTORY_ADDRESS, abi: factoryAbi, functionName: 'getAddress',
      args: [[c.x], [c.y], GUARDIAN_ADDRESS, 0n],
    })) as Address;

    const s: Stored = {
      address, initial: { x: c.x.toString(), y: c.y.toString() },
      devices: [{ credId: c.credId, label: 'Primary device', x: c.x.toString(), y: c.y.toString(), addedAt: new Date().toISOString() }],
    };
    persist(s);
    await refresh(s);
    return 'Wallet created. Send some Base Sepolia ETH to the address below to use it.';
  });

  const connectToExistingWallet = () => run('connect', setConnectNotice, async (say) => {
    if (!isAddress(existingAddress)) throw new Error('Enter a valid wallet address (0x…).');
    
    say('Creating a passkey for this device…');
    const c = await createCredential('this');
    
    say('Passkey created. Now authorize it with the Guardian…');
    await guardianCall(existingAddress as Address, encodeFunctionData({
      abi: guardianAbi, functionName: 'addPasskey', args: [c.x, c.y],
    }));
    
    // We don't know the initial key, so we use the new device's key as initial
    // This works because the wallet is already deployed
    const s: Stored = {
      address: existingAddress as Address,
      initial: { x: c.x.toString(), y: c.y.toString() },
      devices: [{ credId: c.credId, label: 'Recovered device', x: c.x.toString(), y: c.y.toString(), addedAt: new Date().toISOString() }],
    };
    persist(s);
    await refresh(s);
    setExistingAddress('');
    return 'Connected! You can now use this device to access the wallet.';
  });

  const sendFunds = () => run('send', setSendNotice, async (say) => {
    const d = stored?.devices.find((x) => x.credId === signerId);
    if (!stored || !d) throw new Error('Choose a device to sign with.');
    if (!isAddress(recipient)) throw new Error('Enter a valid recipient address (0x…).');
    const value = parseEther(amount || '0');
    if (value <= 0n) throw new Error('Enter an amount greater than 0.');
    if (value > parseEther(balance)) throw new Error(`The wallet only holds ${balance} ETH.`);
    await sendWithDevice(d, recipient, value, say);
    return 'Sent. The Paymaster paid the gas.';
  });

  const testDevice = (d: Device) => run(`test:${d.credId}`, setDeviceNotice, async (say) => {
    if (!stored) return;
    await sendWithDevice(d, stored.address, 0n, say);
    return `"${d.label}" signed a transaction successfully.`;
  });

  const addDevice = () => run('add', setDeviceNotice, async (say) => {
    if (!stored) return;
    say(newWhere === 'other' ? 'Scan the QR code with your phone…' : 'Creating a passkey on this device…');
    const c = await createCredential(newWhere);
    if (stored.devices.some((d) => d.x === c.x.toString())) throw new Error('That passkey is already in the list.');
    
    const device: Device = {
      credId: c.credId, label: newLabel.trim() || `Device ${stored.devices.length + 1}`,
      x: c.x.toString(), y: c.y.toString(), addedAt: new Date().toISOString(),
    };
    const next = { ...stored, devices: [...stored.devices, device] };
    persist(next);
    await refresh(next);
    setNewLabel('');
    return 'Passkey created. Next, authorize it with the Guardian.';
  });

  const authorizeDevice = (d: Device) => run(`auth:${d.credId}`, setDeviceNotice, async (say) => {
    if (!stored) return;
    if (!deployed) throw new Error('Send one transaction first. The wallet is created on its first transaction.');
    say('Confirm in MetaMask (Guardian account)…');
    await guardianCall(stored.address, encodeFunctionData({ abi: guardianAbi, functionName: 'addPasskey', args: [BigInt(d.x), BigInt(d.y)] }));
    await refresh();
    return `"${d.label}" is now authorized.`;
  });

  const removeDevice = (xInput: string) => run('remove', setDeviceNotice, async (say) => {
    if (!stored) return;
    const x = parseCoordinate(xInput);
    if (!deployed) throw new Error('The wallet is not created yet.');
    if (!window.confirm('Remove this passkey?\n\nThe Guardian must approve. If it is your only active passkey you will lose access.')) return;
    say('Confirm in MetaMask (Guardian account)…');
    await guardianCall(stored.address, encodeFunctionData({ abi: guardianAbi, functionName: 'removePasskey', args: [x] }));
    const next = { ...stored, devices: stored.devices.filter((d) => BigInt(d.x) !== x) };
    persist(next);
    await refresh(next);
    setRemoveX('');
    return 'Passkey removed.';
  });

  const forgetWallet = () => {
    if (!window.confirm('Forget this wallet in this browser?\n\nThe wallet stays on-chain, but this app will lose the saved passkey details.')) return;
    ['passkeyWallet', 'devices', 'recoveryDevice'].forEach((k) => localStorage.removeItem(k));
    persist(null);
    setBalance('0'); setDeployed(false); setActive({}); setLastTx('');
  };

  const activeDevices = stored?.devices.filter((d) => active[d.credId]) ?? [];

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', color: '#111827' }}>
      <h1 style={{ marginBottom: 4, fontSize: 24 }}>Passkey wallet</h1>
      <p style={{ ...ui.muted, marginTop: 0, marginBottom: '2rem' }}>Sign in with your fingerprint or face. No seed phrase, no gas fees.</p>

      {!stored ? (
        <>
          <div style={{ ...ui.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
            <h3 style={ui.h3}>Create a new wallet</h3>
            <p style={ui.muted}>Your device creates a passkey and the wallet address is derived from it.</p>
            <button onClick={createWallet} disabled={!!busy} style={btn('primary', !!busy)}>Create wallet with a passkey</button>
            <NoticeBox n={walletNotice} />
          </div>

          <div style={{ ...ui.card, textAlign: 'center', padding: '2rem 1.5rem' }}>
            <h3 style={ui.h3}>Connect to an existing wallet</h3>
            <p style={ui.muted}>If you already have a wallet, enter its address and authorize this device with the Guardian.</p>
            <input
              value={existingAddress}
              onChange={(e) => setExistingAddress(e.target.value)}
              placeholder="0x…"
              style={ui.input}
            />
            <button onClick={connectToExistingWallet} disabled={!!busy || !existingAddress} style={{ ...btn('secondary', !!busy || !existingAddress), marginTop: 12 }}>
              Connect with passkey
            </button>
            <NoticeBox n={connectNotice} />
          </div>
        </>
      ) : (
        <>
          {/* 1. Overview */}
          <div style={ui.card}>
            <h3 style={ui.h3}>Wallet</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={ui.muted}>Balance</div>
                <div style={{ fontSize: 30, fontWeight: 700 }}>{parseFloat(balance).toFixed(6)} ETH</div>
              </div>
              <button onClick={() => refresh()} style={btn('secondary', false, true)}>Refresh</button>
            </div>
            <div style={{ marginTop: 12, padding: '0.6rem 0.75rem', background: '#f9fafb', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
              {stored.address}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(stored.address)} style={btn('secondary', false, true)}>Copy address</button>
              <a href={`https://sepolia.basescan.org/address/${stored.address}`} target="_blank" rel="noreferrer" style={{ ...btn('secondary', false, true), textDecoration: 'none' }}>View on BaseScan</a>
            </div>
            <p style={{ ...ui.muted, marginBottom: 0 }}>
              {deployed
                ? 'Wallet is live on Base Sepolia.'
                : 'Not on-chain yet: it is created automatically by your first transaction.'}
            </p>
            <NoticeBox n={walletNotice} />
          </div>

          {/* 2. Send */}
          <div style={ui.card}>
            <h3 style={ui.h3}>Send funds (no gas fee)</h3>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>Recipient
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" style={ui.input} />
            </label>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginTop: 12 }}>Amount (ETH)
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.001" step="0.0001" style={ui.input} />
            </label>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginTop: 12 }}>Sign with
              <select value={signerId} onChange={(e) => setSignerId(e.target.value)} style={ui.input}>
                {activeDevices.length === 0 && <option value="">No active device</option>}
                {activeDevices.map((d) => <option key={d.credId} value={d.credId}>{d.label}</option>)}
              </select>
            </label>
            <button onClick={sendFunds} disabled={!!busy || !signerId} style={{ ...btn('primary', !!busy || !signerId), marginTop: 16, width: '100%' }}>
              {busy === 'send' ? 'Working…' : 'Send'}
            </button>
            <NoticeBox n={sendNotice} />
            {lastTx && (
              <p style={ui.muted}>Last transaction: <a href={`https://sepolia.basescan.org/tx/${lastTx}`} target="_blank" rel="noreferrer" style={{ color: '#0052ff', wordBreak: 'break-all' }}>{shortAddr(lastTx)}</a></p>
            )}
          </div>

          {/* 3. Devices */}
          <div style={ui.card}>
            <h3 style={{ ...ui.h3, marginBottom: 4 }}>Devices</h3>
            <p style={{ ...ui.muted, marginTop: 0 }}>Each device holds its own passkey. Only the Guardian can add or remove devices.</p>
            {stored.devices.map((d) => {
              const isActive = !!active[d.credId];
              return (
                <div key={d.credId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{d.label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#059669' : '#b45309' }}>
                      {isActive ? 'Active' : 'Not authorized yet'}
                    </span>
                  </div>
                  <div style={{ ...ui.muted, fontFamily: 'monospace', marginTop: 4 }}>X: {shortNum(d.x)}</div>
                  <div style={{ ...ui.muted, fontSize: 12 }}>Added {new Date(d.addedAt).toLocaleDateString()}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {!isActive && (
                      <button onClick={() => authorizeDevice(d)} disabled={!!busy} style={btn('primary', !!busy, true)}>Authorize with Guardian</button>
                    )}
                    {isActive && (
                      <button onClick={() => testDevice(d)} disabled={!!busy} style={btn('secondary', !!busy, true)}>Test signing</button>
                    )}
                    {isActive && deployed && (
                      <button onClick={() => removeDevice(d.x)} disabled={!!busy} style={btn('danger', !!busy, true)}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Add a device</h4>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name, e.g. My phone" style={ui.input} />
              <select value={newWhere} onChange={(e) => setNewWhere(e.target.value as 'this' | 'other')} style={ui.input}>
                <option value="other">On my phone or a security key (QR code)</option>
                <option value="this">On this device</option>
              </select>
              <button onClick={addDevice} disabled={!!busy} style={{ ...btn('primary', !!busy), marginTop: 12 }}>Create passkey</button>
            </div>
            <NoticeBox n={deviceNotice} />
            <details style={{ marginTop: 20 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Remove a device by its X coordinate</summary>
              <p style={{ ...ui.muted, color: '#b45309' }}>
                Use this for a device not in the list. The Guardian must approve.
              </p>
              <input value={removeX} onChange={(e) => setRemoveX(e.target.value)} placeholder="Full X coordinate (decimal or 0x…)" style={ui.input} />
              <button onClick={() => removeDevice(removeX)} disabled={!!busy || !removeX} style={{ ...btn('danger', !!busy || !removeX), marginTop: 12 }}>Remove with Guardian</button>
            </details>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={forgetWallet} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
              Forget this wallet in this browser
            </button>
          </div>
        </>
      )}
    </div>
  );
}