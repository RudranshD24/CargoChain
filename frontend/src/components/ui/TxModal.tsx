"use client";

import React from "react";
import { TxStatus } from "@/lib/web3";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface TxModalProps {
  status: TxStatus | null;
  onClose: () => void;
}

export function TxModal({ status, onClose }: TxModalProps) {
  if (!status || status.step === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="text-center">
          {status.step === "awaiting_signature" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Awaiting Signature</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {status.message || "Please confirm this transaction in your MetaMask wallet."}
              </p>
            </div>
          )}

          {status.step === "confirming" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-full flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Broadcasting Transaction</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {status.message || "Awaiting block confirmation on Ganache..."}
              </p>
              {status.txHash && (
                <div className="mt-4 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 w-full break-all border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 select-none">Tx: </span>
                  {status.txHash}
                </div>
              )}
            </div>
          )}

          {status.step === "syncing" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Updating Read Model</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {status.message || "Transaction mined! Indexing event into PostgreSQL database..."}
              </p>
              {status.blockNumber && (
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  Block Height: #{status.blockNumber}
                </div>
              )}
            </div>
          )}

          {status.step === "success" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Confirmed</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {status.message || "Operation successfully executed and confirmed on-chain."}
              </p>
              {status.txHash && (
                <div className="mt-4 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 w-full break-all border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 select-none">Tx: </span>
                  {status.txHash}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-6 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
              >
                Close & View Updates
              </button>
            </div>
          )}

          {status.step === "error" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 rounded-full flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Action Reverted</h3>
              <p className="text-sm text-rose-600 dark:text-rose-400 mt-2 break-words">
                {status.error || "An error occurred while executing the transaction."}
              </p>
              <button
                onClick={onClose}
                className="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium rounded-xl text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
