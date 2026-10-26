"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { getContracts, executeTransaction, TxStatus, normalizeEvmAddress } from "@/lib/web3";
import { TxModal } from "@/components/ui/TxModal";
import {
  Boxes,
  Truck,
  Coins,
  Shield,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { DEMO_ACCOUNTS, ROLE_LABELS } from "@/contracts/config";

export default function NewShipmentPage() {
  const router = useRouter();
  const { role, roleName, account, isAuthenticated, loginWithSignature } = useWallet();

  const [form, setForm] = useState({
    externalRef: `CARGO-${Date.now().toString().slice(-6)}`,
    productDescription: "Pharmaceutical Vaccines (Cold Chain)",
    quantity: "500",
    origin: "Mumbai Port Logistics Hub",
    destination: "Delhi Central Medical Warehouse",
    destLat: "28.6139",
    destLon: "77.2090",
    geofenceRadiusM: "1000",
    transporter: DEMO_ACCOUNTS.transporter,
    receiver: DEMO_ACCOUNTS.receiver,
    warehouse: DEMO_ACCOUNTS.warehouse,
    inspector: DEMO_ACCOUNTS.inspector,
    expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    paymentEth: "0.5",
  });

  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-blue-500 mb-3" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Please log in with MetaMask to create a shipment.</p>
        <button
          onClick={loginWithSignature}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors"
        >
          Sign with MetaMask
        </button>
      </div>
    );
  }

  const isShipper = role === 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Enforce smart contract role prerequisite before attempting on-chain transaction
    if (!isShipper) {
      setFormError(
        `Unauthorized: Only accounts registered with Role.Shipper can create shipments on-chain. You are currently connected as ${roleName || "Unassigned"} (${account}). Please switch to Account 1 (Shipper: ${DEMO_ACCOUNTS.shipper}) in MetaMask.`
      );
      return;
    }

    // Normalize and validate EVM addresses (case-tolerant and whitespace-tolerant)
    const transporterAddr = normalizeEvmAddress(form.transporter);
    if (!transporterAddr) {
      setFormError("Valid EVM address required for Transporter (40-hex Ethereum address)");
      return;
    }

    const receiverAddr = normalizeEvmAddress(form.receiver);
    if (!receiverAddr) {
      setFormError("Valid EVM address required for Receiver (40-hex Ethereum address)");
      return;
    }

    let warehouseAddr = ethers.ZeroAddress;
    if (form.warehouse && form.warehouse.trim()) {
      const parsed = normalizeEvmAddress(form.warehouse);
      if (!parsed) {
        setFormError("Warehouse address is invalid (must be a 40-hex Ethereum address or empty)");
        return;
      }
      warehouseAddr = parsed;
    }

    let inspectorAddr = ethers.ZeroAddress;
    if (form.inspector && form.inspector.trim()) {
      const parsed = normalizeEvmAddress(form.inspector);
      if (!parsed) {
        setFormError("Inspector address is invalid (must be a 40-hex Ethereum address or empty)");
        return;
      }
      inspectorAddr = parsed;
    }

    setSubmitting(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      // Convert externalRef to bytes32
      const refBytes32 = ethers.keccak256(ethers.toUtf8Bytes(form.externalRef.trim()));
      const deliveryTimestamp = Math.floor(new Date(form.expectedDelivery).getTime() / 1000);
      const paymentWei = ethers.parseEther(form.paymentEth || "0");

      const input = {
        externalRef: refBytes32,
        productDescription: form.productDescription.trim(),
        quantity: parseInt(form.quantity, 10),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        destLat: Math.round(parseFloat(form.destLat) * 1e6),
        destLon: Math.round(parseFloat(form.destLon) * 1e6),
        geofenceRadiusM: parseInt(form.geofenceRadiusM, 10),
        transporter: transporterAddr,
        receiver: receiverAddr,
        warehouse: warehouseAddr,
        inspector: inspectorAddr,
        expectedDelivery: deliveryTimestamp,
        paymentAmount: paymentWei,
      };

      await executeTransaction(
        "Create On-Chain Shipment",
        () => contracts.shipmentRegistry.createShipment(input),
        setTxStatus
      );
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <TxModal
        status={txStatus}
        onClose={() => {
          if (txStatus?.step === "success") {
            router.push("/shipments");
          }
          setTxStatus(null);
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/shipments"
          className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Create New Shipment</h1>
          <p className="text-xs text-slate-500">
            Submit a new cargo shipment to the ShipmentRegistry smart contract.
          </p>
        </div>
      </div>

      {/* Role Mismatch Warning Banner */}
      {!isShipper && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-200">
              Role Mismatch: Connected as {roleName || "Unassigned"} ({account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not connected"})
            </h4>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1">
              By design, CargoChain smart contracts enforce <strong>separation of duties</strong>: only registered <strong>Shippers</strong> (<code className="px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-[11px]">Role.Shipper</code>) can create shipments.
            </p>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1.5">
              👉 Please open <strong>MetaMask</strong> and switch to <strong>Account 1</strong> (Shipper address: <code className="px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-[11px] font-bold">{DEMO_ACCOUNTS.shipper}</code>) to sign and submit this shipment.
            </p>
          </div>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        {/* Section 1: Cargo & Route */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-500" />
            1. Cargo Details &amp; Route
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                External Reference (Unique SKU/ID)
              </label>
              <input
                type="text"
                required
                value={form.externalRef}
                onChange={(e) => setForm({ ...form, externalRef: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Quantity (Units)
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Product Description
              </label>
              <input
                type="text"
                required
                value={form.productDescription}
                onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Origin Facility</label>
              <input
                type="text"
                required
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Destination Facility</label>
              <input
                type="text"
                required
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Assigned Stakeholders */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-500" />
              2. Assigned Stakeholders (Canonical Roles)
            </h2>
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  transporter: DEMO_ACCOUNTS.transporter,
                  receiver: DEMO_ACCOUNTS.receiver,
                  warehouse: DEMO_ACCOUNTS.warehouse,
                  inspector: DEMO_ACCOUNTS.inspector,
                }));
              }}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Reset Demo Stakeholders
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Transporter Wallet Address *
              </label>
              <input
                type="text"
                required
                placeholder="0x..."
                value={form.transporter}
                onChange={(e) => setForm({ ...form, transporter: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Must be registered with Role.Transporter (Account 2)</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Receiver Wallet Address *
              </label>
              <input
                type="text"
                required
                placeholder="0x..."
                value={form.receiver}
                onChange={(e) => setForm({ ...form, receiver: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Must be registered with Role.Receiver (Account 5)</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Warehouse Wallet Address (Optional)
              </label>
              <input
                type="text"
                placeholder="0x... (leave empty if not applicable)"
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Role.Warehouse (Account 3)</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Inspector Wallet Address (Optional)
              </label>
              <input
                type="text"
                placeholder="0x... (leave empty if not applicable)"
                value={form.inspector}
                onChange={(e) => setForm({ ...form, inspector: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Role.Inspector (Account 4)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Delivery Terms & Escrow */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-cyan-500" />
            3. Delivery Commitment &amp; Escrow Terms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Expected Delivery Date *
              </label>
              <input
                type="date"
                required
                value={form.expectedDelivery}
                onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Payment Amount (Ganache Test ETH)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.paymentEth}
                onChange={(e) => setForm({ ...form, paymentEth: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">
                Locked in EscrowManager. 0 means no escrow deposit required.
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-end gap-3">
          <Link
            href="/shipments"
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !isShipper}
            title={!isShipper ? "Switch to Account 1 (Shipper) in MetaMask to submit" : undefined}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            {!isShipper
              ? "Switch to Account 1 (Shipper) in MetaMask"
              : submitting
              ? "Signing in Wallet..."
              : "Sign & Create Shipment"}
          </button>
        </div>
      </form>
    </div>
  );
}
