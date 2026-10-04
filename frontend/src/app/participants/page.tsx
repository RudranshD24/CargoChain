"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { api, UserProfile } from "@/lib/api";
import { ROLE_LABELS } from "@/contracts/config";
import { getContracts, executeTransaction, TxStatus } from "@/lib/web3";
import { TxModal } from "@/components/ui/TxModal";
import {
  UserPlus,
  UserX,
  Shield,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export default function ParticipantsPage() {
  const { role, isAuthenticated, loginWithSignature } = useWallet();

  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  // Registration modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    address: "",
    role: 2,
    companyName: "",
    email: "",
    physicalAddress: "",
  });

  // Edit profile modal
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "",
    email: "",
    physicalAddress: "",
  });

  const fetchParticipants = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getParticipants(1, 50);
      setParticipants(res.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-blue-500 mb-3" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Please log in as Administrator to manage participants.</p>
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
  if (!isAdmin) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Access Restricted</h3>
        <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
          Only the contract <strong>Administrator</strong> (Role 1) has permission to register or revoke participants.
        </p>
      </div>
    );
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ethers.isAddress(regForm.address)) {
      alert("Invalid EVM wallet address");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        `Register Participant (${ROLE_LABELS[regForm.role]})`,
        () => contracts.participantRegistry.registerParticipant(regForm.address.trim(), regForm.role),
        setTxStatus
      );

      // Save off-chain metadata if provided
      if (regForm.companyName || regForm.email || regForm.physicalAddress) {
        try {
          await api.updateParticipantProfile(regForm.address.trim(), {
            companyName: regForm.companyName || undefined,
            email: regForm.email || undefined,
            physicalAddress: regForm.physicalAddress || undefined,
          });
        } catch (e) {
          console.warn("Could not save offchain profile immediately:", e);
        }
      }

      setShowRegisterModal(false);
      setRegForm({
        address: "",
        role: 2,
        companyName: "",
        email: "",
        physicalAddress: "",
      });
      fetchParticipants();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRevoke = async (participantAddr: string) => {
    if (!confirm(`Are you sure you want to revoke participant ${participantAddr}? This will block all future access.`)) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contracts = getContracts(signer);

      await executeTransaction(
        `Revoke Participant (${participantAddr.substring(0, 10)}...)`,
        () => contracts.participantRegistry.revokeParticipant(participantAddr),
        setTxStatus
      );

      fetchParticipants();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    try {
      await api.updateParticipantProfile(editTarget.address, editForm);
      setEditTarget(null);
      fetchParticipants();
    } catch (err: any) {
      alert(`Failed to update profile: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <TxModal
        status={txStatus}
        onClose={() => {
          setTxStatus(null);
          fetchParticipants();
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Participant Registry</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage canonical stakeholder roles, authorizations, and off-chain profile identities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchParticipants}
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Register Participant
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-400">Loading participants...</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-xs">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Wallet Address</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Company / Entity</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {participants.map((p) => {
                  const roleName = ROLE_LABELS[p.role] || `Role ${p.role}`;
                  return (
                    <tr key={p.address} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {p.address}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {roleName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {p.companyName || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{p.email || "—"}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditTarget(p);
                              setEditForm({
                                companyName: p.companyName || "",
                                email: p.email || "",
                                physicalAddress: p.physicalAddress || "",
                              });
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                            title="Edit off-chain metadata"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {p.isActive && p.role !== 1 && (
                            <button
                              onClick={() => handleRevoke(p.address)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-rose-600"
                              title="Revoke access on-chain"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Participant Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-4">Register New Participant</h3>
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">EVM Wallet Address *</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={regForm.address}
                  onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Canonical Role *</label>
                <select
                  value={regForm.role}
                  onChange={(e) => setRegForm({ ...regForm, role: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value={2}>Shipper</option>
                  <option value={3}>Transporter</option>
                  <option value={4}>Warehouse</option>
                  <option value={5}>Inspector</option>
                  <option value={6}>Receiver</option>
                  <option value={7}>Oracle</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Company / Entity Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Logistics Ltd."
                  value={regForm.companyName}
                  onChange={(e) => setRegForm({ ...regForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@example.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Sign Registration (MetaMask)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-1">Edit Off-Chain Profile</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">{editTarget.address}</p>

            <form onSubmit={handleEditProfileSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Company Name</label>
                <input
                  type="text"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Physical Address / Depot Location</label>
                <input
                  type="text"
                  value={editForm.physicalAddress}
                  onChange={(e) => setEditForm({ ...editForm, physicalAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
