import { webcrypto } from "crypto";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const crypto = webcrypto;

function hexToBytes(hexValue: string): Uint8Array {
  const cleaned = hexValue.toLowerCase().replace(/^0x/, "");
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function deriveKey(addressKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest("SHA-256", hexToBytes(addressKey));
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptMessage(message: string, addressKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(addressKey);
  const encoded = new TextEncoder().encode(message);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the DarkFiber address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const deployment = await deployments.get("DarkFiber");

  console.log("DarkFiber address is " + deployment.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:send-message --to 0xabc... --message "hello"
 *   - npx hardhat --network sepolia task:send-message --to 0xabc... --message "hello"
 */
task("task:send-message", "Sends an encrypted message via DarkFiber")
  .addParam("to", "Recipient address")
  .addParam("message", "Plaintext message")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const deployment = await deployments.get("DarkFiber");
    const signers = await ethers.getSigners();
    const sender = signers[0];

    const contract = await ethers.getContractAt("DarkFiber", deployment.address);

    const oneTimeAddress = ethers.Wallet.createRandom().address;
    const cipherText = await encryptMessage(taskArguments.message, oneTimeAddress);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, sender.address)
      .addAddress(oneTimeAddress)
      .encrypt();

    const tx = await contract
      .connect(sender)
      .sendMessage(taskArguments.to, cipherText, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:read-message --id 0
 *   - npx hardhat --network sepolia task:read-message --id 0
 */
task("task:read-message", "Reads a message by id")
  .addParam("id", "Message id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = await deployments.get("DarkFiber");
    const contract = await ethers.getContractAt("DarkFiber", deployment.address);

    const messageId = BigInt(taskArguments.id);
    const message = await contract.getMessage(messageId);

    console.log(`Sender    : ${message[0]}`);
    console.log(`Recipient : ${message[1]}`);
    console.log(`Ciphertext: ${message[2]}`);
    console.log(`Key handle: ${message[3]}`);
    console.log(`Timestamp : ${message[4]}`);
  });
