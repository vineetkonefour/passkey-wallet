<<<<<<< HEAD
# 🔑 Passkey Wallet (ERC-4337 Smart Account)

A fully functional, gasless Smart Contract Wallet leveraging **WebAuthn (Passkeys)** for secure, hardware-bound authentication and **ERC-4337 Account Abstraction** for a seamless, seedless user experience.

## 🌟 Key Features

- **🔐 True WebAuthn Integration:** Extracts real, hardware-bound P-256 elliptic curve public keys (X and Y coordinates) directly from device secure enclaves (Windows Hello, Apple FaceID/TouchID).
- **📱 Multi-Device Support:** The smart contract maintains a mapping of authorized devices, allowing users to access their wallet from multiple trusted devices simultaneously.
- **🛡️ Guardian Recovery:** A designated MetaMask address acts as an admin "Guardian." It cannot spend funds, but it can add or remove devices in case a phone is lost or stolen.
- **⛽ Gasless Transactions:** Integrated with **Pimlico** (ERC-4337 v0.7) to sponsor gas fees, allowing users to interact with the wallet without ever needing to hold ETH.

## 🏗️ Architecture: How It Works

This project separates concerns into three distinct entities to maximize security and user experience:

1. **The Vault (Smart Contract):** Lives on the blockchain. It holds the funds and the list of authorized Public Keys (X, Y coordinates). It has *no* private key of its own.
2. **The Passkeys (Devices):** The user's phone or PC. The secure hardware chip generates a P-256 keypair. The Private Key *never leaves the device*. The device uses it to sign transactions, which the Vault verifies against its stored Public Key list.
3. **The Guardian (MetaMask):** The emergency recovery key. It is completely bypassed during daily transactions. It only wakes up to authorize changes to the device list (e.g., removing a lost phone).

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity ^0.8.28, Foundry (Forge, Cast)
- **Frontend:** React, Vite, TypeScript
- **Web3 Libraries:** `viem`, `permissionless` (v0.5.x, ERC-4337 v0.7)
- **Cryptography:** `cbor-web` (for parsing WebAuthn attestation objects), Native Web Crypto API
- **Infrastructure:** Pimlico (Bundler & Paymaster), Base Sepolia Testnet

## 🚀 Live Deployment & Proof

This project is deployed and verified on the **Base Sepolia** testnet.

