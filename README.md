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
