"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { CHAIN_ID, ROLE_LABELS } from "@/contracts/config";
import { api, UserProfile, ApiException } from "@/lib/api";
import { getEthereumProvider, ensureCorrectNetwork } from "@/lib/web3";

interface WalletContextType {
  account: string | null;
  displayAddress: string;
  chainId: number | null;
  isCorrectNetwork: boolean;
  role: number;
  roleName: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  connectWallet: () => Promise<void>;
  loginWithSignature: () => Promise<boolean>;
  logout: () => void;
  switchNetwork: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [role, setRole] = useState<number>(0);
  const [roleName, setRoleName] = useState<string>("None");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isCorrectNetwork = chainId === CHAIN_ID;

  const displayAddress = account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
    : "";

  const checkNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
    } catch (e) {
      console.error("Failed to get network chainId:", e);
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cargochain_token");
      localStorage.removeItem("cargochain_user");
    }
    setUser(null);
    setRole(0);
    setRoleName("None");
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cargochain_token") : null;
    if (!token) return;

    try {
      const profile = await api.getMe();
      setUser(profile);
      setRole(profile.role);
      setRoleName(profile.roleName || ROLE_LABELS[profile.role] || "Unknown");
      setAuthError(null);
    } catch (err: any) {
      if (err instanceof ApiException && (err.statusCode === 401 || err.statusCode === 403)) {
        logout();
        setAuthError(err.message);
      }
    }
  }, [logout]);

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setAuthError("No EVM wallet detected. Please install MetaMask.");
      return;
    }

    setIsConnecting(true);
    setAuthError(null);

    try {
      const provider = await getEthereumProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts && accounts.length > 0) {
        const addr = accounts[0].toLowerCase();
        setAccount(addr);
        await checkNetwork();
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [checkNetwork]);

  const loginWithSignature = useCallback(async (): Promise<boolean> => {
    if (!account) {
      await connectWallet();
      return false;
    }

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      // 1. Ensure connected to Ganache 1337
      const ok = await ensureCorrectNetwork();
      await checkNetwork();
      if (!ok) {
        throw new Error("Please switch your wallet to Ganache Local (Chain ID 1337) to authenticate.");
      }

      // 2. Fetch challenge nonce from backend
      const nonceData = await api.getNonce(account);

      // 3. Request personal_sign from wallet
      const provider = await getEthereumProvider();
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(nonceData.message);

      // 4. Submit signature to exchange for JWT
      const loginRes = await api.login(account, signature);

      // 5. Store session and refresh state
      localStorage.setItem("cargochain_token", loginRes.token);
      setRole(loginRes.role);
      setRoleName(loginRes.roleName);

      await refreshProfile();
      return true;
    } catch (err: any) {
      console.error("Login failed:", err);
      const msg = err instanceof ApiException ? err.message : err.message || "Signature authentication failed";
      setAuthError(msg);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, [account, connectWallet, checkNetwork, refreshProfile]);

  const switchNetwork = useCallback(async () => {
    try {
      await ensureCorrectNetwork();
      await checkNetwork();
    } catch (e: any) {
      setAuthError(e.message || "Failed to switch network");
    }
  }, [checkNetwork]);

  // Initial setup: check accounts and listen to changes
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    checkNetwork();

    // Check if already connected
    ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0].toLowerCase());
      }
    });

    // Check existing stored token
    const token = localStorage.getItem("cargochain_token");
    if (token) {
      refreshProfile();
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        logout();
      } else {
        const newAddr = accounts[0].toLowerCase();
        if (newAddr !== account) {
          setAccount(newAddr);
          // Address changed, token no longer matches
          logout();
        }
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [checkNetwork, account, logout, refreshProfile]);

  return (
    <WalletContext.Provider
      value={{
        account,
        displayAddress,
        chainId,
        isCorrectNetwork,
        role,
        roleName,
        user,
        isAuthenticated: !!user && !!account,
        isConnecting,
        isLoggingIn,
        authError,
        connectWallet,
        loginWithSignature,
        logout,
        switchNetwork,
        refreshProfile,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
