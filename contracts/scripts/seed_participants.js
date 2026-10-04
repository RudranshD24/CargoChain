// CargoChain — Idempotent Participant Seeding Script
// Usage: npx hardhat run scripts/seed_participants.js --network ganache
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ROLE_NAMES = {
  0: "None",
  1: "Admin",
  2: "Shipper",
  3: "Transporter",
  4: "Warehouse",
  5: "Inspector",
  6: "Receiver",
  7: "Oracle",
};

const ROLE_CONFIG = [
  { index: 0, role: 1, name: "Admin" },
  { index: 1, role: 2, name: "Shipper" },
  { index: 2, role: 3, name: "Transporter" },
  { index: 3, role: 4, name: "Warehouse" },
  { index: 4, role: 5, name: "Inspector" },
  { index: 5, role: 6, name: "Receiver" },
  { index: 6, role: 7, name: "Oracle" },
  { index: 7, role: 0, name: "None" }, // Account 7 left unregistered as outsider
];

async function seedParticipants(registryAddress, adminSigner, allSigners) {
  const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
  const registry = ParticipantRegistry.attach(registryAddress).connect(adminSigner);

  // 1. Initial State Check
  const initialStatus = [];
  for (const item of ROLE_CONFIG) {
    const signer = allSigners[item.index];
    const currentRole = Number(await registry.roleOf(signer.address));
    const active = await registry.isActive(signer.address);
    initialStatus.push({
      index: item.index,
      address: signer.address,
      currentRole: currentRole,
      currentRoleName: ROLE_NAMES[currentRole] || "Unknown",
      targetRole: item.role,
      targetRoleName: item.name,
      isActive: active,
    });
  }

  // 2. Perform Idempotent Registration for Accounts 1 to 6
  const actions = [];
  for (const item of ROLE_CONFIG) {
    if (item.index === 0) {
      // Account 0 is deployer / Admin
      actions.push({ index: item.index, action: "Admin Verified" });
      continue;
    }
    if (item.index === 7) {
      // Account 7 is explicitly left unregistered
      actions.push({ index: item.index, action: "Left Unregistered (Outsider)" });
      continue;
    }

    const signer = allSigners[item.index];
    const currentRole = Number(await registry.roleOf(signer.address));

    if (currentRole === item.role) {
      actions.push({ index: item.index, action: "Already Registered (Skipped)" });
    } else if (currentRole === 0) {
      const tx = await registry.registerParticipant(signer.address, item.role);
      await tx.wait();
      actions.push({ index: item.index, action: "Registered" });
    } else {
      actions.push({
        index: item.index,
        action: `Warning: Has conflicting role ${ROLE_NAMES[currentRole]} (${currentRole})`,
      });
    }
  }

  // 3. Final State Check
  const finalTable = [];
  for (const item of ROLE_CONFIG) {
    const signer = allSigners[item.index];
    const currentRole = Number(await registry.roleOf(signer.address));
    const active = await registry.isActive(signer.address);
    finalTable.push({
      "Account": `Account ${item.index}`,
      "Address": signer.address,
      "Role": ROLE_NAMES[currentRole] || "Unknown",
      "Active": active ? "Yes" : "No",
      "Action": actions.find((a) => a.index === item.index)?.action || "None",
    });
  }

  return { initialStatus, finalTable };
}

async function main() {
  const deploymentsPath = path.resolve(__dirname, "../../deployments/local.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Deployment file not found at ${deploymentsPath}`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const registryAddress = deployments.contracts.ParticipantRegistry;
  if (!registryAddress) {
    throw new Error("ParticipantRegistry address missing in deployments/local.json");
  }

  const signers = await ethers.getSigners();
  if (signers.length < 8) {
    throw new Error(`Need at least 8 signers, but only found ${signers.length}`);
  }

  const adminSigner = signers[0];

  console.log("================================================================================");
  console.log("CargoChain — ParticipantRegistry Seeding");
  console.log(`Registry Contract: ${registryAddress}`);
  console.log(`Admin Signer:     ${adminSigner.address}`);
  console.log("================================================================================");

  const { initialStatus, finalTable } = await seedParticipants(registryAddress, adminSigner, signers);

  console.log("\n[Initial Roles in ParticipantRegistry before seeding]:");
  console.table(
    initialStatus.map((s) => ({
      Account: `Account ${s.index}`,
      Address: s.address,
      Role: s.currentRoleName,
      Active: s.isActive ? "Yes" : "No",
    }))
  );

  console.log("\n[Final ParticipantRegistry Role Table]:");
  console.table(finalTable);
  console.log("================================================================================\n");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  seedParticipants,
  ROLE_CONFIG,
  ROLE_NAMES,
};
