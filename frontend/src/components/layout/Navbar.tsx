"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import {
  Boxes,
  Truck,
  PlusCircle,
  Users,
  History,
  BarChart3,
  LogIn,
  LogOut,
  AlertTriangle,
  Shield,
  Layers,
  Radio,
  Network,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const {
    account,
    displayAddress,
    isCorrectNetwork,
    role,
    roleName,
    isAuthenticated,
    isConnecting,
    isLoggingIn,
    connectWallet,
    loginWithSignature,
    logout,
    switchNetwork,
  } = useWallet();

  const isShipper = role === 2;
  const isAdmin = role === 1;
  const isInspector = role === 5;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Layers, show: isAuthenticated },
    { href: "/shipments", label: "Shipments", icon: Truck, show: isAuthenticated },
    { href: "/shipments/new", label: "New Shipment", icon: PlusCircle, show: isShipper || isAdmin },
    { href: "/disputes", label: "Disputes", icon: AlertTriangle, show: isAuthenticated },
    { href: "/oracle", label: "Oracle", icon: Radio, show: isAdmin },
    { href: "/participants", label: "Participants", icon: Users, show: isAdmin },
    { href: "/audit", label: "Audit Log", icon: History, show: isAdmin || isInspector },
    { href: "/analytics", label: "Analytics", icon: BarChart3, show: isAuthenticated },
    { href: "/consensus", label: "Consensus", icon: Network, show: true },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                CargoChain
              </span>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 -mt-1">
                Logistics dApp
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks
              .filter((l) => l.show)
              .map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Network & Wallet Controls */}
        <div className="flex items-center gap-3">
          {/* Network indicator */}
          {account && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800">
              {isCorrectNetwork ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-700 dark:text-slate-300">Ganache (1337)</span>
                </>
              ) : (
                <button
                  onClick={switchNetwork}
                  className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Switch to 1337</span>
                </button>
              )}
            </div>
          )}

          {/* Wallet / Session State */}
          {!account ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : !isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">{displayAddress}</span>
              <button
                onClick={loginWithSignature}
                disabled={isLoggingIn}
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Shield className="w-3.5 h-3.5" />
                {isLoggingIn ? "Signing..." : "Sign to Login"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {/* Role Badge */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                {roleName}
              </span>

              {/* Account Address */}
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
                  {displayAddress}
                </span>
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                title="Disconnect & Logout"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
