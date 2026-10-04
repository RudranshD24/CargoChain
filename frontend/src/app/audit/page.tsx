"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import {
  History,
  Shield,
  Filter,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  Code2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function AuditPage() {
  const { role, isAuthenticated, loginWithSignature } = useWallet();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [contractFilter, setContractFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectEvent, setInspectEvent] = useState<any | null>(null);
  const [adminActionStatus, setAdminActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({
        page,
        pageSize,
        contract: contractFilter || undefined,
        eventType: eventTypeFilter || undefined,
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, contractFilter, eventTypeFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-blue-500 mb-3" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Please log in to view the system audit trail.</p>
        <button
          onClick={loginWithSignature}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
        >
          Sign with MetaMask
        </button>
      </div>
    );
  }

  const isAdmin = role === 1;
  const isInspector = role === 5;

  if (!isAdmin && !isInspector) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Access Restricted</h3>
        <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
          Audit logs are accessible to <strong>Administrators</strong> and <strong>Inspectors</strong> only.
        </p>
      </div>
    );
  }

  const handleSyncChain = async () => {
    setActionLoading(true);
    setAdminActionStatus(null);
    try {
      const res = await api.triggerSync();
      setAdminActionStatus(`Sync complete! Processed ${res.processedEvents} new blockchain events.`);
      fetchAuditLogs();
    } catch (e: any) {
      setAdminActionStatus(`Sync error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReindexChain = async () => {
    if (!confirm("Reindex will wipe the chain-derived PostgreSQL read model and replay all logs from deployment. Continue?")) {
      return;
    }
    setActionLoading(true);
    setAdminActionStatus(null);
    try {
      const res = await api.triggerReindex();
      setAdminActionStatus(`Reindex complete! Replayed ${res.processedEvents} events without altering user profiles.`);
      fetchAuditLogs();
    } catch (e: any) {
      setAdminActionStatus(`Reindex error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable blockchain event log indexed by Web3 indexer into PostgreSQL.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncChain}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
              Sync Events
            </button>
            <button
              onClick={handleReindexChain}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              Reindex Read Model
            </button>
          </div>
        )}
      </div>

      {adminActionStatus && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
          <span>{adminActionStatus}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <select
          value={contractFilter}
          onChange={(e) => {
            setContractFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
        >
          <option value="">All Contracts</option>
          <option value="ParticipantRegistry">ParticipantRegistry</option>
          <option value="ShipmentRegistry">ShipmentRegistry</option>
          <option value="TrackingManager">TrackingManager</option>
          <option value="DocumentRegistry">DocumentRegistry</option>
          <option value="EscrowManager">EscrowManager</option>
        </select>

        <select
          value={eventTypeFilter}
          onChange={(e) => {
            setEventTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
        >
          <option value="">All Event Types</option>
          <option value="ShipmentCreated">ShipmentCreated</option>
          <option value="StatusChanged">StatusChanged</option>
          <option value="ShipmentAccepted">ShipmentAccepted</option>
          <option value="ShipmentRejected">ShipmentRejected</option>
          <option value="MilestoneRecorded">MilestoneRecorded</option>
          <option value="CustodyTransferred">CustodyTransferred</option>
          <option value="DocumentRegistered">DocumentRegistered</option>
          <option value="EscrowDeposited">EscrowDeposited</option>
          <option value="EscrowReleased">EscrowReleased</option>
          <option value="EscrowRefunded">EscrowRefunded</option>
          <option value="ParticipantRegistered">ParticipantRegistered</option>
          <option value="ParticipantRevoked">ParticipantRevoked</option>
        </select>

        <button
          onClick={fetchAuditLogs}
          className="ml-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-400">Loading audit trail...</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-xs">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400">No events matched your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Block Height</th>
                  <th className="py-3 px-4">Contract</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-bold">
                      #{log.blockNumber}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {log.contractName}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.txHash?.substring(0, 10)}...{log.txHash?.substring(log.txHash.length - 6)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(Number(log.blockTime) * 1000).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setInspectEvent(log)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[10px] font-sans font-semibold transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} events
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-500" />
                Event: {inspectEvent.eventType}
              </h3>
              <span className="text-xs font-mono text-slate-400">Block #{inspectEvent.blockNumber}</span>
            </div>

            <div className="flex flex-col gap-3 text-xs mb-4">
              <div>
                <span className="text-slate-400 block">Contract Address:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{inspectEvent.contractAddress}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Transaction Hash:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 break-all">{inspectEvent.txHash}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Parsed Event Data:</span>
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-[11px] font-mono max-h-60">
                  {JSON.stringify(inspectEvent.eventData, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
