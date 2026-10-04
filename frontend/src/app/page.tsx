"use client";

import React from "react";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import {
  Boxes,
  Shield,
  Truck,
  FileCheck2,
  Coins,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  Layers,
  Database,
} from "lucide-react";

export default function Home() {
  const {
    account,
    displayAddress,
    isCorrectNetwork,
    role,
    roleName,
    isAuthenticated,
    isConnecting,
    isLoggingIn,
    authError,
    connectWallet,
    loginWithSignature,
    switchNetwork,
  } = useWallet();

  return (
    <div className="flex flex-col gap-12 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-900/20 via-indigo-950/40 to-slate-950 border border-blue-500/20 p-8 sm:p-12 shadow-2xl">
        <div className="max-w-3xl flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 w-fit">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            Blockchain Technology Academic Prototype
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Decentralized Supply Chain &amp;{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              Smart-Contract Logistics
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            CargoChain replaces fragmented paperwork with multi-party on-chain custody tracking,
            IPFS-anchored tamper-evident document verification, and milestone-conditioned test-ETH escrow.
          </p>

          {/* Quick Notice */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Configured for local demonstration on <strong>Ganache (Chain ID 1337)</strong>. All payments use simulated test-ETH.
            </span>
          </div>

          {/* Call to action card */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {!account ? (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-98 disabled:opacity-50"
              >
                <LogIn className="w-5 h-5" />
                {isConnecting ? "Connecting MetaMask..." : "Connect MetaMask Wallet"}
              </button>
            ) : !isAuthenticated ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={loginWithSignature}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Shield className="w-5 h-5" />
                  {isLoggingIn ? "Awaiting Signature..." : `Sign to Authenticate (${displayAddress})`}
                </button>
                {!isCorrectNetwork && (
                  <button
                    onClick={switchNetwork}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl text-xs font-semibold"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Switch to Chain 1337
                  </button>
                )}
              </div>
            ) : (
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all active:scale-98"
              >
                <Layers className="w-5 h-5" />
                Enter Dashboard as {roleName}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-xs">
              <strong>Authentication Error: </strong>
              {authError}
            </div>
          )}
        </div>
      </section>

      {/* Feature Pillar Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:border-blue-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Strict Lifecycle State Machine</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Multi-signature custody transfers and sequential status transitions enforced directly by Solidity smart contracts.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:border-indigo-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tamper-Evident IPFS Anchoring</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Bills of Lading and Inspection Certificates anchored on-chain by SHA-256 hash. Real-time file integrity verification prevents forgery.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:border-cyan-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Coins className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Conditional Test-ETH Escrow</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Freight payments are locked in EscrowManager and released only upon delivery confirmation, or refunded if rejected or cancelled.
          </p>
        </div>
      </section>

      {/* Demo Script Walkthrough Reference */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          Demo Script Guided Sequence (Acts 1–4)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="font-bold text-blue-400">Act 1: Identity &amp; Roles</span>
            <p className="text-slate-400 mt-1">Admin registers participants and validates on-chain role enforcement.</p>
          </div>
          <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="font-bold text-indigo-400">Act 2: Shipment Lifecycle</span>
            <p className="text-slate-400 mt-1">Shipper creates, Transporter accepts, dispatches, records milestones, and transfers custody.</p>
          </div>
          <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="font-bold text-cyan-400">Act 3: Documents &amp; Escrow</span>
            <p className="text-slate-400 mt-1">IPFS file upload, on-chain hash anchoring, verification, and escrow deposit/payout.</p>
          </div>
          <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="font-bold text-emerald-400">Act 4: Audit &amp; Recovery</span>
            <p className="text-slate-400 mt-1">Read-model PostgreSQL event audit trail and indexer rebuild verification.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
