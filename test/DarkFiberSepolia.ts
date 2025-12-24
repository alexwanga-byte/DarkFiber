import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { DarkFiber } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("DarkFiberSepolia", function () {
  let signers: Signers;
  let contract: DarkFiber;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("DarkFiber");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("DarkFiber", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("sends and reads a message", async function () {
    steps = 9;

    this.timeout(4 * 40000);

    const oneTimeAddress = ethers.Wallet.createRandom().address;

    progress("Encrypting one-time address...");
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(oneTimeAddress)
      .encrypt();

    progress("Sending encrypted message...");
    const tx = await contract
      .connect(signers.alice)
      .sendMessage(signers.bob.address, "v1:sepolia-test", encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress("Reading inbox ids...");
    const inbox = await contract.getInbox(signers.bob.address);
    expect(inbox.length).to.be.greaterThan(0);

    const messageId = inbox[inbox.length - 1];
    progress(`Reading message ${messageId.toString()}...`);
    const message = await contract.getMessage(messageId);

    expect(message[1]).to.eq(signers.bob.address);
    expect(message[2]).to.eq("v1:sepolia-test");
    expect(message[3]).to.not.eq(ethers.ZeroHash);
  });
});
