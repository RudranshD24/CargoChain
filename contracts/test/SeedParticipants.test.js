const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { seedParticipants, ROLE_CONFIG, ROLE_NAMES } = require("../scripts/seed_participants");

describe("SeedParticipants Script Unit Test", function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await ParticipantRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();

    return { registry, registryAddress, signers, admin: signers[0] };
  }

  it("seeds accounts 1-6 with correct canonical roles and leaves account 7 unregistered", async function () {
    const { registry, registryAddress, signers, admin } = await loadFixture(deployFixture);

    // Initial check: only Admin is registered
    expect(await registry.roleOf(admin.address)).to.equal(1); // Role.Admin
    for (let i = 1; i <= 7; i++) {
      expect(await registry.roleOf(signers[i].address)).to.equal(0); // Role.None
    }

    // Run seedParticipants
    const { finalTable } = await seedParticipants(registryAddress, admin, signers);

    // Verify roles on contract
    expect(await registry.roleOf(signers[0].address)).to.equal(1); // Admin
    expect(await registry.roleOf(signers[1].address)).to.equal(2); // Shipper
    expect(await registry.roleOf(signers[2].address)).to.equal(3); // Transporter
    expect(await registry.roleOf(signers[3].address)).to.equal(4); // Warehouse
    expect(await registry.roleOf(signers[4].address)).to.equal(5); // Inspector
    expect(await registry.roleOf(signers[5].address)).to.equal(6); // Receiver
    expect(await registry.roleOf(signers[6].address)).to.equal(7); // Oracle
    expect(await registry.roleOf(signers[7].address)).to.equal(0); // None (outsider)

    // Verify active status
    for (let i = 0; i <= 6; i++) {
      expect(await registry.isActive(signers[i].address)).to.be.true;
    }
    expect(await registry.isActive(signers[7].address)).to.be.false;

    // Verify participant count is 7 (Admin + 6 registered)
    expect(await registry.participantCount()).to.equal(7);
  });

  it("is idempotent: re-running does not revert and maintains roles", async function () {
    const { registry, registryAddress, signers, admin } = await loadFixture(deployFixture);

    // First run
    await seedParticipants(registryAddress, admin, signers);

    // Second run
    const { finalTable } = await seedParticipants(registryAddress, admin, signers);

    // Verify all actions for accounts 1-6 are "Already Registered (Skipped)"
    for (let i = 1; i <= 6; i++) {
      const entry = finalTable.find((row) => row.Account === `Account ${i}`);
      expect(entry.Action).to.equal("Already Registered (Skipped)");
    }

    // Account 7 remains left unregistered
    const outsiderEntry = finalTable.find((row) => row.Account === "Account 7");
    expect(outsiderEntry.Role).to.equal("None");
    expect(outsiderEntry.Active).to.equal("No");
    expect(await registry.roleOf(signers[7].address)).to.equal(0);
  });
});