- **Passkey Wallet Contract:** [0x1a9Da4dc88a2D3DBDF39f4877cAD4C623B23F1C2](https://sepolia.basescan.org/address/0x1a9Da4dc88a2D3DBDF39f4877cAD4C623B23F1C2)
- **Test Smart Account Address:** `0x3070CFf12E0f1C1790130a3cF17436321EB4aB8a`
- **Successful Gasless Transaction:** [0x2894a6b387bb4d56d7e4491e1da2bd68de8ebde952a2c3d5bee9c03344ac8f89](https://sepolia.basescan.org/tx/0x2894a6b387bb4d56d7e4491e1da2bd68de8ebde952a2c3d5bee9c03344ac8f89)  
  *(Note: Check the transaction details on BaseScan to see that the Paymaster sponsored the gas fee, and the sender paid 0 ETH).*

## 💡 Challenges Overcome & Lessons Learned

Building this required solving several non-trivial Web3 and WebAuthn edge cases:

1. **WebAuthn Localhost Timeouts:** Browsers strictly enforce secure contexts for WebAuthn. Forcing `platform` authenticators on `http://localhost` often resulted in `NotAllowedError` timeouts. This was solved by utilizing Chrome's DevTools Virtual Authenticator and `cross-platform` QR-code flows to reliably extract the raw P-256 coordinates.
2. **Binary Parsing in the Browser:** Extracting the X and Y coordinates from the WebAuthn `attestationObject` requires parsing CBOR-encoded binary data. Standard Node.js `Buffer` is unavailable in Vite. This was solved by writing custom `base64url` to `Uint8Array` conversion utilities and manually traversing the `authData` byte offsets.
3. **Permissionless API Shifts:** The `permissionless` library underwent significant API changes between versions. The deprecated `middleware` syntax silently failed, causing `undefined` gas fee errors. This was resolved by adopting the modern v0.5.x syntax, explicitly defining `entryPoint07Address`, and using the `userOperation.estimateFeesPerGas` configuration.

## 📦 How to Run Locally

**1. Clone the repository:**

```bash
git clone <your-repo-url>
cd passkey-wallet
```

**2. Install dependencies:**

```bash
# Install Foundry dependencies
forge install

# Install frontend dependencies
cd frontend
npm install --legacy-peer-deps
```

**3. Set up Environment Variables:**

Create a `.env` file in the `frontend` directory:

```env
VITE_PIMLICO_API_KEY=your_pimlico_api_key_here
```

**4. Run the development server:**

```bash
npm run dev
```

**5.** Open `http://localhost:5173` in your browser to test the Passkey generation and Paymaster integration.
=======
# Passkey Wallet (ERC-4337 Smart Account)

A decentralized, passkey-based smart contract wallet built on Base Sepolia. This project implements the ERC-4337 Account Abstraction standard, allowing users to secure their funds using WebAuthn (FaceID/Fingerprint) instead of traditional seed phrases. It features multi-device support and a MetaMask Guardian recovery flow.

## 🌟 Features

### ✅ Completed
- **ERC-4337 Smart Wallet:** Fully compliant `IAccount` implementation with `validateUserOp` and `execute` functions.
- **P-256 Passkey Verification:** On-chain signature verification using the RIP-7212 precompile (`0x...100`).
- **Multi-Device Support:** Smart contract architecture supports registering multiple passkey devices to a single wallet.
- **Guardian Recovery Flow:** A dedicated MetaMask "Guardian" address can add or remove passkeys in case of device loss.
- **Live Deployment:** V2 Smart Contract successfully deployed to Base Sepolia testnet.

### ⏳ In Progress / Pending
- **Real Key Extraction:** Updating the React frontend to extract actual P-256 public key coordinates from the WebAuthn response.
- **Frontend Deployment:** Integrating `viem` and `permissionless.js` to deploy the contract directly from the UI.
- **Paymaster Integration:** Integrating Pimlico/Alchemy to sponsor gas fees for gasless transactions.
- **Recovery UI:** Building the frontend interface for the Guardian to manage devices.

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity 0.8.28, Foundry
- **Frontend:** React, Vite, TypeScript, `@simplewebauthn/browser`
- **Account Abstraction:** `viem`, `permissionless.js`, ERC-4337 v0.7
- **Network:** Base Sepolia (Chain ID: 84532)

## 📐 Architecture

1. **User:** Initiates a transaction using their device's biometric authentication (Passkey).
2. **Frontend:** Generates a `UserOperation` and sends it to the Bundler.
3. **Bundler (Pimlico/Alchemy):** Bundles the `UserOp` and sends it to the EntryPoint contract.
4. **EntryPoint:** Calls `validateUserOp` on the PasskeyWallet.
5. **PasskeyWallet:** Verifies the P-256 signature via the RIP-7212 precompile. If valid, it executes the transaction.

## 📍 Deployment Details

- **Network:** Base Sepolia
- **Contract Address:** `0x0766D624aAf404aE50936a4b34f9Dd6D9e498440`
- **Guardian Address:** `0x69D0B674C889Cb9977eDf5771aAC538B6c3D26b1`
- **BaseScan Link:** [View on BaseScan](https://sepolia.basescan.org/address/0x0766D624aAf404aE50936a4b34f9Dd6D9e498440)

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- Foundry (Forge, Cast, Anvil)
- MetaMask Browser Extension

### Smart Contract (Foundry)
```bash
# Install dependencies
forge install

# Build the contracts
forge build

# Deploy to Base Sepolia
forge script script/DeployPasskeyWallet.s.sol:DeployPasskeyWallet --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --legacy