import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { DarkFiber, DarkFiber__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("DarkFiber")) as DarkFiber__factory;
  const contract = (await factory.deploy()) as DarkFiber;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("DarkFiber", function () {
  let signers: Signers;
  let contract: DarkFiber;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("stores encrypted messages with metadata", async function () {
    const oneTimeAddress = ethers.Wallet.createRandom().address;
    const cipherText = "v1:unit-test";

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(oneTimeAddress)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .sendMessage(signers.bob.address, cipherText, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const messageIds = await contract.getInbox(signers.bob.address);
    expect(messageIds.length).to.eq(1);
    expect(messageIds[0]).to.eq(0n);

    const message = await contract.getMessage(0);
    expect(message[0]).to.eq(signers.alice.address);
    expect(message[1]).to.eq(signers.bob.address);
    expect(message[2]).to.eq(cipherText);
    expect(message[3]).to.not.eq(ethers.ZeroHash);
    expect(message[4]).to.be.greaterThan(0);
  });

  it("increments message count", async function () {
    const oneTimeAddress = ethers.Wallet.createRandom().address;
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(oneTimeAddress)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .sendMessage(signers.bob.address, "v1:count-test", encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const count = await contract.getMessageCount();
    expect(count).to.eq(1n);
  });
});
