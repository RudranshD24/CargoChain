"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import {
  Radio,
  AlertTriangle,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Shield,
  RefreshCw,
  Info,
} from "lucide-react";

export default function OracleConsolePage() {
  const { role, isAuthenticated, loginWithSignature } = useWallet();
  const isAdmin = role === 1;

  const [oracleStatus, setOracleStatus] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Scenario Form state
  const [shipmentIdInput, setShipmentIdInput] = useState<string>("1");
  const [scenarioType, setScenarioType] = useState<"normal" | "delayed" | "deviated">("normal");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await api.getOracleStatus();
      setOracleStatus(statusRes);
      const eventsRes = await api.getOracleEvents();
      setEvents(eventsRes.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load oracle service status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLaunchScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(shipmentIdInput, 10);
    if (isNaN(id) || id <= 0) {
      setError("Please enter a valid shipment ID");
      return;
    }

    setLaunching(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.startOracleScenario({
        shipmentId: id,
        scenarioType: scenarioType,
        name: `Oracle-${scenarioType.toUpperCase()}-Shipment-${id}`,
      });
      setSuccessMsg(`Scenario ${res.name} executed successfully (${res.totalSteps} steps completed).`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to execute oracle scenario");
    } finally {
      setLaunching(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <Radio className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Wallet Connection Required</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 mb-6">
            Connect your MetaMask wallet with signature authentication to access the Oracle service console.
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

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-8">
          <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200">Admin Privileges Required</h2>
          <p className="text-amber-700 dark:text-amber-400 mt-2">
            The Oracle scenario launcher is restricted to administrators. Switch to an Admin account to simulate routes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Oracle Service & Route Scenarios</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Restricted service account for external telemetry reporting & deterministic scenario simulations
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Critical Trust Boundary Callout */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
        <Info className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200">Oracle Trust Boundary (U3 / Security Model)</h3>
          <p className="text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
            An on-chain transaction proves that an authorized, designated Oracle key submitted a claim. It does{" "}
            <strong>not</strong> independently prove the physical ground event took place. In CargoChain, all oracle-reported
            milestones are labeled as <em>External Reports</em> with cryptographic provenance, and arrival is cryptographically
            guarded by destination microdegree geofences.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Status & Scenario Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Restricted Oracle Signer
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Oracle Account Address</span>
              <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-800 dark:text-slate-200 break-all mt-1">
                {oracleStatus?.oracleAddress || "Loading..."}
              </p>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Account Role</span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Role.Oracle (7)
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Signer Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active / Authorized
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Test ETH Balance</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {oracleStatus?.balanceWei ? (Number(oracleStatus.balanceWei) / 1e18).toFixed(4) : "0.0000"} ETH
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600 dark:text-slate-400">Active Scenarios</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {oracleStatus?.activeScenarios ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Scenario Launcher Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-600" />
            Launch Deterministic Route Scenario
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Execute bounded milestone sequences signed by the Oracle account to verify contract geofencing and state transitions.
          </p>

          <form onSubmit={handleLaunchScenario} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Target Shipment ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={shipmentIdInput}
                  onChange={(e) => setShipmentIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Scenario Route Profile
                </label>
                <select
                  value={scenarioType}
                  onChange={(e: any) => setScenarioType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="normal">Normal (4 Waypoints, Within Geofence, Arrived)</option>
                  <option value="delayed">Delayed (Waypoint, Traffic Stoppage Delay, Arrived)</option>
                  <option value="deviated">Deviated (Off-Route Waypoint, Geofence Reject, Corrected Arrival)</option>
                </select>
              </div>
            </div>

            {/* Scenario Explanation Box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs space-y-1.5 border border-slate-200 dark:border-slate-750">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Execution Flow for {scenarioType.toUpperCase()}:</span>
              {scenarioType === "normal" && (
                <p className="text-slate-600 dark:text-slate-400">
                  Submits 3 in-corridor waypoints and a 4th waypoint inside the destination geofence radius. Transitions status to <strong>Arrived</strong>.
                </p>
              )}
              {scenarioType === "delayed" && (
                <p className="text-slate-600 dark:text-slate-400">
                  Submits departure waypoint, calls <code>TrackingManager.markDelayed</code> to trigger <strong>Delayed</strong> status, resumes transit and arrives.
                </p>
              )}
              {scenarioType === "deviated" && (
                <p className="text-slate-600 dark:text-slate-400">
                  Submits an off-corridor waypoint (flagged <code>inGeofence=false</code>), attempts a premature arrival 50km away (reverts on-chain with <code>OutsideGeofence</code>), then returns to the corridor for valid arrival.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={launching}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium rounded-xl shadow-md transition-all disabled:opacity-60"
            >
              {launching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing Scenario on Ganache...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Execute Scenario Simulation
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Oracle Events & Waypoints Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Oracle Waypoint Reports</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified on-chain submissions emitted as <code>OracleUpdateRecorded</code> events
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
            {events.length} Total Reports
          </span>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
            <Radio className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            No oracle waypoint reports recorded yet. Launch a scenario above to test.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Shipment</th>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">Microdegree Coordinates</th>
                  <th className="py-3 px-4">Geofence Status</th>
                  <th className="py-3 px-4">Signer / Provenance</th>
                  <th className="py-3 px-4">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      #{ev.shipmentId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {ev.milestoneTypeName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {ev.lat / 1e6}°, {ev.lon / 1e6}°
                    </td>
                    <td className="py-3 px-4">
                      {ev.inGeofence ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Within Geofence
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          Deviated / Outside
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Oracle: {ev.reporter.slice(0, 6)}...{ev.reporter.slice(-4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                      {ev.txHash ? `${ev.txHash.slice(0, 8)}...` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
