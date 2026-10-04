const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ParticipantRegistry", function () {
  async function deployFixture() {
    const [admin, shipper, transporter, warehouse, inspector, receiver, oracle, outsider] =
      await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    return { registry, admin, shipper, transporter, warehouse, inspector, receiver, oracle, outsider };
  }

  // ── FR-ROL-01: Admin registers participants ──

  describe("FR-ROL-01: Registration", function () {
    it("deployer is auto-registered as Admin", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.roleOf(admin.address)).to.equal(1); // Role.Admin
      expect(await registry.isActive(admin.address)).to.be.true;
    });

    it("emits ParticipantRegistered on deploy", async function () {
      const [admin] = await ethers.getSigners();
      const Registry = await ethers.getContractFactory("ParticipantRegistry");
      const tx = Registry.deploy();
      // Check event is emitted at construction
      const registry = await tx;
      const filter = registry.filters.ParticipantRegistered;
      const events = await registry.queryFilter(filter);
      expect(events.length).to.be.gte(1);
      expect(events[0].args.participant).to.equal(admin.address);
    });

    it("Admin registers a Shipper", async function () {
      const { registry, admin, shipper } = await loadFixture(deployFixture);
      await expect(registry.registerParticipant(shipper.address, 2)) // Role.Shipper
        .to.emit(registry, "ParticipantRegistered")
        .withArgs(shipper.address, 2, admin.address);

      expect(await registry.roleOf(shipper.address)).to.equal(2);
      expect(await registry.isActive(shipper.address)).to.be.true;
    });

    it("Admin registers all canonical roles", async function () {
      const { registry, shipper, transporter, warehouse, inspector, receiver, oracle } =
        await loadFixture(deployFixture);

      await registry.registerParticipant(shipper.address, 2);     // Shipper
      await registry.registerParticipant(transporter.address, 3); // Transporter
      await registry.registerParticipant(warehouse.address, 4);   // Warehouse
      await registry.registerParticipant(inspector.address, 5);   // Inspector
      await registry.registerParticipant(receiver.address, 6);    // Receiver
      await registry.registerParticipant(oracle.address, 7);      // Oracle

      expect(await registry.participantCount()).to.equal(7); // 6 + admin
    });

    it("reverts on non-Admin registration", async function () {
      const { registry, shipper, outsider } = await loadFixture(deployFixture);
      await expect(
        registry.connect(shipper).registerParticipant(outsider.address, 2)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts on duplicate registration", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(
        registry.registerParticipant(shipper.address, 3)
      ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    });

    it("reverts on Role.None registration", async function () {
      const { registry, outsider } = await loadFixture(deployFixture);
      await expect(
        registry.registerParticipant(outsider.address, 0)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts on zero address", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(
        registry.registerParticipant(ethers.ZeroAddress, 2)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });
  });

  // ── FR-ROL-02: Admin revokes participant ──

  describe("FR-ROL-02: Revocation", function () {
    it("Admin revokes a participant", async function () {
      const { registry, admin, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(registry.revokeParticipant(shipper.address))
        .to.emit(registry, "ParticipantRevoked")
        .withArgs(shipper.address, 2, admin.address);

      expect(await registry.isActive(shipper.address)).to.be.false;
      expect(await registry.roleOf(shipper.address)).to.equal(2); // role preserved
    });

    it("reverts on non-Admin revocation", async function () {
      const { registry, shipper, transporter } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(
        registry.connect(shipper).revokeParticipant(shipper.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts on revoking unregistered address", async function () {
      const { registry, outsider } = await loadFixture(deployFixture);
      await expect(
        registry.revokeParticipant(outsider.address)
      ).to.be.revertedWithCustomError(registry, "NotRegistered");
    });

    it("reverts on self-revoke by Admin", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      await expect(
        registry.revokeParticipant(admin.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts on revoking already-revoked participant", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await registry.revokeParticipant(shipper.address);
      await expect(
        registry.revokeParticipant(shipper.address)
      ).to.be.revertedWithCustomError(registry, "InactiveParticipant");
    });
  });

  // ── FR-ROL-03: Enforce role and active status ──

  describe("FR-ROL-03: Role enforcement helpers", function () {
    it("requireRole passes for active participant with correct role", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(registry.requireRole(shipper.address, 2)).to.not.be.reverted;
    });

    it("requireRole reverts for wrong role", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(
        registry.requireRole(shipper.address, 3) // Transporter
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("requireRole reverts for inactive participant", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await registry.revokeParticipant(shipper.address);
      await expect(
        registry.requireRole(shipper.address, 2)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("requireActiveParticipant passes for active", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await expect(registry.requireActiveParticipant(shipper.address)).to.not.be.reverted;
    });

    it("requireActiveParticipant reverts for inactive", async function () {
      const { registry, shipper } = await loadFixture(deployFixture);
      await registry.registerParticipant(shipper.address, 2);
      await registry.revokeParticipant(shipper.address);
      await expect(
        registry.requireActiveParticipant(shipper.address)
      ).to.be.revertedWithCustomError(registry, "InactiveParticipant");
    });
  });
});
