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
    let errorMsg = err.message || "Transaction failed";
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      errorMsg = "Transaction was cancelled / rejected in MetaMask.";
    } else if (err.reason) {
      errorMsg = `Reverted: ${err.reason}`;
    } else if (err.data?.message) {
      errorMsg = `Reverted: ${err.data.message}`;
    }

    onStatusUpdate({
      step: "error",
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }
}
