"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import { STATUS_LABELS, STATUS_BADGE_CLASSES } from "@/contracts/config";
import {
  Truck,
  PlusCircle,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Users,
  RefreshCw,
  FileText,
  Boxes,
} from "lucide-react";

export default function DashboardPage() {
  const { account, role, roleName, user, isAuthenticated, loginWithSignature } = useWallet();

  const [analytics, setAnalytics] = useState<any>(null);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [analyticsRes, shipmentsRes] = await Promise.all([
          api.getAnalyticsSummary().catch(() => null),
          api.getShipments({ pageSize: 5 }).catch(() => ({ items: [], total: 0 })),
        ]);
        if (isMounted) {
          setAnalytics(analyticsRes);
          setRecentShipments(shipmentsRes?.items || []);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load dashboard data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      const shipmentsRes = await api.getShipments({ pageSize: 5 });
      setRecentShipments(shipmentsRes?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Authentication Required</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
          Connect your wallet and sign the EIP-191 personal_sign challenge to access your role-specific dashboard.
        </p>
        <button
          onClick={loginWithSignature}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          Sign with MetaMask to Login
        </button>
      </div>
    );
  }

  const isShipper = role === 2;
  const isTransporter = role === 3;
  const isWarehouse = role === 4;
  const isInspector = role === 5;
  const isReceiver = role === 6;
  const isAdmin = role === 1;

  return (
    <div className="flex flex-col gap-8">
      {/* Header and Role Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
            {roleName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {user?.companyName || "CargoChain Portal"}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 uppercase">
                {roleName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{account}</p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            title="Sync latest blockchain events into PostgreSQL read model"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync Chain
          </button>

          {(isShipper || isAdmin) && (
            <Link
              href="/shipments/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Shipment
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/participants"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Users className="w-4 h-4" />
              Manage Participants
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Shipments</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? "..." : analytics?.totalShipments ?? recentShipments.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across all accessible routes</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">In Transit</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? "..." : analytics?.statusCounts?.InTransit ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Active on-road movements</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? "..." : analytics?.statusCounts?.Completed ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Delivered &amp; escrow released</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Exceptions</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? "..." : analytics?.statusCounts?.Delayed ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Delayed checkpoints</div>
        </div>
      </div>

      {/* Role-Specific Action Banner */}
      {isTransporter && (
        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Transporter Tasks</h4>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400">
                Review assigned shipments ready to Accept, Dispatch, or update with custom transit milestones.
              </p>
            </div>
          </div>
          <Link
            href="/shipments"
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            View Shipments
          </Link>
        </div>
      )}

      {isInspector && (
        <div className="p-4 bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <div>
              <h4 className="text-sm font-bold text-cyan-900 dark:text-cyan-200">Inspector Verification Queue</h4>
              <p className="text-xs text-cyan-700/80 dark:text-cyan-400">
                Inspect physical cargo, verify Bill of Lading hashes against IPFS, and anchor Inspection Certificates.
              </p>
            </div>
          </div>
          <Link
            href="/shipments"
            className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700 transition-colors"
          >
            Review Documents
          </Link>
        </div>
      )}

      {/* Recent Shipments Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Permitted Shipments</h3>
            <p className="text-xs text-slate-500 mt-0.5">Filtered to shipments where your wallet is an involved party or admin</p>
          </div>
          <Link
            href="/shipments"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
          >
            View All ({analytics?.totalShipments ?? recentShipments.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading shipments...</div>
        ) : recentShipments.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Boxes className="w-10 h-10 text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No shipments found</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {isShipper
                ? "You haven't created any shipments yet. Use 'New Shipment' to initiate your first on-chain shipment."
                : "No active shipments are assigned to your wallet address."}
            </p>
            {(isShipper || isAdmin) && (
              <Link
                href="/shipments/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Create Shipment
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Current Custodian</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentShipments.map((s) => {
                  const statusLabel = STATUS_LABELS[s.status] || `Status ${s.status}`;
                  const badgeClass = STATUS_BADGE_CLASSES[s.status] || "bg-slate-100 text-slate-800";
                  return (
                    <tr key={s.shipmentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{s.shipmentId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{s.productDescription}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Qty: {s.quantity}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{s.origin}</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{s.destination}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {s.currentCustodian ? `${s.currentCustodian.substring(0, 6)}...${s.currentCustodian.substring(s.currentCustodian.length - 4)}` : "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/shipments/${s.shipmentId}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                        >
                          Details
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
