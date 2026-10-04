"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Brain,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Info,
  Calendar,
} from "lucide-react";

interface MLEtaPredictionCardProps {
  shipmentId: number;
}

export function MLEtaPredictionCard({ shipmentId }: MLEtaPredictionCardProps) {
  const [prediction, setPrediction] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.predictETA({ shipment_id: shipmentId });
      setPrediction(res);
    } catch (err: any) {
      setError(err.message || "Failed to load ETA estimation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) {
      fetchPrediction();
    }
  }, [shipmentId]);

  const getRiskBadge = (category: string, prob: number) => {
    const pct = Math.round(prob * 100);
    switch (category) {
      case "HIGH":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> High Delay Risk ({pct}%)
          </span>
        );
      case "MODERATE":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Moderate Delay Risk ({pct}%)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> On Track / Low Risk ({pct}%)
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">AI Delivery ETA &amp; Delay Risk</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                Decision Support
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Predictive transit modeling based on historical lane friction and environmental indices.
            </p>
          </div>
        </div>

        <button
          onClick={fetchPrediction}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh AI Estimate"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span>Computing predictive transit profile...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span>Predictive estimation unavailable: {error}</span>
        </div>
      ) : prediction ? (
        <div className="space-y-4">
          {/* Main Key Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Remaining Transit</span>
              <span className="text-xl font-bold text-white font-mono mt-1 block">
                {prediction.predicted_remaining_hours}{" "}
                <span className="text-xs font-normal text-slate-400">hours</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                90% CI: [{prediction.confidence_interval_hours.lower_bound_hours}h - {prediction.confidence_interval_hours.upper_bound_hours}h]
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Predicted Arrival</span>
              <span className="text-sm font-bold text-indigo-300 mt-1 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {prediction.predicted_eta_timestamp
                  ? new Date(prediction.predicted_eta_timestamp * 1000).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Within 24 hours"}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Total duration: ~{prediction.predicted_total_duration_hours}h
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Late Delivery Risk</span>
              <div className="mt-1">
                {getRiskBadge(prediction.delay_risk_category, prediction.delay_risk_probability)}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                Model: {prediction.model_version}
              </span>
            </div>
          </div>

          {/* Contributing Risk Factors */}
          {prediction.contributing_factors && prediction.contributing_factors.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-indigo-400" />
                Top Model Explanatory Factors
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {prediction.contributing_factors.map((f: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] flex flex-col"
                  >
                    <span className="text-slate-400 truncate">{f.feature.replace(/_/g, " ")}</span>
                    <span className="text-slate-200 font-mono font-medium mt-0.5">
                      Importance: {(f.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explicit Academic Caveat Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300/90 leading-relaxed">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-amber-300">Decision-Support Safeguard: </span>
              {prediction.caveat}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
