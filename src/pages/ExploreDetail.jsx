import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import {
  Activity,
  AlertCircle,
  ArchiveX,
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  FileCode,
  FileText,
  Hash,
  Layers,
  Link as LinkIcon,
  Share2,
  ShoppingCart,
  Sparkles,
  Tag,
  User,
  Wallet,
  X
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS } from "../constants";
import ActivityDetailModal from "../components/ActivityDetailModal";

const ZERO = ethers.constants.AddressZero;
const FALLBACK_IMG = "https://picsum.photos/seed/ethervault-explore/800";

export default function ExploreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account, nft, market, auction, isCorrectNetwork, networkError } = useWeb3();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [activity, setActivity] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState("");
  const [status, setStatus] = useState("active");
  const [dialog, setDialog] = useState({ isOpen: false, type: "success", title: "", message: "" });

  const tokenId = useMemo(() => {
    try {
      return ethers.BigNumber.from(id);
    } catch {
      return null;
    }
  }, [id]);

  const showDialog = (type, title, message) => setDialog({ isOpen: true, type, title, message });
  const short = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-";
  const sameAddress = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

  const generateGradient = (address) => {
    if (!address || address === ZERO) return "#e5e7eb";
    return `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(-6)})`;
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(""), 2000);
  };

  const fetchMetadata = async (uri) => {
    try {
      return await (await fetch(uri)).json();
    } catch {
      return {};
    }
  };

  const getErrorMessage = (error) => {
    if (error?.code === 4001) return "Bạn đã từ chối giao dịch trong MetaMask.";
    return error?.reason || error?.data?.message || error?.message || "Giao dịch thất bại.";
  };

  const fetchDetail = async () => {
    try {
      if (!market || !nft || !tokenId) return;
      setLoading(true);

      const [listing, tokenURI, owner, transferLogs, mintLogs, listedLogs, soldLogs, canceledLogs] = await Promise.all([
        market.listings(tokenId),
        nft.tokenURI(tokenId),
        nft.ownerOf(tokenId).catch(() => ZERO),
        nft.queryFilter(nft.filters.Transfer(null, null, tokenId)),
        nft.queryFilter(nft.filters.NFTMinted(tokenId)),
        market.queryFilter(market.filters.NFTListed(tokenId)),
        market.queryFilter(market.filters.NFTSold(tokenId)),
        market.queryFilter(market.filters.ListingCanceled(tokenId))
      ]);

      const metadata = await fetchMetadata(tokenURI);
      const activityItem = {
        id: tokenId.toString(),
        name: metadata.name || `NFT #${tokenId.toString()}`,
        img: metadata.thumbnail || metadata.image || metadata.asset || FALLBACK_IMG
      };
      const creator = mintLogs[mintLogs.length - 1]?.args.creator || transferLogs.find((log) => log.args.from === ZERO)?.args.to || ZERO;

      const lastSold = soldLogs[soldLogs.length - 1];
      const lastCanceled = canceledLogs[canceledLogs.length - 1];
      let resolvedStatus = "active";
      if (!listing.active) {
        const soldIsLatest = lastSold && (
          !lastCanceled ||
          lastSold.blockNumber > lastCanceled.blockNumber ||
          (lastSold.blockNumber === lastCanceled.blockNumber && lastSold.logIndex > lastCanceled.logIndex)
        );
        resolvedStatus = soldIsLatest ? "sold" : "delisted";
      }
      setStatus(resolvedStatus);

      const eventRows = [
        ...mintLogs.map((log) => ({ log, type: "Mint", price: "-", from: ZERO, to: log.args.creator })),
        ...listedLogs.map((log) => ({ log, type: "NFTListed", price: ethers.utils.formatEther(log.args.price), from: log.args.seller, to: MARKETPLACE_ADDRESS })),
        ...soldLogs.map((log) => ({ log, type: "NFTSold", price: ethers.utils.formatEther(log.args.price), from: log.args.seller, to: log.args.buyer })),
        ...canceledLogs.map((log) => ({ log, type: "ListingCanceled", price: "-", from: MARKETPLACE_ADDRESS, to: log.args.seller }))
      ];

      const eventActivity = await Promise.all(eventRows.map(async (row) => {
        const block = await row.log.getBlock();
        return {
          id: `${row.log.transactionHash}-${row.log.logIndex}`,
          hash: row.log.transactionHash,
          transactionHash: row.log.transactionHash,
          contractAddress: row.type === "Mint" ? NFT_ADDRESS : MARKETPLACE_ADDRESS,
          item: activityItem,
          type: row.type,
          price: row.price,
          from: row.from,
          to: row.to,
          timestamp: block.timestamp * 1000,
          blockNumber: row.log.blockNumber,
          logIndex: row.log.logIndex
        };
      }));

      const fallbackTransferActivity = await Promise.all(transferLogs.map(async (log) => {
        const block = await log.getBlock();
        const from = log.args.from;
        const to = log.args.to;
        if (from === ZERO || sameAddress(to, market.address) || sameAddress(from, market.address)) return null;
        return {
          id: `${log.transactionHash}-${log.logIndex}`,
          hash: log.transactionHash,
          transactionHash: log.transactionHash,
          contractAddress: NFT_ADDRESS,
          item: activityItem,
          type: "Transfer",
          price: "-",
          from,
          to,
          timestamp: block.timestamp * 1000,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex
        };
      }));

      setActivity([...eventActivity, ...fallbackTransferActivity.filter(Boolean)]
        .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex));

      setData({
        id: tokenId.toString(),
        name: metadata.name || `NFT #${tokenId.toString()}`,
        description: metadata.description || "Không có mô tả chi tiết.",
        category: metadata.category || "image",
        thumbnail: metadata.thumbnail || metadata.image || FALLBACK_IMG,
        assetUrl: metadata.asset || metadata.image || metadata.thumbnail || FALLBACK_IMG,
        collection: metadata.collection || "NovaNFT Fixed",
        creator,
        owner,
        seller: listing.active ? listing.seller : owner,
        priceBN: listing.price,
        price: ethers.utils.formatEther(listing.price),
        active: listing.active
      });
    } catch (error) {
      console.error(error);
      showDialog("error", "Không tải được NFT", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id, market, nft, auction, account]);

  const handleBuy = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!isCorrectNetwork) return showDialog("error", "Sai network", networkError);
      if (!market || !data) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại.");
      if (sameAddress(account, data.seller)) return showDialog("error", "Không thể mua", "Bạn không thể tự mua NFT của mình.");

      const balance = await market.provider.getBalance(account);
      if (balance.lt(data.priceBN)) return showDialog("error", "Không đủ số dư", "Ví của bạn không đủ ETH để mua.");

      setProcessing(true);
      showDialog("info", "Đang xử lý", "Vui lòng xác nhận giao dịch mua trong MetaMask.");
      const tx = await market.buyNFT(tokenId, { value: data.priceBN });
      await tx.wait();
      showDialog("success", "Mua NFT thành công", "Tiền đã được ghi nhận vào số dư Bank của người bán.");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showDialog("error", "Giao dịch thất bại", getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelListing = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!isCorrectNetwork) return showDialog("error", "Sai network", networkError);
      if (!market) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại.");

      setProcessing(true);
      showDialog("info", "Đang xử lý", "Vui lòng xác nhận hủy niêm yết trong MetaMask.");
      const tx = await market.cancelListing(tokenId);
      await tx.wait();
      showDialog("success", "Đã hủy niêm yết", "NFT đã được rút về ví của bạn.");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showDialog("error", "Không thể hủy", getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const getEventStyle = (type) => {
    switch (type) {
      case "Mint": return { color: "text-yellow-500", icon: <Sparkles size={16} /> };
      case "NFTListed": return { color: "text-blue-600", icon: <Tag size={16} /> };
      case "NFTSold": return { color: "text-green-600", icon: <ShoppingCart size={16} /> };
      case "ListingCanceled": return { color: "text-orange-500", icon: <ArchiveX size={16} /> };
      default: return { color: "text-gray-900", icon: <ArrowRightLeft size={16} /> };
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case "Mint": return "Đúc NFT";
      case "NFTListed": return "Niêm yết";
      case "NFTSold": return "Bán thành công";
      case "ListingCanceled": return "Hủy niêm yết";
      case "Transfer": return "Chuyển NFT";
      default: return type;
    }
  };

  const renderAsset = () => {
    const category = (data.category || "image").toLowerCase();
    if (category === "video") return <video src={data.assetUrl} controls autoPlay muted loop className="w-full h-full object-contain rounded-[2rem]" />;
    if (category === "audio") {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-12">
          <img src={data.thumbnail} alt={data.name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} className="w-48 h-48 rounded-full shadow-2xl mb-8 object-cover" />
          <audio src={data.assetUrl} controls className="w-full max-w-md" />
        </div>
      );
    }
    if (category === "document") {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-12 text-center">
          <img src={data.thumbnail} alt={data.name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} className="w-48 h-64 object-cover rounded-xl shadow-xl mb-6" />
          <a href={data.assetUrl} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-8 py-4 rounded-xl flex items-center gap-3 font-bold"><FileText size={20} /> Đọc tài liệu gốc</a>
        </div>
      );
    }
    return <img src={data.assetUrl} alt={data.name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} className="w-full h-full object-contain max-h-[700px] rounded-[2rem]" />;
  };

  if (!tokenId) return <div className="text-center py-32 font-bold text-gray-500">Token ID không hợp lệ.</div>;
  if (loading || !data) {
    return (
      <div className="text-center py-32 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-gray-400 tracking-widest uppercase text-sm">Đang tải tài sản số...</p>
      </div>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 relative">
      {dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative">
            {dialog.type !== "info" && (
              <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-full">
                <X size={20} />
              </button>
            )}
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${dialog.type === "error" ? "bg-red-50 text-red-500" : dialog.type === "info" ? "bg-blue-50 text-blue-500" : "bg-green-50 text-green-500"}`}>
              {dialog.type === "error" ? <AlertCircle size={40} /> : dialog.type === "info" ? <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : <CheckCircle2 size={40} />}
            </div>
            <h3 className="text-2xl font-black text-center text-gray-900 mb-2">{dialog.title}</h3>
            <p className="text-center text-gray-500 font-medium mb-8 leading-relaxed">{dialog.message}</p>
            {dialog.type !== "info" && <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-4 rounded-2xl font-bold text-white bg-gray-900 hover:bg-black">Đã hiểu</button>}
          </div>
        </div>
      )}

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          account={account}
          profileAddress={data?.owner}
          getEventLabel={getEventLabel}
          getEventStyle={getEventStyle}
          short={short}
          navigate={navigate}
          onClose={() => setSelectedActivity(null)}
        />
      )}

      {!isCorrectNetwork && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold text-red-600">{networkError}</div>
      )}

      <button onClick={() => navigate("/explore")} className="flex items-center gap-2 font-bold text-gray-500 hover:text-black mb-8">
        <ArrowLeft size={20} /> Quay lại chợ mua bán
      </button>

      <div className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-6 space-y-8 sticky top-28">
          <div className="bg-[#1A1B22] rounded-[2rem] overflow-hidden relative shadow-2xl flex items-center justify-center min-h-[500px]">
            {renderAsset()}
            <div className="absolute top-6 left-6 flex gap-2">
              <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black uppercase border border-white/10">{data.category}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-600 font-bold text-sm mb-1 uppercase tracking-widest">{data.collection}</p>
              <h1 className="text-4xl font-black text-gray-900 mb-6">{data.name}</h1>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${data.seller}`)}>
                <div className="w-10 h-10 rounded-full shadow-inner" style={{ background: generateGradient(data.seller) }}></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{data.active ? "Người bán" : "Chủ sở hữu hiện tại"}</p>
                  <p className="font-bold text-sm font-mono text-blue-600 hover:underline">{short(data.seller)}</p>
                </div>
              </div>
            </div>
            <button onClick={() => handleCopy(window.location.href)} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              {copiedAddress === window.location.href ? <Check size={16} className="text-green-500" /> : <Share2 size={16} className="text-gray-600" />}
            </button>
          </div>

          <div className="bg-[#1A1B22] rounded-[2rem] p-8 text-white shadow-2xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Giá niêm yết</p>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-black text-blue-400">{data.price === "0.0" ? "---" : data.price}</span>
              <span className="text-xl text-gray-400 font-bold">ETH</span>
            </div>

            {data.active && sameAddress(data.seller, account) ? (
              <button onClick={handleCancelListing} disabled={processing} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-5 rounded-2xl flex justify-center items-center gap-2">
                {processing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><ArchiveX size={20} /> Hủy niêm yết & rút về</>}
              </button>
            ) : data.active ? (
              <button onClick={handleBuy} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl flex justify-center items-center gap-2">
                {processing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><ShoppingCart size={20} /> Mua ngay</>}
              </button>
            ) : status === "sold" ? (
              <StatusMessage icon={<CheckCircle2 size={20} />} text="Tác phẩm này đã được bán thành công." green />
            ) : (
              <StatusMessage icon={<ArchiveX size={20} />} text="Chủ sở hữu đã hủy niêm yết tác phẩm này." />
            )}
          </div>

          <div className="pt-6">
            <div className="flex gap-6 border-b border-gray-100 mb-6">
              <button onClick={() => setActiveTab("overview")} className={`pb-3 font-bold text-sm uppercase tracking-widest ${activeTab === "overview" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}>Tổng quan</button>
              <button onClick={() => setActiveTab("activity")} className={`pb-3 font-bold text-sm uppercase tracking-widest flex items-center gap-2 ${activeTab === "activity" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-400"}`}><Activity size={16} /> Hoạt động</button>
            </div>

            {activeTab === "overview" ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <h3 className="font-bold mb-4">Mô tả tác phẩm</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">{data.description}</p>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-8 py-5 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><FileCode size={18} className="text-blue-600" /> Chi tiết</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow icon={<User size={16} />} label="Người tạo NFT" value={short(data.creator)} onClick={() => navigate(`/profile/${data.creator}`)} />
                    <DetailRow icon={<Wallet size={16} />} label="Chủ sở hữu" value={short(data.owner)} onClick={() => navigate(`/profile/${data.owner}`)} />
                    <DetailRow icon={<Hash size={16} />} label="Token ID" value={data.id} />
                    <DetailRow icon={<Layers size={16} />} label="Chuẩn token" value="ERC-721" />
                    <DetailRow icon={<LinkIcon size={16} />} label="Mạng" value="Ganache Local" />
                  </div>
                </div>
              </div>
            ) : (
              <ActivityTable rows={activity} getEventStyle={getEventStyle} getEventLabel={getEventLabel} account={account} navigate={navigate} short={short} onOpenActivity={setSelectedActivity} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const StatusMessage = ({ icon, text, green }) => (
  <div className={`${green ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-[#2A2B35] text-gray-400 border-gray-700"} p-5 rounded-2xl text-center font-bold text-sm border flex items-center justify-center gap-2`}>
    {icon} {text}
  </div>
);

const DetailRow = ({ icon, label, value, onClick }) => (
  <div className="flex items-center justify-between px-8 py-5 hover:bg-gray-50">
    <div className="flex items-center gap-3 text-gray-500 font-medium">{icon} <span className="text-sm">{label}</span></div>
    <div onClick={onClick} className={`${onClick ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-900"} text-sm font-bold font-mono`}>{value}</div>
  </div>
);

const ActivityTable = ({ rows, getEventStyle, getEventLabel, account, navigate, short, onOpenActivity }) => (
  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
    <div className="max-h-[380px] overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 sticky top-0">
            <th className="p-6 font-bold">Sự kiện</th>
            <th className="p-6 font-bold">Giá</th>
            <th className="p-6 font-bold">Từ</th>
            <th className="p-6 font-bold">Đến</th>
            <th className="p-6 font-bold text-right">Ngày</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan="5" className="p-8 text-center text-gray-400 italic text-sm">Chưa có hoạt động nào.</td></tr>
          ) : rows.map((log) => {
            const style = getEventStyle(log.type);
            return (
              <tr key={`${log.hash}-${log.logIndex}`} onClick={() => onOpenActivity(log)} className="border-b border-gray-50 hover:bg-purple-50/30 cursor-pointer">
                <td className="p-6"><div className={`flex items-center gap-2 font-bold text-sm ${style.color}`}>{style.icon} {getEventLabel(log.type)}</div></td>
                <td className="p-6 font-mono text-sm font-black text-gray-900">{log.price !== "-" ? `${log.price} ETH` : <span className="text-gray-300">-</span>}</td>
                <td className="p-6 font-mono text-sm">{renderAddress(log.from, account, navigate, short)}</td>
                <td className="p-6 font-mono text-sm">{renderAddress(log.to, account, navigate, short)}</td>
                <td className="p-6 text-right text-[11px] text-gray-500 font-medium">{new Date(log.timestamp).toLocaleString("vi-VN")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

function renderAddress(address, account, navigate, short) {
  if (!address || address === ZERO) return <span className="text-gray-400">-</span>;
  if (account && address.toLowerCase() === account.toLowerCase()) return <span className="bg-gray-900 text-white font-bold px-2 py-1 rounded text-[10px]">BẠN</span>;
  return <span onClick={(event) => { event.stopPropagation(); navigate(`/profile/${address}`); }} className="text-blue-600 hover:underline cursor-pointer">{short(address)}</span>;
}
