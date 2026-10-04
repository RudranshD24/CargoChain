import { localDeployments } from "./deployments";
import {
  ParticipantRegistryAbi,
  ShipmentRegistryAbi,
  TrackingManagerAbi,
  DocumentRegistryAbi,
  EscrowManagerAbi,
  DisputeManagerAbi,
} from "./abis";

export const CHAIN_ID = 1337;
export const CHAIN_ID_HEX = "0x539";
export const CHAIN_NAME = "Ganache Local (Chain ID 1337)";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

export const CONTRACT_ADDRESSES = {
  ParticipantRegistry: localDeployments.contracts.ParticipantRegistry || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ShipmentRegistry: localDeployments.contracts.ShipmentRegistry || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  TrackingManager: localDeployments.contracts.TrackingManager || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  DocumentRegistry: localDeployments.contracts.DocumentRegistry || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  EscrowManager: localDeployments.contracts.EscrowManager || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  DisputeManager: localDeployments.contracts.DisputeManager || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
};

export const CONTRACT_ABIS = {
  ParticipantRegistry: ParticipantRegistryAbi,
  ShipmentRegistry: ShipmentRegistryAbi,
  TrackingManager: TrackingManagerAbi,
  DocumentRegistry: DocumentRegistryAbi,
  EscrowManager: EscrowManagerAbi,
  DisputeManager: DisputeManagerAbi,
};

export const ROLE_LABELS: Record<number, string> = {
  0: "None",
  1: "Admin",
  2: "Shipper",
  3: "Transporter",
  4: "Warehouse",
  5: "Inspector",
  6: "Receiver",
  7: "Oracle",
};

export const STATUS_LABELS: Record<number, string> = {
  0: "Created",
  1: "Accepted",
  2: "In Transit",
  3: "Delayed",
  4: "Arrived",
  5: "Delivered",
  6: "Completed",
  7: "Rejected",
  8: "Disputed",
  9: "Cancelled",
};

export const STATUS_BADGE_CLASSES: Record<number, string> = {
  0: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  1: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  2: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
  3: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  4: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
  5: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  6: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700",
  7: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  8: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  9: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export const MILESTONE_TYPE_LABELS: Record<number, string> = {
  0: "Dispatched",
  1: "In Transit",
  2: "Warehouse Arrival",
  3: "Arrived",
  4: "Delivered",
};

export const DOC_TYPE_LABELS: Record<number, string> = {
  0: "Invoice",
  1: "Bill of Lading",
  2: "Packing List",
  3: "Inspection Certificate",
  4: "Other",
};

export const DISPUTE_REASON_LABELS: Record<number, string> = {
  0: "Damaged",
  1: "Missing",
  2: "Delayed",
  3: "Other",
};

export const RESOLUTION_LABELS: Record<number, string> = {
  0: "Release to Transporter",
  1: "Refund to Shipper",
  2: "Split",
};

