# Passkey-Based Smart Wallet (ERC-4337)

## Project Overview
A college PBL project building a smart contract wallet that uses Passkeys (WebAuthn/P-256) for everyday transaction signing, eliminating the need for seed phrases. It leverages ERC-4337 Account Abstraction for gasless transactions and MetaMask strictly for account recovery.

## Tech Stack
- **Frontend:** React, Vite, TypeScript, viem, permissionless.js
- **Smart Contracts:** Solidity, Foundry
- **Network:** Base Sepolia (Testnet)
- **Infrastructure:** Alchemy (RPC), Pimlico (Bundler/Paymaster)

## Approved Architecture
- **Framework:** Existing ERC-4337 Smart Account framework (v0.7).
- **Authentication:** Passkeys (P-256/WebAuthn) for daily transaction signing.
- **Recovery:** MetaMask acts strictly as a recovery guardian. (Enforced at the frontend level for this project scope).
- **Cryptography:** `p256-verifier` library utilizing RIP-7212 precompiles on Base Sepolia for efficient signature validation.

## Current Progress
- [x] **Milestone 1:** Development environment setup (Foundry, React/Vite) and verified Base Sepolia deployment pipeline.
- [x] **Milestone 2:** Installed core ERC-4337 v0.7 (`account-abstraction`) and P-256 (`p256-verifier`) libraries. Configured Foundry `viaIR` optimizer and remappings.

## Next Steps (Milestone 3)
- [ ] Implement the core Passkey Smart Account contract (`validateUserOp` with P-256 signature verification).
- [ ] Write deployment scripts for the new Smart Account.
- [ ] Integrate WebAuthn/Passkey creation and signing on the frontend.
