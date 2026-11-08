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