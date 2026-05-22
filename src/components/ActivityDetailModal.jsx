import React, { useState } from "react";
import { ethers } from "ethers";
import { CheckCircle2, Copy, X } from "lucide-react";
import { AUCTION_ADDRESS, BANK_ADDRESS, MARKETPLACE_ADDRESS, NFT_ADDRESS } from "../constants";

const ZERO = ethers.constants.AddressZero;
const FALLBACK_IMG = "https://picsum.photos/seed/novanft-activity/300";

const sameAddress = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

const getContractLabel = (address) => {
  if (!address || address === ZERO) return "-";
  if (sameAddress(address, NFT_ADDRESS)) return "Hợp đồng NFT";
  if (sameAddress(address, MARKETPLACE_ADDRESS)) return "Hợp đồng Marketplace";
  if (sameAddress(address, AUCTION_ADDRESS)) return "Hợp đồng đấu giá";
  if (sameAddress(address, BANK_ADDRESS)) return "Hợp đồng Bank";
  return "Hợp đồng";
};

const normalizeTimestamp = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!value) return Date.now();
  return value > 1000000000000 ? value : value * 1000;
};

export default function ActivityDetailModal({
  activity,
  account,
  profileAddress,
  profileLabel = "HỒ SƠ",
  getEventLabel,
  getEventStyle,
  short,
  navigate,
  onClose
}) {
  const [copiedKey, setCopiedKey] = useState("");
  const style = getEventStyle(activity.type) || {};
  const item = activity.item || {
    id: activity.tokenId || "ETH",
    name: activity.itemName || "Ethereum",
    img: activity.img || FALLBACK_IMG
  };
  const txHash = activity.transactionHash || activity.hash || activity.id?.split("-")[0] || "-";
  const contractAddress = activity.contractAddress || "-";
  const timestamp = normalizeTimestamp(activity.timestamp);
  const sign = style.sign || "";

  const copy = async (value, key) => {
    if (!value || value === "-") return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1600);
  };

  const copyIcon = (key) => copiedKey === key
    ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
    : <Copy size={16} className="text-gray-300 shrink-0" />;

  const openItem = () => {
    if (!item.id || item.id === "ETH") return;
    onClose();
    navigate(`/explore/${item.id}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] max-w-3xl w-full shadow-2xl overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Chi tiết giao dịch</p>
            <div className={`flex items-center gap-3 text-xl font-black ${style.color || "text-gray-900"}`}>
              {style.icon}
              {getEventLabel(activity.type)}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center gap-4 rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <button onClick={openItem} className={`w-14 h-14 rounded-xl bg-white border border-gray-100 p-1 flex items-center justify-center ${item.id === "ETH" ? "cursor-default" : "cursor-pointer"}`}>
              <img src={item.img || FALLBACK_IMG} onError={(event) => { event.currentTarget.src = FALLBACK_IMG; }} className={`w-full h-full ${item.id === "ETH" ? "object-contain" : "object-cover rounded-lg"}`} alt={item.name || "Vật phẩm"} />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vật phẩm</p>
              <button onClick={openItem} className={`text-lg font-black text-gray-900 ${item.id === "ETH" ? "cursor-default" : "hover:text-blue-600"}`}>
                {item.name || "Vật phẩm"}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <DetailLine label="Trạng thái" value="Thành công" badge="success" />
            <DetailLine label="Dòng tiền" value={activity.price !== "-" ? `${sign}${activity.price} ETH` : "-"} />
            <DetailLine label="Block" value={activity.blockNumber ?? "-"} />
            <DetailLine label="Log index" value={activity.logIndex ?? "-"} />
            <DetailLine label="Thời gian" value={new Date(timestamp).toLocaleString("vi-VN")} />
            <DetailLine label="Contract phát event" value={getContractLabel(contractAddress)} />
          </div>

          <div className="space-y-3">
            <CopyLine label="Transaction hash" value={txHash} copyKey={`tx-${txHash}`} copy={copy} copyIcon={copyIcon} />
            <CopyLine label="Contract address" value={contractAddress} copyKey={`contract-${contractAddress}`} copy={copy} copyIcon={copyIcon} />
            <AddressLine label="Từ" address={activity.from} account={account} profileAddress={profileAddress} profileLabel={profileLabel} short={short} navigate={navigate} onClose={onClose} />
            <AddressLine label="Đến" address={activity.to} account={account} profileAddress={profileAddress} profileLabel={profileLabel} short={short} navigate={navigate} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}

const DetailLine = ({ label, value, badge }) => (
  <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
    {badge === "success" ? (
      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 text-green-600 px-3 py-1 text-xs font-black">
        <CheckCircle2 size={14} /> {value}
      </span>
    ) : (
      <p className="font-mono text-sm font-bold text-gray-900 break-all">{value}</p>
    )}
  </div>
);

const CopyLine = ({ label, value, copyKey, copy, copyIcon }) => (
  <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
    <button onClick={() => copy(value, copyKey)} className="flex items-center gap-2 text-left font-mono text-sm font-bold text-blue-600 break-all">
      {value}
      {copyIcon(copyKey)}
    </button>
  </div>
);

const AddressLine = ({ label, address, account, profileAddress, profileLabel, short, navigate, onClose }) => {
  const isZero = !address || address === ZERO;
  const isAccount = account && sameAddress(address, account);
  const isProfile = profileAddress && sameAddress(address, profileAddress);

  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      {isZero ? (
        <span className="text-gray-400 font-bold">-</span>
      ) : (
        <button
          onClick={() => {
            onClose();
            navigate(`/profile/${address}`);
          }}
          className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold text-blue-600 hover:underline break-all"
        >
          {isAccount ? "BẠN" : isProfile ? profileLabel : short(address)}
          <span className="text-gray-400">({address})</span>
        </button>
      )}
    </div>
  );
};
