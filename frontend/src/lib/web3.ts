import { ethers } from "ethers";
import {
  CHAIN_ID,
  CHAIN_ID_HEX,
  CHAIN_NAME,
  RPC_URL,
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
} from "@/contracts/config";
import { api } from "@/lib/api";

export type TxStep = "idle" | "awaiting_signature" | "broadcasting" | "confirming" | "syncing" | "success" | "error";

export interface TxStatus {
  step: TxStep;
  txHash?: string;
  blockNumber?: number;
  message?: string;
  error?: string;
}

export async function getEthereumProvider(): Promise<ethers.BrowserProvider> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No EVM wallet detected. Please install or enable MetaMask to use CargoChain.");
  }
  return new ethers.BrowserProvider((window as any).ethereum);
}

export async function ensureCorrectNetwork(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  const ethereum = (window as any).ethereum;

  try {
    const currentChain = await ethereum.request({ method: "eth_chainId" });
    if (parseInt(currentChain, 16) === CHAIN_ID) {
      return true;
    }

    // Attempt to switch
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // Chain 1337 not added yet
      if (switchError.code === 4902 || switchError.code === -32603) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: CHAIN_NAME,
              rpcUrls: [RPC_URL],
              nativeCurrency: {
                name: "Test ETH",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
        return true;
      }
      throw switchError;
    }
  } catch (err: any) {
    console.error("Failed to switch network:", err);
    return false;
  }
}

export function getContracts(signerOrProvider: ethers.Signer | ethers.Provider) {
  return {
    participantRegistry: new ethers.Contract(
      CONTRACT_ADDRESSES.ParticipantRegistry,
      CONTRACT_ABIS.ParticipantRegistry,
      signerOrProvider
    ),
    shipmentRegistry: new ethers.Contract(
      CONTRACT_ADDRESSES.ShipmentRegistry,
      CONTRACT_ABIS.ShipmentRegistry,
      signerOrProvider
    ),
    trackingManager: new ethers.Contract(
      CONTRACT_ADDRESSES.TrackingManager,
      CONTRACT_ABIS.TrackingManager,
      signerOrProvider
    ),
    documentRegistry: new ethers.Contract(
      CONTRACT_ADDRESSES.DocumentRegistry,
      CONTRACT_ABIS.DocumentRegistry,
      signerOrProvider
    ),
    escrowManager: new ethers.Contract(
      CONTRACT_ADDRESSES.EscrowManager,
      CONTRACT_ABIS.EscrowManager,
      signerOrProvider
    ),
    disputeManager: new ethers.Contract(
      CONTRACT_ADDRESSES.DisputeManager,
      CONTRACT_ABIS.DisputeManager,
      signerOrProvider
    ),
  };
}

/**
 * Execute contract transaction with UX status callbacks and automatic backend indexer sync.
 */
export async function executeTransaction(
  actionName: string,
  txFn: () => Promise<ethers.ContractTransactionResponse>,
  onStatusUpdate: (status: TxStatus) => void
): Promise<ethers.ContractTransactionReceipt> {
  try {
    onStatusUpdate({
      step: "awaiting_signature",
      message: `Please confirm "${actionName}" in your wallet...`,
    });

    const tx = await txFn();

    onStatusUpdate({
      step: "confirming",
      txHash: tx.hash,
      message: `Transaction broadcasted. Awaiting block confirmation...`,
    });

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted on-chain (tx: ${tx.hash})`);
    }

    onStatusUpdate({
      step: "syncing",
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: `Confirmed in block #${receipt.blockNumber}. Syncing backend read model...`,
    });

    // Proactively notify backend indexer to sync latest logs immediately
    try {
      await api.triggerSync();
    } catch (syncErr) {
      console.warn("Background indexer sync trigger notice:", syncErr);
    }

    onStatusUpdate({
      step: "success",
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: `"${actionName}" confirmed and indexed successfully!`,
    });

    return receipt;
  } catch (err: any) {
    const errorMsg = parseContractError(err);

    onStatusUpdate({
      step: "error",
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }
}

/**
 * Parses raw ethers and EVM revert errors into clear, human-readable explanations.
 */
export function parseContractError(err: any): string {
  if (!err) return "Transaction failed";
  if (err.code === "ACTION_REJECTED" || err.code === 4001) {
    return "Transaction was cancelled / rejected in MetaMask.";
  }
  if (err.revert?.name) {
    const errorName = err.revert.name;
    switch (errorName) {
      case "Unauthorized":
        return "Transaction Reverted: Unauthorized. Your connected wallet does not have the required role for this action.";
      case "DuplicateExternalRef":
        return "Transaction Reverted: A shipment with this External Reference already exists.";
      case "InvalidTransition":
        return "Transaction Reverted: Invalid shipment status transition.";
      case "NotAssigned":
        return "Transaction Reverted: Your wallet is not assigned to this shipment.";
      case "NotCustodian":
        return "Transaction Reverted: Only the current physical custodian can perform this custody transfer.";
      case "AlreadyDeposited":
        return "Transaction Reverted: Escrow has already been deposited for this shipment.";
      case "NotEligible":
        return "Transaction Reverted: Payment release is not yet eligible for this shipment.";
      case "AlreadyReleased":
        return "Transaction Reverted: Payment has already been released.";
      default:
        return `Transaction Reverted (${errorName}): Action rejected by smart contract rules.`;
    }
  }
  if (err.reason) {
    return `Reverted: ${err.reason}`;
  }
  if (err.data?.message) {
    return `Reverted: ${err.data.message}`;
  }
  const str = String(err.message || "");
  if (str.includes("Unauthorized") || str.includes("0x9eb419e1")) {
    return "Transaction Reverted: Unauthorized. Your connected wallet does not have the required role for this action (e.g. creating shipments requires the Shipper role).";
  }
  if (str.includes("DuplicateExternalRef") || str.includes("0xb9c6e00b")) {
    return "Transaction Reverted: A shipment with this External Reference already exists.";
  }
  if (str.includes("missing revert data") && str.includes("estimateGas")) {
    return "Transaction Reverted by Smart Contract: Gas estimation failed. The contract rejected this transaction. Please confirm you are connected with the correct role (e.g. Account 1 for Shipper) and that all assigned participant addresses are valid.";
  }
  if (err.shortMessage) {
    return err.shortMessage;
  }
  return err.message || "Transaction failed";
}

/**
 * Normalizes and validates an EVM address regardless of casing or whitespace.
 * Returns the standard checksummed address, or null if invalid.
 */
export function normalizeEvmAddress(addr?: string | null): string | null {
  if (!addr) return null;
  const cleaned = addr.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(cleaned)) {
    try {
      return ethers.getAddress(cleaned.toLowerCase());
    } catch {
      return null;
    }
  }
  return null;
}
