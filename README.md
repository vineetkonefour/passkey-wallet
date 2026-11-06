# Passkey-Based Smart Wallet (ERC-4337)

## Project Overview
A college PBL project building a smart contract wallet that uses **Passkeys (WebAuthn/P-256)** for everyday transaction signing, eliminating the need for seed phrases. It leverages **ERC-4337 Account Abstraction** for gasless transactions and MetaMask strictly for account recovery.

## Tech Stack
- **Frontend:** React, Vite, TypeScript, viem, permissionless.js, @simplewebauthn/browser
- **Smart Contracts:** Solidity, Foundry
- **Network:** Base Sepolia (Testnet)
- **Infrastructure:** Alchemy (RPC), Pimlico (Bundler/Paymaster)
- **Cryptography:** RIP-7212 Precompile (native P-256 verification on Base)

## Architecture
- **Framework:** Custom ERC-4337 v0.7 Smart Account.
- **Authentication:** Passkeys (P-256/WebAuthn) for daily transaction signing.
- **Recovery:** MetaMask acts strictly as a recovery guardian (frontend-enforced for project scope).
- **Signature Verification:** Uses the native **RIP-7212 precompile** at `0x0000000000000000000000000000000000000100` on Base Sepolia for gas-efficient P-256 signature validation.

## How It Works
1. **Key Generation:** The user's phone generates a P-256 keypair via WebAuthn. The **public key** (`ownerX`, `ownerY`) is stored on-chain in the smart contract. The **private key** never leaves the device.
2. **Transaction Signing:** When the user initiates a transaction, the phone signs it with the private key, producing a digital signature (`r`, `s`).
3. **Validation:** The smart contract's `validateUserOp` function uses the RIP-7212 precompile to verify that the signature mathematically matches the stored public key.
4. **Execution:** If valid, the `execute` function forwards the transaction to the target address.

## Current Progress
- [x] **Milestone 1:** Development environment setup (Foundry, React/Vite) and verified Base Sepolia deployment pipeline.
- [x] **Milestone 2:** Installed core ERC-4337 v0.7 (`account-abstraction`) and P-256 (`p256-verifier`) libraries. Configured Foundry `viaIR` optimizer and remappings.
- [x] **Milestone 3:** Implemented `PasskeyWallet.sol` with:
  - RIP-7212 precompile integration for native P-256 signature verification
  - `validateUserOp` function for ERC-4337 EntryPoint validation
  - `execute` function for forwarding transactions to target addresses

## Next Steps (Milestone 4)
- [ ] Integrate `@simplewebauthn/browser` in the React frontend.
- [ ] Build "Create Passkey Wallet" flow that generates the P-256 keypair via WebAuthn.
- [ ] Deploy the `PasskeyWallet` contract from the frontend using the generated public key.
- [ ] Implement transaction signing flow using the phone's biometric authentication.

## Security Model
- The smart contract is a **personal vault**, not a public application.
- Only the holder of the matching private key (stored securely on the user's device) can authorize transactions.
- The blockchain network (Base Sepolia) is public, but the contract's validation logic ensures only the owner can move funds.
