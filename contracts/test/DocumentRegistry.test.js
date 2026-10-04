const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("DocumentRegistry", function () {
  async function fullFixture() {
    const [admin, shipper, transporter, warehouse, inspector, receiver, outsider] =
      await ethers.getSigners();

    // 1. ParticipantRegistry
    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    await registry.registerParticipant(shipper.address, 2);      // Shipper
    await registry.registerParticipant(transporter.address, 3);  // Transporter
    await registry.registerParticipant(warehouse.address, 4);    // Warehouse
    await registry.registerParticipant(inspector.address, 5);    // Inspector
    await registry.registerParticipant(receiver.address, 6);     // Receiver

    // 2. ShipmentRegistry
    const ShipmentReg = await ethers.getContractFactory("ShipmentRegistry");
    const shipmentRegistry = await ShipmentReg.deploy(await registry.getAddress());

    // 3. DocumentRegistry
    const DocReg = await ethers.getContractFactory("DocumentRegistry");
    const documentRegistry = await DocReg.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // Default shipment input
    const defaultInput = {
      externalRef: ethers.encodeBytes32String("DOC-SHIP-001"),
      productDescription: "Pharmaceuticals",
      quantity: 100,
      origin: "Hyderabad",
      destination: "Bengaluru",
      destLat: 12971600,
      destLon: 77594600,
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 3,
      paymentAmount: 0n,
    };

    const tx = await shipmentRegistry.connect(shipper).createShipment(defaultInput);
    await tx.wait();
    const shipmentId = 1n;

    return {
      registry,
      shipmentRegistry,
      documentRegistry,
      shipmentId,
      admin,
      shipper,
      transporter,
      warehouse,
      inspector,
      receiver,
      outsider,
    };
  }

  describe("Constructor & Initialization", function () {
    it("deploys with valid addresses", async function () {
      const f = await loadFixture(fullFixture);
      expect(await f.documentRegistry.registry()).to.equal(await f.registry.getAddress());
      expect(await f.documentRegistry.shipmentRegistry()).to.equal(
        await f.shipmentRegistry.getAddress()
      );
    });

    it("reverts on zero address", async function () {
      const DocReg = await ethers.getContractFactory("DocumentRegistry");
      const [admin] = await ethers.getSigners();
      await expect(
        DocReg.deploy(ethers.ZeroAddress, admin.address)
      ).to.be.revertedWithCustomError(DocReg, "InvalidAddress");
      await expect(
        DocReg.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(DocReg, "InvalidAddress");
    });
  });

  describe("FR-DOC-02: Register Documents (Anchoring)", function () {
    it("Shipper registers a Bill of Lading hash & CID", async function () {
      const f = await loadFixture(fullFixture);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("Bill of Lading raw content"));
      const cid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      const tx = await f.documentRegistry
        .connect(f.shipper)
        .registerDocument(f.shipmentId, 1, docHash, cid); // 1 = BillOfLading

      await expect(tx)
        .to.emit(f.documentRegistry, "DocumentRegistered")
        .withArgs(f.shipmentId, 0, 1, docHash, cid, f.shipper.address);

      expect(await f.documentRegistry.documentCount(f.shipmentId)).to.equal(1n);
      expect(await f.documentRegistry.isHashRegistered(docHash)).to.be.true;
    });

    it("Inspector registers an Inspection Certificate", async function () {
      const f = await loadFixture(fullFixture);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("Inspection Certificate report"));
      const cid = "QmInspectorCertHash1234567890";

      const tx = await f.documentRegistry
        .connect(f.inspector)
        .registerDocument(f.shipmentId, 3, docHash, cid); // 3 = InspectionCertificate

      await expect(tx)
        .to.emit(f.documentRegistry, "DocumentRegistered")
        .withArgs(f.shipmentId, 0, 3, docHash, cid, f.inspector.address);

      expect(await f.documentRegistry.documentCount(f.shipmentId)).to.equal(1n);
    });

    it("reverts registration by unauthorized party (Transporter/Receiver)", async function () {
      const f = await loadFixture(fullFixture);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("Unauthorized doc"));
      const cid = "QmSomeCid";

      await expect(
        f.documentRegistry.connect(f.transporter).registerDocument(f.shipmentId, 1, docHash, cid)
      ).to.be.revertedWithCustomError(f.documentRegistry, "NotAssigned");

      await expect(
        f.documentRegistry.connect(f.receiver).registerDocument(f.shipmentId, 1, docHash, cid)
      ).to.be.revertedWithCustomError(f.documentRegistry, "NotAssigned");
    });

    it("reverts on duplicate hash registration (global uniqueness check)", async function () {
      const f = await loadFixture(fullFixture);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("Duplicate test"));
      const cid = "QmCidDuplicate";

      await f.documentRegistry
        .connect(f.shipper)
        .registerDocument(f.shipmentId, 1, docHash, cid);

      await expect(
        f.documentRegistry.connect(f.shipper).registerDocument(f.shipmentId, 2, docHash, cid)
      )
        .to.be.revertedWithCustomError(f.documentRegistry, "HashAlreadyRegistered")
        .withArgs(docHash);
    });

    it("reverts on zero hash", async function () {
      const f = await loadFixture(fullFixture);
      await expect(
        f.documentRegistry
          .connect(f.shipper)
          .registerDocument(f.shipmentId, 1, ethers.ZeroHash, "QmCid")
      ).to.be.revertedWithCustomError(f.documentRegistry, "InvalidAddress");
    });
  });

  describe("FR-DOC-03: Document Verification", function () {
    it("verifies document integrity matching stored hash", async function () {
      const f = await loadFixture(fullFixture);
      const rawContent = "Authentic customs declaration content";
      const docHash = ethers.keccak256(ethers.toUtf8Bytes(rawContent));
      const cid = "QmCustomsCid";

      await f.documentRegistry
        .connect(f.shipper)
        .registerDocument(f.shipmentId, 3, docHash, cid); // 3 = CustomsDeclaration

      // Receiver verifies document using exact same recomputed hash
      const tx = await f.documentRegistry
        .connect(f.receiver)
        .verifyDocument(f.shipmentId, 0, docHash);

      await expect(tx)
        .to.emit(f.documentRegistry, "DocumentVerified")
        .withArgs(f.shipmentId, 0, true, f.receiver.address);

      // Verify static call return values
      const [matched, storedHash] = await f.documentRegistry
        .connect(f.receiver)
        .verifyDocument.staticCall(f.shipmentId, 0, docHash);

      expect(matched).to.be.true;
      expect(storedHash).to.equal(docHash);
    });

    it("detects tampered document when hash mismatches", async function () {
      const f = await loadFixture(fullFixture);
      const originalHash = ethers.keccak256(ethers.toUtf8Bytes("Original invoice"));
      const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes("Tampered invoice with modified prices"));
      const cid = "QmInvoiceCid";

      await f.documentRegistry
        .connect(f.shipper)
        .registerDocument(f.shipmentId, 2, originalHash, cid); // 2 = CommercialInvoice

      const tx = await f.documentRegistry
        .connect(f.receiver)
        .verifyDocument(f.shipmentId, 0, tamperedHash);

      await expect(tx)
        .to.emit(f.documentRegistry, "DocumentVerified")
        .withArgs(f.shipmentId, 0, false, f.receiver.address);

      const [matched, storedHash] = await f.documentRegistry
        .connect(f.receiver)
        .verifyDocument.staticCall(f.shipmentId, 0, tamperedHash);

      expect(matched).to.be.false;
      expect(storedHash).to.equal(originalHash);
    });

    it("reverts on invalid docIndex", async function () {
      const f = await loadFixture(fullFixture);
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("none"));

      await expect(
        f.documentRegistry.connect(f.receiver).verifyDocument(f.shipmentId, 99, fakeHash)
      )
        .to.be.revertedWithCustomError(f.documentRegistry, "InvalidDocIndex")
        .withArgs(f.shipmentId, 99);
    });

    it("reverts if verifier is inactive participant", async function () {
      const f = await loadFixture(fullFixture);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("Doc"));
      await f.documentRegistry.connect(f.shipper).registerDocument(f.shipmentId, 1, docHash, "QmCid");

      await expect(
        f.documentRegistry.connect(f.outsider).verifyDocument(f.shipmentId, 0, docHash)
      ).to.be.revertedWithCustomError(f.registry, "InactiveParticipant");
    });
  });

  describe("Pagination & View Queries", function () {
    it("returns paginated documents", async function () {
      const f = await loadFixture(fullFixture);
      const h1 = ethers.keccak256(ethers.toUtf8Bytes("Doc 1"));
      const h2 = ethers.keccak256(ethers.toUtf8Bytes("Doc 2"));
      const h3 = ethers.keccak256(ethers.toUtf8Bytes("Doc 3"));

      await f.documentRegistry.connect(f.shipper).registerDocument(f.shipmentId, 1, h1, "cid1");
      await f.documentRegistry.connect(f.shipper).registerDocument(f.shipmentId, 2, h2, "cid2");
      await f.documentRegistry.connect(f.shipper).registerDocument(f.shipmentId, 3, h3, "cid3");

      const page1 = await f.documentRegistry.getDocuments(f.shipmentId, 0, 2);
      expect(page1.length).to.equal(2);
      expect(page1[0].cid).to.equal("cid1");
      expect(page1[1].cid).to.equal("cid2");

      const page2 = await f.documentRegistry.getDocuments(f.shipmentId, 2, 2);
      expect(page2.length).to.equal(1);
      expect(page2[0].cid).to.equal("cid3");

      const emptyPage = await f.documentRegistry.getDocuments(f.shipmentId, 5, 2);
      expect(emptyPage.length).to.equal(0);
    });
  });
});
