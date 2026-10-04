"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Cpu,
  Zap,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  BarChart3,
  Layers,
  Network,
  Info,
} from "lucide-react";

export default function ConsensusPage() {
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("pbft");
  const [activeTab, setActiveTab] = useState<"single" | "compare">("single");

  // Simulation Form Parameters
  const [nodesCount, setNodesCount] = useState<number>(7);
  const [faultyCount, setFaultyCount] = useState<number>(1);
  const [workloadBlocks, setWorkloadBlocks] = useState<number>(4);
  const [networkLatency, setNetworkLatency] = useState<number>(40);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [difficulty, setDifficulty] = useState<number>(2);
  const [authoritiesCount, setAuthoritiesCount] = useState<number>(4);

  // Results
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [compareResult, setCompareResult] = useState<any | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await api.getConsensusModels();
        setModels(data);
      } catch (err: any) {
        console.error("Failed to load consensus models", err);
      }
    }
    loadModels();
  }, []);

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        mechanism: selectedModel,
        nodes_count: Number(nodesCount),
        faulty_nodes_count: Number(faultyCount),
        workload_blocks: Number(workloadBlocks),
        network_latency_ms: Number(networkLatency),
        seed: Number(randomSeed),
        parameters: {},
      };
      if (selectedModel === "pow") payload.parameters.difficulty = Number(difficulty);
      if (selectedModel === "poa") payload.parameters.authorities_count = Number(authoritiesCount);

      const res = await api.simulateConsensus(payload);
      setSimResult(res);
    } catch (err: any) {
      setError(err.message || "Simulation failed to execute");
    } finally {
      setLoading(false);
    }
  };

  const handleRunComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        mechanisms: ["pow", "pos", "pbft", "poa", "poet"],
        nodes_count: Number(nodesCount),
        faulty_nodes_count: Number(faultyCount),
        workload_blocks: Number(workloadBlocks),
        network_latency_ms: Number(networkLatency),
        seed: Number(randomSeed),
      };
      const res = await api.compareConsensus(payload);
      setCompareResult(res);
    } catch (err: any) {
      setError(err.message || "Comparison failed to execute");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              Phase 5 Analytical Lab
            </span>
            <span className="text-xs text-slate-500">• In-Memory Discrete Event Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-400" />
            Consensus Mechanism Simulator
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyze and compare blockchain consensus protocols (PoW, PoS, PBFT, PoA, PoET) under configurable latency and byzantine fault injection.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "single"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Protocol Explorer
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "compare"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Cross-Protocol Benchmark
          </button>
        </div>
      </div>

      {/* Isolation Notice Banner */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">Strict Educational Isolation: </span>
          This simulator operates entirely as an in-memory discrete event model for academic demonstration. It does not alter, replace, or submit transactions to Ganache Chain 1337.
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Single Protocol Explorer */}
      {activeTab === "single" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Simulation Parameters
              </h2>

              {/* Protocol Selector */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  Consensus Protocol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "pow", label: "PoW (Mining)" },
                    { id: "pos", label: "PoS (Staking)" },
                    { id: "pbft", label: "PBFT (3-Phase)" },
                    { id: "poa", label: "PoA (Authority)" },
                    { id: "poet", label: "PoET (Enclave)" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedModel(p.id)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all ${
                        selectedModel === p.id
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Participating Nodes (N)</span>
                    <span className="text-white font-mono">{nodesCount}</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="20"
                    value={nodesCount}
                    onChange={(e) => setNodesCount(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Faulty / Byzantine Nodes (f)</span>
                    <span className="text-amber-400 font-mono">{faultyCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, Math.floor((nodesCount - 1) / 2))}
                    value={faultyCount}
                    onChange={(e) => setFaultyCount(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  {selectedModel === "pbft" && (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Max tolerable for PBFT: f ≤ {(nodesCount - 1) / 3 | 0}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Workload (Blocks)</span>
                    <span className="text-white font-mono">{workloadBlocks}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={workloadBlocks}
                    onChange={(e) => setWorkloadBlocks(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Network Latency (ms)</span>
                    <span className="text-white font-mono">{networkLatency} ms</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={networkLatency}
                    onChange={(e) => setNetworkLatency(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Random Seed</span>
                    <span className="text-white font-mono">{randomSeed}</span>
                  </div>
                  <input
                    type="number"
                    value={randomSeed}
                    onChange={(e) => setRandomSeed(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>

                {selectedModel === "pow" && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Mining Difficulty (Zeros)</span>
                      <span className="text-indigo-400 font-mono">{difficulty}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}

                {selectedModel === "poa" && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Designated Authorities</span>
                      <span className="text-indigo-400 font-mono">{authoritiesCount}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max={nodesCount}
                      value={authoritiesCount}
                      onChange={(e) => setAuthoritiesCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Simulation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSimResult(null)}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-2 space-y-4">
            {!simResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <Activity className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">No Simulation Executed</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select a protocol, configure parameters, and click &ldquo;Run Simulation&rdquo; to model block proposals, message exchange, and finality.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Avg Latency</span>
                    <span className="text-lg font-bold text-white font-mono mt-0.5 block">
                      {simResult.metrics.average_block_latency_ms} <span className="text-xs font-normal text-slate-400">ms</span>
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Throughput</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                      {simResult.metrics.throughput_blocks_per_sec} <span className="text-xs font-normal text-slate-400">bps</span>
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Messages Exchanged</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono mt-0.5 block">
                      {simResult.metrics.total_messages_exchanged}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Energy Footprint</span>
                    <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
                      {simResult.metrics.estimated_energy_joules > 1000
                        ? `${(simResult.metrics.estimated_energy_joules / 1000).toFixed(1)} kJ`
                        : `${simResult.metrics.estimated_energy_joules} J`}
                    </span>
                  </div>
                </div>

                {/* Finality and Fault Tolerance Indicators */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Finality Model</span>
                    <span className="text-slate-200 font-medium">{simResult.metrics.consensus_finality_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Fault Tolerance Threshold</span>
                    <span className="text-indigo-300 font-medium">{simResult.metrics.bft_tolerance_limit}</span>
                  </div>
                </div>

                {/* Proposed Blocks List */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Simulated Blocks ({simResult.blocks.length})
                  </h3>
                  <div className="space-y-2">
                    {simResult.blocks.map((b: any) => (
                      <div
                        key={b.block_number}
                        className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                              b.accepted ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            #{b.block_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">Proposer: {b.proposer_id}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({b.transaction_count} txs)
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              Hash: {b.hash.slice(0, 16)}...
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {b.accepted ? (
                              <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-rose-400 text-[11px] font-medium">
                                <XCircle className="w-3.5 h-3.5" /> Rejected
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {b.round_latency_ms} ms • {b.messages_exchanged} msgs
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event Log Terminal */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-semibold text-xs flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      Discrete Event Timeline
                    </span>
                    <span className="text-[10px] text-slate-500">{simResult.events.length} events logged</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-2">
                    {simResult.events.map((e: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-400">
                        <span className="text-slate-600 font-mono text-[10px]">
                          [{e.timestamp_ms.toFixed(1)}ms]
                        </span>
                        <span className="text-indigo-400 font-semibold text-[10px]">[{e.step}]</span>
                        <span className="text-slate-300">{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cross-Protocol Comparison Tab */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Cross-Protocol Benchmark Matrix</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates PoW, PoS, PBFT, PoA, and PoET under identical node topology (N={nodesCount}, f={faultyCount}, {workloadBlocks} blocks).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunComparison}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Run Benchmark
                </>
              )}
            </button>
          </div>

          {compareResult && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Protocol</th>
                      <th className="p-3">Avg Latency</th>
                      <th className="p-3">Throughput</th>
                      <th className="p-3">Messages</th>
                      <th className="p-3">Simulated Energy</th>
                      <th className="p-3">Finality Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {Object.entries(compareResult.results).map(([mech, m]: [string, any]) => (
                      <tr key={mech} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-white uppercase">{mech}</td>
                        <td className="p-3 font-mono text-slate-300">{m.average_block_latency_ms} ms</td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">{m.throughput_blocks_per_sec} bps</td>
                        <td className="p-3 font-mono text-slate-300">{m.total_messages_exchanged}</td>
                        <td className="p-3 font-mono text-amber-400 font-semibold">
                          {m.estimated_energy_joules > 1000
                            ? `${(m.estimated_energy_joules / 1000).toFixed(1)} kJ`
                            : `${m.estimated_energy_joules} J`}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{m.consensus_finality_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Analytical Insights */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Academic Analytical Insights
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside">
                  {compareResult.analysis.map((obs: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
