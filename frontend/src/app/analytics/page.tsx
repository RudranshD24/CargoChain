"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@/contracts/config";
import {
  Package,
  CheckCircle2,
  Users,
  RefreshCw,
  Truck,
  Shield,
  Clock,
  MapPin,
  AlertTriangle,
  Navigation,
} from "lucide-react";

export default function AnalyticsPage() {
  const { isAuthenticated, loginWithSignature } = useWallet();

  const [analytics, setAnalytics] = useState<any>(null);
  const [advancedData, setAdvancedData] = useState<any>(null);
  const [corridorsData, setCorridorsData] = useState<any>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [summary, adv, corridors] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAdvancedAnalytics(),
        api.getRouteCorridors(),
      ]);
      setAnalytics(summary);
      setAdvancedData(adv);
      setCorridorsData(corridors);
      if (corridors?.corridors?.length > 0) {
        setSelectedCorridorId(corridors.corridors[0].shipmentId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load operational analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-blue-500 mb-3" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Please log in to view operational analytics.</p>
        <button
          onClick={loginWithSignature}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
        >
          Sign with MetaMask
        </button>
      </div>
    );
  }

  const total = analytics?.totalShipments || 0;
  const statusCounts = analytics?.statusCounts || {};
  const activeParticipants = analytics?.activeParticipants || 0;

  const selectedCorridor = corridorsData?.corridors?.find(
    (c: any) => c.shipmentId === selectedCorridorId
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Operational & Advanced Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time aggregate logistics metrics reconciled from on-chain event projections and spatial corridors.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* Synthetic Advisory Banner */}
      <div className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Academic & Demonstration Notice:</strong> Analytics metrics reflect local Ganache events and synthetic freight data. Metrics are read-only and do not execute automated blockchain contract writes.
        </span>
      </div>

      {loading ? (
        <div className="p-20 text-center text-sm text-slate-400">Loading analytics...</div>
      ) : error ? (
        <div className="p-8 text-center text-rose-500 text-xs">{error}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Handled</span>
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{total}</div>
              <div className="text-[11px] text-slate-400 mt-1">Total cargo shipments registered</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active In Transit</span>
                <Truck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {statusCounts.InTransit || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cargo in active transport</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Delivered / Done</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {(statusCounts.Completed || 0) + (statusCounts.Delivered || 0)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Confirmed intact deliveries</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Network</span>
                <Users className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{activeParticipants}</div>
              <div className="text-[11px] text-slate-400 mt-1">Registered active participants</div>
            </div>
          </div>

          {/* Phase 6: Lifecycle Duration Breakdown */}
          {advancedData?.lifecycleDuration && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Shipment Lifecycle Duration Breakdown
                  </h2>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                  Scope: {advancedData.scope}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Create → Dispatch</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {advancedData.lifecycleDuration.avgCreatedToTransitHours} hrs
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Origin staging latency</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Transit → Delivery</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {advancedData.lifecycleDuration.avgTransitToDeliveredHours} hrs
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Corridor movement duration</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Delivery → Completion</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {advancedData.lifecycleDuration.avgDeliveredToCompletedHours} hrs
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Receiver acceptance & settlement</div>
                </div>

                <div className="p-4 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Cycle Time</div>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {advancedData.lifecycleDuration.avgTotalLifecycleHours} hrs
                  </div>
                  <div className="text-[10px] text-blue-500/80 mt-0.5">End-to-end provenance duration</div>
                </div>
              </div>
            </div>
          )}

          {/* Phase 6: Route Corridor Waypoint Visualizer */}
          {corridorsData?.corridors && corridorsData.corridors.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Spatial Route Corridor & Waypoint Progression
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Select Corridor:</label>
                  <select
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    value={selectedCorridorId || ""}
                    onChange={(e) => setSelectedCorridorId(Number(e.target.value))}
                  >
                    {corridorsData.corridors.map((c: any) => (
                      <option key={c.shipmentId} value={c.shipmentId}>
                        #{c.shipmentId} ({c.origin} → {c.destination})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCorridor && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reference:</span>
                      <span className="font-mono font-semibold">{selectedCorridor.externalRef.slice(0, 16)}...</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Status:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedCorridor.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Destination Geofence:</span>
                      <span className="font-semibold">{selectedCorridor.destLat}°, {selectedCorridor.destLon}°</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Geofence Radius:</span>
                      <span className="font-semibold">{selectedCorridor.geofenceRadiusM} meters</span>
                    </div>
                  </div>

                  {/* Waypoint Sequence Timeline */}
                  <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 flex flex-col gap-4 my-2">
                    {selectedCorridor.waypoints.map((wp: any, idx: number) => (
                      <div key={idx} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div
                          className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${
                            wp.inGeofence ? "border-emerald-500 bg-emerald-500" : "border-blue-500"
                          }`}
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Step {wp.step}: {wp.locationName}</span>
                            {wp.inGeofence && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                                Within Geofence
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Lat: {wp.lat.toFixed(6)} | Lon: {wp.lon.toFixed(6)}
                          </div>
                        </div>
                        {wp.timestamp && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {new Date(wp.timestamp * 1000).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transporter SLA & Corridor Delays Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transporter SLA Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" />
                Transporter SLA Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2">Transporter</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">On-Time</th>
                      <th className="pb-2">Delayed</th>
                      <th className="pb-2">SLA %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {advancedData?.transporterSLA?.map((t: any) => (
                      <tr key={t.transporter}>
                        <td className="py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {t.transporter.slice(0, 10)}...{t.transporter.slice(-6)}
                        </td>
                        <td className="py-2.5 font-semibold">{t.totalShipments}</td>
                        <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          {t.onTimeShipments}
                        </td>
                        <td className="py-2.5 text-amber-600 dark:text-amber-400 font-semibold">
                          {t.delayedShipments}
                        </td>
                        <td className="py-2.5 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              t.onTimeRatePercent >= 90
                                ? "bg-emerald-500/10 text-emerald-600"
                                : t.onTimeRatePercent >= 75
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {t.onTimeRatePercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Corridor Lane Delays */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                Corridor Lane Delay Analytics
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2">Lane (Origin → Dest)</th>
                      <th className="pb-2">Volume</th>
                      <th className="pb-2">Delayed</th>
                      <th className="pb-2">Avg Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {advancedData?.corridorDelays?.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {c.origin} → {c.destination}
                        </td>
                        <td className="py-2.5 font-semibold">{c.shipmentCount}</td>
                        <td className="py-2.5 text-amber-600 dark:text-amber-400 font-semibold">
                          {c.delayedCount}
                        </td>
                        <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">
                          {c.avgDelayHours} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Status Breakdown Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Shipment Status Distribution
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(STATUS_LABELS).map(([code, label]) => {
                const count = statusCounts[label.replace(/\s+/g, "")] ?? statusCounts[label] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div
                    key={code}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
