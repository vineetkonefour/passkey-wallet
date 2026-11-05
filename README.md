# Passkey-Based Smart Wallet (ERC-4337)

## Project Overview
A college PBL project building a smart contract wallet that uses Passkeys (WebAuthn/P-256) for everyday transaction signing, eliminating the need for seed phrases. It leverages ERC-4337 Account Abstraction for gasless transactions and MetaMask for account recovery.

## Tech Stack
- **Frontend:** React, Vite, TypeScript, viem, permissionless.js
- **Smart Contracts:** Solidity, Foundry
- **Network:** Base Sepolia (Testnet)
- **Infrastructure:** Alchemy (RPC), Pimlico (Bundler/Paymaster)

## Approved Architecture
- **Framework:** Existing ERC-4337 Smart Account framework (Coinbase Smart Wallet).
- **Authentication:** Passkeys (P-256/WebAuthn) for daily transactions.
- **Recovery:** MetaMask acts strictly as a recovery guardian. (Note: Enforced at the frontend level for this project scope).
- **ERC-4337 Version:** v0.7.

## Current Progress
- [x] Development environment setup (Foundry, React/Vite).
- [x] Frontend Vite server and HMR verified.
- [x] Smart contract deployment pipeline verified.
- [x] Successfully deployed test contract to Base Sepolia.
  - **Contract Address:** `0xa79997c2aEE3D0309F3769e7eb290F39578b4268`
  - **Tx Hash:** `0xec3500a749258bd5b4f32a0039c39e3f84edc8bdc5921531a6545445feb6eef8`

## Next Steps (Milestone 2)
- Clean up test boilerplate.
- Install core ERC-4337 and P-256/WebAuthn verification libraries.
- Begin Smart Account implementation.