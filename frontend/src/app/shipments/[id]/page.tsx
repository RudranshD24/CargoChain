"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  MILESTONE_TYPE_LABELS,
  DOC_TYPE_LABELS,
  DISPUTE_REASON_LABELS,
} from "@/contracts/config";
import { getContracts, executeTransaction, TxStatus } from "@/lib/web3";
import { TxModal } from "@/components/ui/TxModal";
import { MLEtaPredictionCard } from "@/components/MLEtaPredictionCard";
import {
  Truck,
  ArrowLeft,
  Clock,
  MapPin,
  Shield,
  FileCheck2,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Boxes,
  UserCheck,
  FileText,
  Download,
} from "lucide-react";

export default function ShipmentConsolePage() {
  const params = useParams();
  const shipmentId = Number(params?.id);

  const { account, role, isAuthenticated, loginWithSignature } = useWallet();

  const [shipment, setShipment] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [custodyHistory, setCustodyHistory] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [escrow, setEscrow] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "custody" | "documents" | "escrow">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  // Document Upload Form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<number>(0);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Document Verify Form
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyDocIndex, setVerifyDocIndex] = useState<number>(0);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyingDoc, setVerifyingDoc] = useState(false);

  // Action Modals & Inputs
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [milestoneLocation, setMilestoneLocation] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [milestoneType, setMilestoneType] = useState<number>(1);
  const [transferCustodianAddr, setTransferCustodianAddr] = useState("");
  const [disputeReason, setDisputeReason] = useState<number>(0);
  const [disputeNotes, setDisputeNotes] = useState("");

  const loadAllShipmentData = useCallback(async () => {
    if (!isAuthenticated || !shipmentId) return;
    setLoading(true);
    setError(null);
    try {
      const [sRes, mRes, cRes, dRes, eRes] = await Promise.all([
        api.getShipment(shipmentId),
        api.getShipmentMilestones(shipmentId).catch(() => ({ items: [], total: 0 })),
        api.getShipmentCustody(shipmentId).catch(() => ({ items: [], total: 0 })),
        api.getShipmentDocuments(shipmentId).catch(() => ({ items: [], total: 0 })),
        api.getShipmentEscrow(shipmentId).catch(() => null),
      ]);
      setShipment(sRes);
      setMilestones(mRes.items || []);
      setCustodyHistory(cRes.items || []);
      setDocuments(dRes.items || []);
      setEscrow(eRes);
    } catch (err: any) {
      setError(err.message || "Failed to load shipment details");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, shipmentId]);

  useEffect(() => {
    loadAllShipmentData();
  }, [loadAllShipmentData]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-blue-500 mb-3" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Please log in with MetaMask to view this shipment.</p>
        <button
          onClick={loginWithSignature}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
        >
          Sign with MetaMask
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="p-20 text-center text-sm text-slate-400">Loading shipment console #{shipmentId}...</div>;
  }

  if (error || !shipment) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Shipment Not Accessible</h3>
        <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 max-w-md mx-auto">
          {error || "Shipment could not be found or your connected wallet is not an involved party."}
        </p>
        <Link
          href="/shipments"
          className="mt-4 inline-block px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
        >
          Return to Shipments
        </Link>
      </div>
    );
  }

  // Stakeholder checks
  const normUser = account?.toLowerCase();
  const isShipper = normUser === shipment.shipper?.toLowerCase();
  const isTransporter = normUser === shipment.transporter?.toLowerCase();
  const isReceiver = normUser === shipment.receiver?.toLowerCase();
  const isWarehouse = shipment.warehouse && normUser === shipment.warehouse?.toLowerCase();
  const isInspector = shipment.inspector && normUser === shipment.inspector?.toLowerCase();
  const isCurrentCustodian = normUser === shipment.currentCustodian?.toLowerCase();
  const isAdmin = role === 1;

  // Lifecycle stage progression
  const currentStatus = shipment.status;
  const statusLabel = STATUS_LABELS[currentStatus] || `Status ${currentStatus}`;
  const badgeClass = STATUS_BADGE_CLASSES[currentStatus] || "bg-slate-100 text-slate-800";

  // ──────── Contract Action Handlers ────────

  const handleTransporterAccept = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Accept Shipment",
        () => contracts.shipmentRegistry.acceptShipment(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransporterReject = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Reject Shipment",
        () => contracts.shipmentRegistry.rejectShipment(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleShipperCancel = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Cancel Shipment",
        () => contracts.shipmentRegistry.cancelShipment(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartTransit = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Start Transit (Dispatch)",
        () => contracts.trackingManager.startTransit(shipmentId, shipment.origin || "Origin Depot"),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleWarehouseArrival = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Confirm Warehouse Arrival",
        () => contracts.trackingManager.confirmWarehouseArrival(shipmentId, "Intermediate Warehouse Facility"),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleReceiverConfirmDelivery = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      // Confirm delivery Condition.Intact (0)
      await executeTransaction(
        "Confirm Delivery (Intact)",
        () => contracts.shipmentRegistry.confirmDelivery(shipmentId, 0),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleReceiverAcceptDelivery = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Accept Delivery (Complete Shipment)",
        () => contracts.shipmentRegistry.acceptDelivery(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionModal(null);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Record Milestone",
        () =>
          contracts.trackingManager.recordMilestone(
            shipmentId,
            milestoneType,
            milestoneLocation || "Transit Checkpoint",
            0,
            0,
            milestoneNotes || ""
          ),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionModal(null);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Transfer Custody",
        () => contracts.trackingManager.transferCustody(shipmentId, transferCustodianAddr.trim()),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleRaiseDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionModal(null);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Raise Formal Dispute",
        () =>
          contracts.disputeManager.raiseDispute(
            shipmentId,
            disputeReason,
            disputeNotes.trim() || "Shipment dispute raised"
          ),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  // ──────── Escrow Actions ────────

  const handleDepositEscrow = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      const amountWei = BigInt(shipment.paymentAmount || "0");
      if (amountWei === BigInt(0)) {
        alert("This shipment does not require an escrow payment deposit.");
        return;
      }

      await executeTransaction(
        "Deposit Escrow Payment (Test-ETH)",
        () => contracts.escrowManager.deposit(shipmentId, { value: amountWei }),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleReleaseEscrow = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Release Escrow to Transporter",
        () => contracts.escrowManager.releasePayment(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefundEscrow = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        "Claim Escrow Refund",
        () => contracts.escrowManager.refund(shipmentId),
        setTxStatus
      );
    } catch (e) {
      console.error(e);
    }
  };

  // ──────── Document Upload & Verification ────────

  const handleUploadAndAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadingDoc(true);
    try {
      // Step 1: Upload to backend/IPFS proxy
      const uploadRes = await api.uploadDocument(uploadFile, shipmentId, uploadDocType);

      // Step 2: Sign anchoring transaction in MetaMask
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      const contentHashBytes32 = uploadRes.sha256;

      await executeTransaction(
        "Anchor Document on DocumentRegistry",
        () => contracts.documentRegistry.registerDocument(shipmentId, uploadDocType, contentHashBytes32, uploadRes.cid),
        setTxStatus
      );

      setUploadFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleVerifyDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyFile) return;

    setVerifyingDoc(true);
    try {
      const result = await api.verifyDocument(verifyFile, shipmentId, verifyDocIndex);
      setVerifyResult(result);
    } catch (e: any) {
      alert(`Verification failed: ${e.message}`);
    } finally {
      setVerifyingDoc(false);
    }
  };

  const handleDownloadDoc = async (cid: string, filename: string) => {
    try {
      const blob = await api.downloadDocumentBlob(cid);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || cid;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Download failed: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <TxModal
        status={txStatus}
        onClose={() => {
          setTxStatus(null);
          loadAllShipmentData();
        }}
      />

      {/* Header and Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/shipments"
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Shipment #{shipment.shipmentId}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Ref: {shipment.externalRef}
              </p>
            </div>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={loadAllShipmentData}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Active Dispute Warning Banner */}
        {currentStatus === 8 && (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="font-bold text-purple-900 dark:text-purple-200">
                  Active Dispute Raised for Shipment #{shipmentId}
                </span>
                <p className="text-purple-700 dark:text-purple-400 text-[11px] mt-0.5">
                  Escrow funds are frozen on-chain in EscrowManager. Awaiting dispute arbitration by an Administrator.
                </p>
              </div>
            </div>
            <Link
              href="/disputes"
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-xs whitespace-nowrap w-fit"
            >
              Open Dispute Console
            </Link>
          </div>
        )}

        {/* State Machine Step Bar */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            {[
              { id: 0, label: "1. Created" },
              { id: 1, label: "2. Accepted" },
              { id: 2, label: "3. In Transit" },
              { id: 4, label: "4. Arrived" },
              { id: 5, label: "5. Delivered" },
              { id: 6, label: "6. Completed" },
            ].map((step) => {
              const isPast = currentStatus > step.id || currentStatus === 6;
              const isCurrent = currentStatus === step.id;
              return (
                <div
                  key={step.id}
                  className={`p-2 rounded-xl border text-[11px] font-bold ${
                    isCurrent
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : isPast
                      ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Panel for Authorized Roles */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
            Available Actions:
          </span>

          {/* Transporter actions */}
          {isTransporter && currentStatus === 0 && (
            <>
              <button
                onClick={handleTransporterAccept}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Accept Shipment
              </button>
              <button
                onClick={handleTransporterReject}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Reject Shipment
              </button>
            </>
          )}

          {isTransporter && currentStatus === 1 && (
            <button
              onClick={handleStartTransit}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              Dispatch &amp; Start Transit
            </button>
          )}

          {/* Shipper cancel */}
          {isShipper && currentStatus === 0 && (
            <button
              onClick={handleShipperCancel}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Cancel Shipment
            </button>
          )}

          {/* Warehouse arrival */}
          {(isWarehouse || isTransporter) && (currentStatus === 2 || currentStatus === 3) && (
            <button
              onClick={handleWarehouseArrival}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Confirm Warehouse Arrival
            </button>
          )}

          {/* Receiver confirm & accept */}
          {isReceiver && currentStatus === 4 && (
            <button
              onClick={handleReceiverConfirmDelivery}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Confirm Delivery (Intact)
            </button>
          )}

          {isReceiver && currentStatus === 5 && (
            <button
              onClick={handleReceiverAcceptDelivery}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Accept Goods &amp; Complete
            </button>
          )}

          {/* Milestone recording for involved parties */}
          {(isTransporter || isShipper || isInspector || isWarehouse || isAdmin) &&
            currentStatus >= 2 &&
            currentStatus <= 4 && (
              <button
                onClick={() => setActionModal("milestone")}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                Record Milestone
              </button>
            )}

          {/* Custody transfer for current custodian */}
          {isCurrentCustodian && currentStatus >= 1 && currentStatus <= 4 && (
            <button
              onClick={() => setActionModal("custody")}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Transfer Custody
            </button>
          )}

          {/* Dispute raising for Shipper/Receiver on active shipments */}
          {(isShipper || isReceiver) &&
            currentStatus >= 2 &&
            currentStatus <= 5 &&
            currentStatus !== 8 && (
              <button
                onClick={() => setActionModal("dispute")}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Raise Dispute
              </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 text-xs font-bold">
        {[
          { key: "overview", label: "Overview", icon: Boxes },
          { key: "timeline", label: `Timeline (${milestones.length})`, icon: Clock },
          { key: "custody", label: `Custody (${custodyHistory.length})`, icon: UserCheck },
          { key: "documents", label: `Documents (${documents.length})`, icon: FileCheck2 },
          { key: "escrow", label: "Escrow Payment", icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <MLEtaPredictionCard shipmentId={shipmentId} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Cargo Specifications</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Product Description</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{shipment.productDescription}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Quantity</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{shipment.quantity} units</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Origin Facility</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{shipment.origin}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Destination Facility</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{shipment.destination}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Expected Delivery Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(Number(shipment.expectedDelivery) * 1000).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Custodian</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {shipment.currentCustodian}
                </span>
              </div>
            </div>
          </div>

          {/* Stakeholders Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Involved Stakeholders</h2>
            <div className="flex flex-col gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Shipper</span>
                <span className="font-mono text-[11px] text-slate-500 break-all">{shipment.shipper}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Transporter</span>
                <span className="font-mono text-[11px] text-slate-500 break-all">{shipment.transporter}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Receiver</span>
                <span className="font-mono text-[11px] text-slate-500 break-all">{shipment.receiver}</span>
              </div>
              {shipment.warehouse && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Warehouse</span>
                  <span className="font-mono text-[11px] text-slate-500 break-all">{shipment.warehouse}</span>
                </div>
              )}
              {shipment.inspector && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Inspector</span>
                  <span className="font-mono text-[11px] text-slate-500 break-all">{shipment.inspector}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab 2: Timeline */}
      {activeTab === "timeline" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Provenance &amp; Tracking History
            </h2>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Manual Milestone
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Oracle Report
              </span>
            </div>
          </div>

          {milestones.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No milestones recorded yet for this shipment.
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 flex flex-col gap-6">
              {milestones.map((m, idx) => {
                const typeLabel = MILESTONE_TYPE_LABELS[m.milestoneType] || `Type ${m.milestoneType}`;
                const dateStr = new Date(Number(m.blockTime) * 1000).toLocaleString();
                const isOracle = m.isOracle || m.source === "oracle" || m.submitterRole === 7;

                return (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${
                        isOracle ? "border-purple-500" : "border-blue-500"
                      }`}
                    />
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{typeLabel}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOracle
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {isOracle ? "Oracle Reported (External Claim)" : "Manual"}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{dateStr}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{m.location || "Transit Point"}</span>
                      </div>

                      {m.notes && <p className="text-xs text-slate-500 italic mt-0.5">{m.notes}</p>}

                      {isOracle && (
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-900 mt-1">
                          ℹ️ <strong>Oracle Trust Boundary:</strong> External milestone claim submitted by authorized service account. Per CargoChain specifications, this transaction proves claim submission, not physical ground-truth.
                        </p>
                      )}

                      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span>Submitter: {m.submitter}</span>
                        <span>Tx: {m.txHash?.substring(0, 10)}...</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Custody */}
      {activeTab === "custody" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Chain of Custody Events</h2>
          {custodyHistory.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No custody transfer events recorded yet. Initial custody held by Shipper.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">From Custodian</th>
                    <th className="py-3 px-4">To Custodian</th>
                    <th className="py-3 px-4">Block Height</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {custodyHistory.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                        Transfer #{i + 1}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{c.fromCustodian}</td>
                      <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-bold">{c.toCustodian}</td>
                      <td className="py-3 px-4 text-slate-500">#{c.blockNumber}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(Number(c.blockTime) * 1000).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{c.txHash?.substring(0, 10)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Documents */}
      {activeTab === "documents" && (
        <div className="flex flex-col gap-6">
          {/* Anchored Documents List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Anchored Documents</h2>
            {documents.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No documents anchored for this shipment yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((d, i) => {
                  const typeLabel = DOC_TYPE_LABELS[d.docType] || `Type ${d.docType}`;
                  return (
                    <div
                      key={i}
                      className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70 rounded-xl flex flex-col gap-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-500" />
                          {typeLabel} (Index #{d.docIndex})
                        </span>
                        <button
                          onClick={() => handleDownloadDoc(d.cid, d.filename || `doc-${d.docIndex}.bin`)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 flex flex-col gap-1">
                        <div>
                          <span className="text-slate-400">SHA-256: </span>
                          <span className="break-all font-semibold text-slate-700 dark:text-slate-300">
                            {d.contentHash}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">IPFS CID: </span>
                          <span className="break-all text-blue-600 dark:text-blue-400 font-semibold">{d.cid}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Uploader: </span>
                          <span>{d.uploader}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload & Anchor Section (Shipper / Inspector) */}
          {(isShipper || isInspector || isAdmin) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  Upload &amp; Anchor Document
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload file to IPFS, compute SHA-256 fingerprint, and anchor on-chain via MetaMask.
                </p>
              </div>

              <form onSubmit={handleUploadAndAnchor} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Select File</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Document Type</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={uploadingDoc || !uploadFile}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {uploadingDoc ? "Uploading..." : "Upload & Anchor"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Real-time File Verification */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-500" />
                Tamper-Evident Integrity Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify any physical document copy against the immutable on-chain SHA-256 fingerprint.
              </p>
            </div>

            <form onSubmit={handleVerifyDocument} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">File to Check</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setVerifyFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Document Index</label>
                <select
                  value={verifyDocIndex}
                  onChange={(e) => setVerifyDocIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {documents.map((d, i) => (
                    <option key={i} value={d.docIndex}>
                      #{d.docIndex} — {DOC_TYPE_LABELS[d.docType] || "Doc"} ({d.cid.substring(0, 10)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={verifyingDoc || !verifyFile || documents.length === 0}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {verifyingDoc ? "Hashing..." : "Verify Hash"}
                </button>
              </div>
            </form>

            {verifyResult && (
              <div
                className={`p-4 rounded-xl border text-xs flex flex-col gap-2 ${
                  verifyResult.match
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {verifyResult.match ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Authentic Document — Hash Matches On-Chain Record!
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      Tampering Detected — Computed SHA-256 Hash Does Not Match!
                    </>
                  )}
                </div>
                <div className="font-mono text-[11px] flex flex-col gap-1">
                  <div>
                    <span className="opacity-75">Expected (Anchored): </span>
                    <span className="font-semibold break-all">{verifyResult.expectedHash}</span>
                  </div>
                  <div>
                    <span className="opacity-75">Computed (Local): </span>
                    <span className="font-semibold break-all">{verifyResult.computedHash}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Escrow */}
      {activeTab === "escrow" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Conditional Test-ETH Escrow
            </h2>
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Academic Prototype Notice: </strong>
                All escrow amounts represent Ganache local test-ETH. There are no real funds or production settlement.
              </span>
            </div>

            {(escrow?.isFrozen || shipment.status === 8) && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <strong className="block font-bold">Escrow Frozen on-chain</strong>
                  <span>
                    Escrow payouts and refunds are locked by EscrowManager due to an active dispute. Arbitration is required from an Administrator via DisputeManager.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-slate-400 font-semibold">Payment Amount</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {escrow?.amountWei
                  ? `${ethers.formatEther(escrow.amountWei)} Test ETH`
                  : `${ethers.formatEther(shipment.paymentAmount || "0")} Test ETH`}
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {escrow?.amountWei || shipment.paymentAmount} wei
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-slate-400 font-semibold">Escrow Deposit Status</span>
              <div className="text-base font-bold">
                {escrow?.deposited ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Funded on-chain in EscrowManager
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Awaiting Deposit by Shipper
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                Beneficiary Transporter: {shipment.transporter}
              </span>
            </div>
          </div>

          {/* Escrow Actions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center gap-3">
            {isShipper && !escrow?.deposited && Number(shipment.paymentAmount) > 0 && (
              <button
                onClick={handleDepositEscrow}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20"
              >
                Deposit {ethers.formatEther(shipment.paymentAmount)} Test-ETH into Escrow
              </button>
            )}

            {isTransporter && escrow?.deposited && !escrow?.released && currentStatus === 6 && (
              <button
                onClick={handleReleaseEscrow}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Release Payment ({ethers.formatEther(escrow?.amountWei)} ETH)
              </button>
            )}

            {isShipper && escrow?.deposited && !escrow?.refunded && (currentStatus === 7 || currentStatus === 9) && (
              <button
                onClick={handleRefundEscrow}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
              >
                Claim Escrow Refund
              </button>
            )}

            {escrow?.released && (
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Escrow payment has been released to Transporter.
              </div>
            )}

            {escrow?.refunded && (
              <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Escrow funds refunded to Shipper.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModal === "milestone" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-4">Record Custom Milestone</h3>
            <form onSubmit={handleRecordMilestoneSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Milestone Type</label>
                <select
                  value={milestoneType}
                  onChange={(e) => setMilestoneType(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value={1}>In Transit Checkpoint</option>
                  <option value={2}>Warehouse Arrival</option>
                  <option value={3}>Arrived at Destination Hub</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Location Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Highway Checkpost"
                  value={milestoneLocation}
                  onChange={(e) => setMilestoneLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Operational Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Driver rest stop; seal intact"
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
                >
                  Sign in MetaMask
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionModal === "custody" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-4">Transfer Physical Custody</h3>
            <form onSubmit={handleTransferCustodySubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Recipient Custodian Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={transferCustodianAddr}
                  onChange={(e) => setTransferCustodianAddr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Recipient must be an active registered participant.
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl"
                >
                  Sign Custody Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionModal === "dispute" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              Raise Formal Dispute
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Raising a dispute transitions shipment status to Disputed and automatically freezes escrow funds on-chain until resolved by an Administrator.
            </p>
            <form onSubmit={handleRaiseDisputeSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Dispute Reason</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {Object.entries(DISPUTE_REASON_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Dispute Details / Notes</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail cargo damage, deviation, or SLA breach..."
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  Sign Dispute in MetaMask
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
