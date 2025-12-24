# DarkFiber

DarkFiber is a confidential messaging dApp that uses Zama FHEVM to protect message keys on-chain while keeping message
content encrypted end-to-end in the client. Users send ciphertexts on-chain and share the encryption key via FHE user
decryption, so only the intended recipient can unlock the key and reveal the plaintext.

## Why this exists

Public blockchains are transparent by default. That makes private messaging, secure coordination, or sensitive sharing
hard without introducing a trusted server. DarkFiber solves this by keeping the message ciphertext public but the
message key confidential, using FHE to gate access to the key.

## What problem it solves

- Confidential messaging on a public chain without a centralized server.
- On-chain auditability of message delivery (sender, recipient, timestamp) without leaking plaintext.
- Trust-minimized key sharing: only the recipient can decrypt the key with Zama's FHE infrastructure.

## How it works (end-to-end flow)

1. The sender writes a message in the UI or via a Hardhat task.
2. A random one-time address is generated and hashed with SHA-256 to derive an AES-GCM key.
3. The plaintext is encrypted locally with AES-GCM, producing a payload like `v1:<iv>:<ciphertext>`.
4. The one-time address is encrypted as an FHE `eaddress` using the Zama Relayer SDK.
5. The contract stores:
   - `cipherText` (public string)
   - `encryptedKey` (FHE ciphertext handle)
   - sender, recipient, and timestamp (public metadata)
6. The contract grants FHE ACL permissions to the sender and recipient.
7. The recipient requests user decryption via the Relayer, receives the one-time address key, and decrypts the message
   locally in the browser.

## Advantages

- **Confidential message content**: plaintext never touches the chain.
- **Trust-minimized key sharing**: FHE protects the encryption key until the recipient decrypts it.
- **No centralized backend**: all delivery state is on-chain.
- **Clear audit trail**: message delivery and timestamps are verifiable.
- **Simple client crypto**: AES-GCM + Web Crypto for fast, browser-native encryption.
- **Composable**: standard EVM contract, compatible with on-chain indexing and analytics.

## Tech stack

- **Smart contracts**: Solidity 0.8.27 + Zama FHEVM (`@fhevm/solidity`)
- **Framework**: Hardhat + hardhat-deploy + TypeChain
- **Frontend**: React + Vite
- **Wallet / networking**: wagmi + RainbowKit
- **Reads**: viem
- **Writes**: ethers v6
- **Relayer**: `@zama-fhe/relayer-sdk/bundle`
- **Crypto**: Web Crypto (AES-GCM, SHA-256)

## Project structure

```
contracts/               DarkFiber contract (FHE key storage)
deploy/                  Hardhat deployment scripts
tasks/                   Hardhat tasks for send/read
test/                    Local + Sepolia test suites
docs/                    Zama FHEVM / Relayer notes
ui/                      React + Vite frontend
```

## Contract overview

`DarkFiber.sol` stores message metadata and the encrypted key:

- `sendMessage(...)` writes the message and grants FHE ACL access.
- `getInbox(recipient)` returns message ids for a recipient.
- `getMessage(id)` returns metadata, ciphertext, and encrypted key handle.
- `getMessageCount()` returns total messages.

## Setup

### Prerequisites

- Node.js 20+
- npm
- A Sepolia wallet with test ETH
- Infura API key (for Sepolia RPC)

### Install dependencies

```bash
npm install
```

### Configure environment (Hardhat only)

Create a `.env` in the repo root:

```
INFURA_API_KEY=your_key
PRIVATE_KEY=0xyour_private_key
ETHERSCAN_API_KEY=optional_key
```

Notes:
- The project uses `PRIVATE_KEY` only. Do not use mnemonics.
- The frontend does not use environment variables.

## Compile and test

```bash
npm run compile
npm run test
```

For Sepolia (after deployment):

```bash
npx hardhat test --network sepolia
```

## Deploy

Local Hardhat node:

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

Sepolia:

```bash
npx hardhat deploy --network sepolia
```

Optional verification:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend setup

1. Install UI dependencies:

   ```bash
   cd ui
   npm install
   ```

2. Update the contract config:

   - Set the deployed address in `ui/src/config/contracts.ts`.
   - Copy the ABI from `deployments/sepolia/DarkFiber.json` into `ui/src/config/contracts.ts`.

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. In the wallet, select Sepolia and connect.

## Hardhat tasks

- Print contract address:
  ```bash
  npx hardhat --network sepolia task:address
  ```
- Send a message:
  ```bash
  npx hardhat --network sepolia task:send-message --to 0xRecipient --message "hello"
  ```
- Read a message:
  ```bash
  npx hardhat --network sepolia task:read-message --id 0
  ```

## Security and privacy notes

- `cipherText` is public on-chain; secrecy depends on the one-time key.
- Sender, recipient, and timestamp are public metadata.
- The encrypted key is stored as an FHE ciphertext and can only be decrypted by authorized users.
- AES-GCM provides confidentiality and integrity for the payload.
- Keys are generated and used entirely in the client; no local storage is used.

## Known limitations

- Large messages increase gas costs because ciphertexts are stored on-chain.
- Messages are immutable and cannot be deleted once written.
- Metadata privacy is not provided (addresses and timestamps are public).
- No indexing server is included; UI reads directly from the chain.

## Future plans

- Message pagination and lightweight indexing for larger inboxes.
- Optional message expiry and retention policies.
- Multi-recipient messages and group threads.
- Reduced metadata exposure (encrypted sender aliases or metadata packing).
- Gas optimizations for batched message sends.
- Additional network targets once FHEVM support expands.
- UX improvements around decryption status and retry handling.

## Documentation

- Zama FHEVM notes: `docs/zama_llm.md`
- Relayer SDK notes: `docs/zama_doc_relayer.md`

## License

BSD-3-Clause-Clear. See `LICENSE`.
