// CargoChain — Contract Deployment & ABI Export Script
// Usage: npx hardhat run scripts/deploy.js --network <network>
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log("CargoChain Contract Deployment");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("==================================================");

  // 1. Deploy ParticipantRegistry
  console.log("\n[1/5] Deploying ParticipantRegistry...");
  const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
  const participantRegistry = await ParticipantRegistry.deploy();
  await participantRegistry.waitForDeployment();
  const participantRegistryAddr = await participantRegistry.getAddress();
  console.log(`  -> ParticipantRegistry deployed at: ${participantRegistryAddr}`);

  // 2. Deploy ShipmentRegistry
  console.log("\n[2/5] Deploying ShipmentRegistry...");
  const ShipmentRegistry = await ethers.getContractFactory("ShipmentRegistry");
  const shipmentRegistry = await ShipmentRegistry.deploy(participantRegistryAddr);
  await shipmentRegistry.waitForDeployment();
  const shipmentRegistryAddr = await shipmentRegistry.getAddress();
  console.log(`  -> ShipmentRegistry deployed at: ${shipmentRegistryAddr}`);

  // 3. Deploy TrackingManager
  console.log("\n[3/5] Deploying TrackingManager...");
  const TrackingManager = await ethers.getContractFactory("TrackingManager");
  const trackingManager = await TrackingManager.deploy(participantRegistryAddr, shipmentRegistryAddr);
  await trackingManager.waitForDeployment();
  const trackingManagerAddr = await trackingManager.getAddress();
  console.log(`  -> TrackingManager deployed at: ${trackingManagerAddr}`);

  // 4. Deploy DocumentRegistry
  console.log("\n[4/5] Deploying DocumentRegistry...");
  const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await DocumentRegistry.deploy(participantRegistryAddr, shipmentRegistryAddr);
  await documentRegistry.waitForDeployment();
  const documentRegistryAddr = await documentRegistry.getAddress();
  console.log(`  -> DocumentRegistry deployed at: ${documentRegistryAddr}`);

  // 5. Deploy EscrowManager
  console.log("\n[5/6] Deploying EscrowManager...");
  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const escrowManager = await EscrowManager.deploy(participantRegistryAddr, shipmentRegistryAddr);
  await escrowManager.waitForDeployment();
  const escrowManagerAddr = await escrowManager.getAddress();
  console.log(`  -> EscrowManager deployed at: ${escrowManagerAddr}`);

  // 6. Deploy DisputeManager
  console.log("\n[6/6] Deploying DisputeManager...");
  const DisputeManager = await ethers.getContractFactory("DisputeManager");
  const disputeManager = await DisputeManager.deploy(
    participantRegistryAddr,
    shipmentRegistryAddr,
    escrowManagerAddr
  );
  await disputeManager.waitForDeployment();
  const disputeManagerAddr = await disputeManager.getAddress();
  console.log(`  -> DisputeManager deployed at: ${disputeManagerAddr}`);

  // 7. Wire up managers
  console.log("\n[Wiring] Setting managers in ShipmentRegistry & EscrowManager...");
  const setTmTx = await shipmentRegistry.setTrackingManager(trackingManagerAddr);
  await setTmTx.wait();
  console.log("  -> TrackingManager registered in ShipmentRegistry.");

  const setEmTx = await shipmentRegistry.setEscrowManager(escrowManagerAddr);
  await setEmTx.wait();
  console.log("  -> EscrowManager registered in ShipmentRegistry.");

  const setDmTx = await shipmentRegistry.setDisputeManager(disputeManagerAddr);
  await setDmTx.wait();
  console.log("  -> DisputeManager registered in ShipmentRegistry.");

  const setEmDmTx = await escrowManager.setDisputeManager(disputeManagerAddr);
  await setEmDmTx.wait();
  console.log("  -> DisputeManager registered in EscrowManager.");

  const deploymentBlock = await ethers.provider.getBlockNumber();
  console.log(`\nDeployment completed at block number: ${deploymentBlock}`);

  // 8. Save deployment metadata to deployments/local.json
  const deploymentsDir = path.resolve(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentMetadata = {
    network: network.name === "unknown" ? "ganache" : network.name,
    chainId: Number(network.chainId),
    deploymentBlock: deploymentBlock,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ParticipantRegistry: participantRegistryAddr,
      ShipmentRegistry: shipmentRegistryAddr,
      TrackingManager: trackingManagerAddr,
      DocumentRegistry: documentRegistryAddr,
      EscrowManager: escrowManagerAddr,
      DisputeManager: disputeManagerAddr,
    },
  };

  const localJsonPath = path.join(deploymentsDir, "local.json");
  fs.writeFileSync(localJsonPath, JSON.stringify(deploymentMetadata, null, 2));
  console.log(`\nSaved deployment metadata to: ${localJsonPath}`);

  // 9. Export ABIs to contracts/abi/
  const abiDir = path.resolve(__dirname, "../abi");
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contractNames = [
    "ParticipantRegistry",
    "ShipmentRegistry",
    "TrackingManager",
    "DocumentRegistry",
    "EscrowManager",
    "DisputeManager",
  ];

  for (const name of contractNames) {
    const artifactPath = path.resolve(
      __dirname,
      `../artifacts/src/${name}.sol/${name}.json`
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiOnly = {
        contractName: name,
        abi: artifact.abi,
      };
      const destPath = path.join(abiDir, `${name}.json`);
      fs.writeFileSync(destPath, JSON.stringify(abiOnly, null, 2));
      console.log(`  -> Exported ABI for ${name} to contracts/abi/${name}.json`);
    }
  }

  console.log("\n==================================================");
  console.log("Deployment and ABI export successfully completed!");
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
