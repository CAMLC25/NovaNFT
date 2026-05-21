import React, { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  AUCTION_ABI,
  AUCTION_ADDRESS,
  BANK_ABI,
  BANK_ADDRESS,
  MARKETPLACE_ABI,
  MARKETPLACE_ADDRESS,
  NFT_ABI,
  NFT_ADDRESS
} from "../constants";

const Web3Context = createContext();

const GANACHE_RPC = "http://127.0.0.1:7545";
const SUPPORTED_CHAIN_IDS = new Set([1337, 5777, 31337]);

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [networkError, setNetworkError] = useState("");
  const [contracts, setContracts] = useState({ nft: null, market: null, auction: null, bank: null });

  const initContracts = (signerOrProvider) => {
    setContracts({
      nft: new ethers.Contract(NFT_ADDRESS, NFT_ABI, signerOrProvider),
      market: new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signerOrProvider),
      auction: new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signerOrProvider),
      bank: new ethers.Contract(BANK_ADDRESS, BANK_ABI, signerOrProvider)
    });
  };

  const updateNetworkState = async (provider) => {
    const network = await provider.getNetwork();
    setChainId(network.chainId);
    const supported = SUPPORTED_CHAIN_IDS.has(network.chainId);
    setIsCorrectNetwork(supported);
    setNetworkError(supported ? "" : `Unsupported network ${network.chainId}. Please use Ganache 1337/5777.`);
    return supported;
  };

  const updateAccountInfo = async (walletAddress) => {
    setAccount(walletAddress);
    if (!window.ethereum) return;

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await updateNetworkState(provider);
    const bal = await provider.getBalance(walletAddress);
    setBalance(ethers.utils.formatEther(bal));
    initContracts(provider.getSigner());
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      localStorage.removeItem("isDisconnected");
      if (accounts.length > 0) await updateAccountInfo(accounts[0]);
    } catch (error) {
      console.error("Wallet connection rejected:", error);
    }
  };

  const disconnectWallet = () => {
    localStorage.setItem("isDisconnected", "true");
    setAccount("");
    setBalance("");
    const readOnlyProvider = new ethers.providers.JsonRpcProvider(GANACHE_RPC);
    initContracts(readOnlyProvider);
    updateNetworkState(readOnlyProvider).catch(() => {
      setIsCorrectNetwork(false);
      setNetworkError("Cannot connect to Ganache RPC.");
    });
  };

  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum || localStorage.getItem("isDisconnected") === "true") return;

    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) await updateAccountInfo(accounts[0]);
    } catch (error) {
      console.error("Wallet check failed:", error);
    }
  };

  useEffect(() => {
    const readOnlyProvider = new ethers.providers.JsonRpcProvider(GANACHE_RPC);
    initContracts(readOnlyProvider);
    updateNetworkState(readOnlyProvider).catch(() => {
      setIsCorrectNetwork(false);
      setNetworkError("Cannot connect to Ganache RPC.");
    });
    checkIfWalletIsConnected();

    if (!window.ethereum) return undefined;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        localStorage.removeItem("isDisconnected");
        updateAccountInfo(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <Web3Context.Provider
      value={{
        account,
        balance,
        chainId,
        isCorrectNetwork,
        networkError,
        connectWallet,
        disconnectWallet,
        ...contracts
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
