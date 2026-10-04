"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import { getContracts, executeTransaction, TxStatus } from "@/lib/web3";
import { TxModal } from "@/components/ui/TxModal";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  RefreshCw,
  ExternalLink,
  Gavel,
  Lock,
  Unlock,
  Coins,
} from "lucide-react";

export default function DisputesDashboardPage() {
  const { role, isAuthenticated, loginWithSignature } = useWallet();
  const isAdmin = role === 1;

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  // Resolve Modal state
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [resolutionChoice, setResolutionChoice] = useState<number>(0); // 0=ReleaseToTransporter, 1=RefundToShipper, 2=Split
  const [splitShipperPercent, setSplitShipperPercent] = useState<number>(50);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [submittingResolve, setSubmittingResolve] = useState(false);

  const fetchDisputes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDisputes();
      setDisputes(res.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load disputes queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDisputes();
    }
  }, [isAuthenticated]);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;

    setSubmittingResolve(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);
      const shipmentId = selectedDispute.shipmentId;
      const splitBps = resolutionChoice === 2 ? BigInt(splitShipperPercent * 100) : 0n;

      await executeTransaction(
        `Resolve Dispute #${selectedDispute.id}`,
        async () => {
          return await contracts.disputeManager.resolveDispute(
            shipmentId,
            resolutionChoice,
            splitBps,
            adminNotes || "Settled by Administrator"
          );
        },
        setTxStatus
      );

      setSelectedDispute(null);
      await fetchDisputes();
    } catch (err: any) {
      setError(err.message || "Failed to resolve dispute on-chain");
    } finally {
      setSubmittingResolve(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Authentication Required</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 mb-6">
            Connect your MetaMask wallet to view disputes for shipments you are party to.
          </p>
          <button
            onClick={() => loginWithSignature()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-md"
          >
            Authenticate with Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Transaction Modal */}
      {txStatus && <TxModal status={txStatus} onClose={() => setTxStatus(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shipment Disputes & Settlement</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escrow-guarded dispute resolution workflow per FR-DSP-01 and FR-ESC-05
            </p>
          </div>
        </div>
        <button
          onClick={fetchDisputes}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Queue
        </button>
      </div>

      {/* Info Callout */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">Escrow Freeze Enforcement (FR-ESC-05)</h3>
          <p className="text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
            When a dispute is raised by an assigned Shipper or Receiver, the smart contract automatically sets shipment status to{" "}
            <strong>Disputed</strong> and locks the escrow. Neither payment release nor cancellation refund can proceed until
            an Administrator executes a formal resolution on-chain.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Disputes Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active & Historical Disputes</h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
            {disputes.length} Disputes
          </span>
        </div>

        {disputes.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            No disputes found. All shipments are proceeding normally.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Shipment</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Claim Notes</th>
                  <th className="py-3 px-4">Raised By</th>
                  <th className="py-3 px-4">Dispute Status</th>
                  <th className="py-3 px-4">Resolution</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <Link
                        href={`/shipments/${d.shipmentId}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        #{d.shipmentId}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {d.reasonName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={d.notes}>
                      {d.notes}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      {d.raisedBy.slice(0, 6)}...{d.raisedBy.slice(-4)}
                    </td>
                    <td className="py-3 px-4">
                      {d.isResolved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                          <Lock className="w-3 h-3" />
                          Open (Escrow Frozen)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {d.isResolved ? (
                        <span className="font-medium text-slate-900 dark:text-white">
                          {d.resolutionName}
                        </span>
                      ) : (
                        <span className="text-slate-400">Pending Review</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        {!d.isResolved && (
                          <button
                            onClick={() => {
                              setSelectedDispute(d);
                              setResolutionChoice(0);
                              setSplitShipperPercent(50);
                              setAdminNotes("");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                          >
                            <Gavel className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolve Dispute Modal (Admin Only) */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Resolve Dispute for Shipment #{selectedDispute.shipmentId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl text-xs space-y-1">
              <div><strong>Claim Reason:</strong> {selectedDispute.reasonName}</div>
              <div><strong>Claimant Notes:</strong> {selectedDispute.notes}</div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Settlement Outcome
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionChoice === 0}
                      onChange={() => setResolutionChoice(0)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white">Release to Transporter</div>
                      <div className="text-slate-500">Unfreezes escrow and releases 100% payout to Transporter. Marks shipment Completed.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionChoice === 1}
                      onChange={() => setResolutionChoice(1)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white">Refund to Shipper</div>
                      <div className="text-slate-500">Unfreezes escrow and refunds 100% deposit to Shipper. Marks shipment Cancelled.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionChoice === 2}
                      onChange={() => setResolutionChoice(2)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white">Split Payout</div>
                      <div className="text-slate-500">Divides test-ETH escrow between Shipper and Transporter according to agreed split.</div>
                    </div>
                  </label>
                </div>
              </div>

              {resolutionChoice === 2 && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Shipper Share: {splitShipperPercent}%</span>
                    <span>Transporter Share: {100 - splitShipperPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={splitShipperPercent}
                    onChange={(e) => setSplitShipperPercent(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Administrator Justification Notes
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Explain why this resolution was chosen..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolve}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium shadow-md disabled:opacity-60"
                >
                  {submittingResolve ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Gavel className="w-3.5 h-3.5" />}
                  Confirm On-Chain Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
