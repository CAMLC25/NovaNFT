import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import {
  Activity,
  AlertCircle,
  ArchiveX,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  FileCode,
  FileText,
  Hash,
  Layers,
  Link as LinkIcon,
  ShoppingCart,
  Sparkles,
  Tag,
  Trophy,
  User,
  Wallet,
  X
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { AUCTION_ADDRESS, NFT_ADDRESS } from "../constants";
import ActivityDetailModal from "../components/ActivityDetailModal";

const ZERO = ethers.constants.AddressZero;
const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/ethervault/800";

export default function AuctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account, nft, auction, market } = useWeb3();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, ended: false });
  const [bidHistory, setBidHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [dialog, setDialog] = useState({ isOpen: false, type: "success", title: "", message: "" });

  const showDialog = (type, title, message) => setDialog({ isOpen: true, type, title, message });
  const sameAddress = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
  const short = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-";

  const tokenId = useMemo(() => {
    try {
      return ethers.BigNumber.from(id);
    } catch {
      return null;
    }
  }, [id]);

  const currentPrice = useMemo(() => {
    if (!data) return "0";
    return data.highestBidBN.isZero() ? data.minPrice : data.highestBid;
  }, [data]);

  const generateGradient = (address) => {
    if (!address || address === ZERO) return "linear-gradient(135deg, #e5e7eb, #f3f4f6)";
    return `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(-6)})`;
  };

  const getStatusText = (status) => {
    if (status === "not_started") return "Chưa bắt đầu";
    if (status === "sold") return "Đã chốt thầu thành công";
    if (status === "canceled") return "Chủ sở hữu đã hủy";
    if (status === "unsold") return "Kết thúc không có người mua";
    if (status === "awaiting_close") return "Chờ chốt thầu";
    return "Đang live";
  };

  const getErrorMessage = (error) => {
    if (error?.code === 4001) return "Bạn đã từ chối giao dịch trong MetaMask.";
    const message = error?.reason || error?.data?.message || error?.message || "";
    if (message.includes("Auction has not started")) return "Phiên đấu giá chưa bắt đầu. Vui lòng chờ đến thời gian mở đấu giá.";
    return error?.reason || error?.data?.message || error?.message || "Giao dịch thất bại.";
  };

  const fetchMetadata = async (uri) => {
    try {
      const response = await fetch(uri);
      return await response.json();
    } catch {
      return {};
    }
  };

  const fetchDetail = async () => {
    try {
      if (!auction || !nft || !tokenId) return;
      setLoading(true);

      const [
        auctionData,
        tokenURI,
        currentOwner,
        transferLogs,
        bidLogs,
        canceledLogs,
        completedLogs,
        noBidLogs
      ] = await Promise.all([
        auction.auctions(tokenId),
        nft.tokenURI(tokenId),
        nft.ownerOf(tokenId).catch(() => ZERO),
        nft.queryFilter(nft.filters.Transfer(null, null, tokenId)),
        auction.queryFilter(auction.filters.BidPlaced(tokenId)),
        auction.queryFilter(auction.filters.AuctionCanceled(tokenId)),
        auction.queryFilter(auction.filters.AuctionCompleted(tokenId)),
        auction.queryFilter(auction.filters.AuctionEndedNoBid(tokenId))
      ]);

      const metadata = await fetchMetadata(tokenURI);
      const activityItem = {
        id: tokenId.toString(),
        name: metadata.name || `NFT #${tokenId.toString()}`,
        img: metadata.thumbnail || metadata.image || metadata.asset || PLACEHOLDER_IMAGE
      };
      const creatorLog = transferLogs.find((log) => log.args.from === ZERO);
      const creator = creatorLog?.args.to || metadata.creator || ZERO;

      const bids = bidLogs
        .map((log) => ({
          bidder: log.args.bidder,
          amountBN: log.args.amount,
          amount: ethers.utils.formatEther(log.args.amount),
          timestamp: Number(log.args.timestamp) * 1000,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex
        }))
        .filter((log) => log.timestamp >= auctionData.startTime.toNumber() * 1000)
        .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
      setBidHistory(bids);

      const lastCanceled = canceledLogs[canceledLogs.length - 1];
      const lastCompleted = completedLogs[completedLogs.length - 1];
      const lastNoBid = noBidLogs[noBidLogs.length - 1];

      let status = "active";
      if (!auctionData.active) {
        if (lastCompleted) status = "sold";
        else if (lastCanceled) status = "canceled";
        else if (lastNoBid) status = "unsold";
        else status = auctionData.highestBid.isZero() ? "unsold" : "sold";
      } else if (Math.floor(Date.now() / 1000) < auctionData.startTime.toNumber()) {
        status = "not_started";
      } else if (Math.floor(Date.now() / 1000) >= auctionData.endTime.toNumber()) {
        status = "awaiting_close";
      }

      const transferActivity = await Promise.all(transferLogs.map(async (log) => {
        const block = await log.getBlock();
        const from = log.args.from;
        const to = log.args.to;
        let type = "Chuyển giao";

        if (from === ZERO) type = "Mint";
        else if (market && sameAddress(to, market.address)) type = "Niêm yết";
        else if (auction && sameAddress(to, auction.address)) type = "AuctionStarted";
        else if (auction && sameAddress(from, auction.address)) type = status === "sold" ? "NFT về winner" : "NFT trả seller";

        return {
          id: `${log.transactionHash}-${log.logIndex}`,
          transactionHash: log.transactionHash,
          contractAddress: NFT_ADDRESS,
          item: activityItem,
          type,
          from,
          to,
          price: "-",
          timestamp: (block?.timestamp || 0) * 1000,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex
        };
      }));

      const auctionActivity = await Promise.all([
        ...canceledLogs.map((log) => ({ log, type: "AuctionCanceled" })),
        ...completedLogs.map((log) => ({ log, type: "AuctionCompleted" })),
        ...noBidLogs.map((log) => ({ log, type: "AuctionEndedNoBid" })),
        ...bidLogs.map((log) => ({ log, type: "BidPlaced" }))
      ].map(async ({ log, type }) => {
        const block = await log.getBlock();
        const amount = type === "AuctionCompleted" ? log.args.amount : type === "BidPlaced" ? log.args.amount : ethers.constants.Zero;
        const from = type === "BidPlaced" ? log.args.bidder : log.args.seller;
        const to = type === "AuctionCompleted" ? log.args.winner : type === "BidPlaced" ? auction.address : from;

        return {
          id: `${log.transactionHash}-${log.logIndex}`,
          transactionHash: log.transactionHash,
          contractAddress: AUCTION_ADDRESS,
          item: activityItem,
          type,
          from,
          to,
          price: amount.gt(0) ? ethers.utils.formatEther(amount) : "-",
          timestamp: (block?.timestamp || Number(log.args.timestamp || 0)) * 1000,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex
        };
      }));

      setActivity([...transferActivity, ...auctionActivity]
        .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex));

      setData({
        id: tokenId.toString(),
        name: metadata.name || `NFT #${tokenId.toString()}`,
        description: metadata.description || "Chưa có mô tả.",
        category: metadata.category || "image",
        thumbnail: metadata.thumbnail || metadata.image || PLACEHOLDER_IMAGE,
        assetUrl: metadata.asset || metadata.image || metadata.thumbnail || PLACEHOLDER_IMAGE,
        collection: metadata.collection || "NovaNFT Auction",
        creator,
        seller: auctionData.seller,
        currentOwner,
        escrowed: sameAddress(currentOwner, auction.address),
        minPriceBN: auctionData.minPrice,
        minPrice: ethers.utils.formatEther(auctionData.minPrice),
        highestBidBN: auctionData.highestBid,
        highestBid: ethers.utils.formatEther(auctionData.highestBid),
        highestBidder: auctionData.highestBidder,
        startTime: auctionData.startTime.toNumber(),
        endTime: auctionData.endTime.toNumber(),
        active: auctionData.active,
        status
      });
    } catch (error) {
      console.error(error);
      showDialog("error", "Không tải được dữ liệu", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id, auction, nft, market, account]);

  useEffect(() => {
    if (!data?.endTime || !data?.startTime) return;

    const calculate = () => {
      const now = Math.floor(Date.now() / 1000);
      const targetTime = now < data.startTime ? data.startTime : data.endTime;
      const distance = targetTime - now;
      if (distance <= 0) return { h: 0, m: 0, s: 0, ended: true };
      return {
        h: Math.floor((distance % 86400) / 3600),
        m: Math.floor((distance % 3600) / 60),
        s: Math.floor(distance % 60),
        ended: false
      };
    };

    setTimeLeft(calculate());
    const interval = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(interval);
  }, [data?.startTime, data?.endTime]);

  const validateBidAmount = () => {
    if (!bidAmount || Number.isNaN(Number(bidAmount)) || Number(bidAmount) <= 0) {
      throw new Error("Giá đặt phải lớn hơn 0.");
    }

    const value = ethers.utils.parseEther(bidAmount);
    if (data.highestBidBN.isZero()) {
      if (value.lt(data.minPriceBN)) throw new Error(`Lượt đặt giá đầu tiên phải >= ${data.minPrice} ETH.`);
    } else if (value.lte(data.highestBidBN)) {
      throw new Error(`Lượt đặt giá tiếp theo phải > ${data.highestBid} ETH.`);
    }

    return value;
  };

  const handleBid = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!auction || !data) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại sau.");
      if (sameAddress(account, data.seller)) return showDialog("error", "Không thể đặt giá", "Chủ phiên không thể đặt giá NFT của mình.");
      const now = Math.floor(Date.now() / 1000);
      if (now < data.startTime) return showDialog("error", "Chưa thể đặt giá", "Phiên đấu giá chưa bắt đầu. Vui lòng chờ đến thời gian mở đấu giá.");
      if (!data.active || now >= data.endTime) return showDialog("error", "Không thể đặt giá", "Phiên đấu giá không còn nhận giá đặt.");

      const value = validateBidAmount();
      const balance = await auction.provider.getBalance(account);
      if (balance.lt(value)) return showDialog("error", "Không đủ số dư", "Ví của bạn không đủ ETH để đặt giá.");

      setProcessing(true);
      showDialog("info", "Đang xử lý", "Vui lòng xác nhận giao dịch trong MetaMask.");
      const tx = await auction.placeBid(tokenId, { value });
      await tx.wait();
      showDialog("success", "Đặt giá thành công", `Bạn đã đặt ${bidAmount} ETH.`);
      setBidAmount("");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showDialog("error", "Giao dịch thất bại", getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelAuction = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!auction || !data) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại sau.");

      setProcessing(true);
      showDialog("info", "Đang xử lý", "Vui lòng xác nhận hủy đấu giá trong MetaMask.");
      const tx = await auction.cancelAuction(tokenId);
      await tx.wait();
      showDialog("success", "Đã hủy đấu giá", "NFT đã được rút về ví của bạn.");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showDialog("error", "Không thể hủy", getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteAuction = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!auction || !data) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại sau.");

      setProcessing(true);
      showDialog("info", "Đang chốt thầu", "Vui lòng xác nhận giao dịch completeAuction trong MetaMask.");
      const tx = await auction.completeAuction(tokenId);
      await tx.wait();
      showDialog("success", "Đã chốt phiên", "Phiên đấu giá đã được hoàn tất.");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showDialog("error", "Không thể chốt phiên", getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const eventStyle = (type) => {
    if (["AuctionCompleted", "NFTSold"].includes(type)) return { color: "text-green-600", icon: <Trophy size={16} /> };
    if (["AuctionCanceled", "AuctionEndedNoBid", "ListingCanceled"].includes(type)) return { color: "text-orange-500", icon: <ArchiveX size={16} /> };
    if (type === "Mint") return { color: "text-yellow-500", icon: <Sparkles size={16} /> };
    if (["AuctionStarted", "BidPlaced", "Niêm yết"].includes(type)) return { color: "text-blue-600", icon: <Tag size={16} /> };
    return { color: "text-gray-700", icon: <ArrowRightLeft size={16} /> };
  };

  const eventLabel = (type) => {
    switch (type) {
      case "Mint": return "Đúc NFT";
      case "AuctionStarted": return "Mở đấu giá";
      case "BidPlaced": return "Đặt giá";
      case "AuctionCompleted": return "Chốt thầu thành công";
      case "AuctionCanceled": return "Hủy đấu giá";
      case "AuctionEndedNoBid": return "Kết thúc không có người mua";
      case "NFT về winner": return "NFT chuyển cho người thắng";
      case "NFT trả seller": return "NFT trả về người bán";
      case "Niêm yết": return "Niêm yết";
      default: return type;
    }
  };

  const renderAsset = () => {
    if (!data) return null;
    const category = data.category.toLowerCase();
    if (category === "video") return <video src={data.assetUrl} controls autoPlay muted loop className="w-full h-full object-contain rounded-[2rem]" />;
    if (category === "audio") {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-12">
          <img src={data.thumbnail} alt={data.name} onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} className="w-48 h-48 rounded-full shadow-2xl mb-8 object-cover" />
          <audio src={data.assetUrl} controls className="w-full max-w-md" />
        </div>
      );
    }
    if (category === "document") {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-12 text-center">
          <img src={data.thumbnail} alt={data.name} onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} className="w-48 h-64 object-cover rounded-xl shadow-xl mb-6" />
          <a href={data.assetUrl} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-8 py-4 rounded-xl flex items-center gap-3 font-bold">
            <FileText size={20} /> Đọc tài liệu gốc
          </a>
        </div>
      );
    }
    return <img src={data.assetUrl} alt={data.name} onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} className="w-full h-full object-contain max-h-[700px] rounded-[2rem]" />;
  };

  if (!tokenId) {
    return <div className="text-center py-32 font-bold text-gray-500">Token ID không hợp lệ.</div>;
  }

  if (loading || !data) {
    return (
      <div className="text-center py-32 font-bold text-gray-400 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        Đang tải cấu hình đấu giá...
      </div>
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const displayStatus = data.active && nowSec < data.startTime ? "not_started" : data.active && nowSec >= data.endTime ? "awaiting_close" : data.status;
  const canCancel = data.active && sameAddress(data.seller, account) && data.highestBidBN.isZero() && ["active", "not_started"].includes(displayStatus);
  const canBid = data.active && !sameAddress(data.seller, account) && displayStatus === "active";
  const canComplete = data.active && displayStatus === "awaiting_close";

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
            {dialog.type !== "info" && (
              <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-4 rounded-2xl font-bold text-white bg-gray-900 hover:bg-black">
                Đã hiểu
              </button>
            )}
          </div>
        </div>
      )}

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          account={account}
          profileAddress={data?.seller}
          getEventLabel={eventLabel}
          getEventStyle={eventStyle}
          short={short}
          navigate={navigate}
          onClose={() => setSelectedActivity(null)}
        />
      )}

      <button onClick={() => navigate("/auction")} className="flex items-center gap-2 font-bold text-gray-500 hover:text-black mb-8">
        <ArrowLeft size={20} /> Quay lại sàn
      </button>

      <div className="grid lg:grid-cols-12 gap-12 items-start mb-12">
        <section className="lg:col-span-6 space-y-6">
          <div className="bg-[#1A1B22] rounded-[3rem] overflow-hidden relative shadow-2xl flex items-center justify-center aspect-square border border-white/5">
            {renderAsset()}
            <div className="absolute top-6 left-6">
              <span className="bg-white text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                {displayStatus === "active" && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                {getStatusText(displayStatus)}
              </span>
            </div>
          </div>

          <InfoPanel title="Mô tả tác phẩm" icon={<Tag size={20} />}>
            <p className="text-gray-600 leading-relaxed italic">"{data.description}"</p>
          </InfoPanel>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-8 py-5 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <FileCode size={18} className="text-blue-600" /> Chi tiết
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              <DetailRow icon={<User size={16} />} label="Người tạo NFT" value={short(data.creator)} onClick={() => navigate(`/profile/${data.creator}`)} />
              <DetailRow icon={<Wallet size={16} />} label="Người tạo phiên" value={short(data.seller)} onClick={() => navigate(`/profile/${data.seller}`)} />
              <DetailRow icon={<Wallet size={16} />} label="Chủ sở hữu hiện tại" value={short(data.currentOwner)} onClick={() => navigate(`/profile/${data.currentOwner}`)} />
              <DetailRow icon={<ArchiveX size={16} />} label="Trạng thái ký gửi" value={data.escrowed ? "Đang giữ trong Auction" : "Đã trả về ví"} />
              <DetailRow icon={<Hash size={16} />} label="Token ID" value={data.id} />
              <DetailRow icon={<Layers size={16} />} label="Chuẩn token" value="ERC-721" />
              <DetailRow icon={<LinkIcon size={16} />} label="Mạng" value="Ganache Local" />
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 space-y-6">
          <div>
            <p className="text-blue-600 font-bold text-sm mb-1 uppercase tracking-widest">{data.collection}</p>
            <h1 className="text-4xl font-black text-gray-900 mb-6">{data.name}</h1>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${data.seller}`)}>
              <div className="w-10 h-10 rounded-full shadow-inner" style={{ background: generateGradient(data.seller) }}></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Người tạo phiên</p>
                <p className="font-bold text-sm font-mono text-blue-600 hover:underline">{short(data.seller)}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1B22] rounded-[3rem] p-10 text-white shadow-2xl">
            <div className="flex justify-between items-end mb-8 gap-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {displayStatus === "sold" ? "Giá chốt thầu" : "Giá hiện tại"}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black">{currentPrice}</span>
                  <span className="text-xl text-gray-400 font-bold">ETH</span>
                </div>
              </div>
              {data.active && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-end gap-1">
                    <Clock size={12} /> {displayStatus === "not_started" ? "Bắt đầu sau" : timeLeft.ended ? "Đã hết giờ" : "Kết thúc trong"}
                  </p>
                  {!timeLeft.ended && (
                    <div className="flex gap-3 text-2xl font-black">
                      <span>{String(timeLeft.h).padStart(2, "0")}</span><span className="text-gray-600">:</span>
                      <span>{String(timeLeft.m).padStart(2, "0")}</span><span className="text-gray-600">:</span>
                      <span>{String(timeLeft.s).padStart(2, "0")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {displayStatus !== "active" && displayStatus !== "awaiting_close" && displayStatus !== "not_started" ? (
              <StatusBox status={displayStatus} text={getStatusText(displayStatus)} />
            ) : canComplete ? (
              <button onClick={handleCompleteAuction} disabled={processing} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-2xl flex justify-center items-center gap-2">
                {processing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><CheckCircle2 size={20} /> Chốt thầu ngay</>}
              </button>
            ) : canCancel ? (
              <button onClick={handleCancelAuction} disabled={processing} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-5 rounded-2xl flex justify-center items-center gap-2">
                {processing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><ArchiveX size={20} /> Hủy phiên đấu giá & rút về</>}
              </button>
            ) : canBid ? (
              <div className="bg-[#2A2B35] rounded-3xl p-4 border border-gray-700">
                <div className="flex gap-2">
                  <input type="number" min="0" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder={data.highestBidBN.isZero() ? `Tối thiểu ${data.minPrice} ETH` : `Lớn hơn ${data.highestBid} ETH`} className="w-full bg-[#1A1B22] border border-gray-600 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-blue-500" />
                  <button onClick={handleBid} disabled={processing} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 rounded-2xl flex items-center gap-2">
                    {processing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><ShoppingCart size={18} /> Đặt giá</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#2A2B35] border border-gray-700 text-gray-400 p-5 rounded-2xl text-center font-bold text-sm">
                {displayStatus === "not_started" ? "Phiên đấu giá chưa bắt đầu. Vui lòng chờ đến thời gian mở đấu giá." : "Bạn không thể đặt giá phiên đấu giá của chính mình."}
              </div>
            )}
          </div>

          <InfoPanel title="Lịch sử đấu giá" icon={<Trophy size={20} />}>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {bidHistory.length === 0 ? <p className="text-sm text-gray-400 italic text-center py-10">Chưa có ai tham gia trả giá.</p> : bidHistory.map((bid, index) => (
                <div key={`${bid.blockNumber}-${bid.logIndex}`} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full shadow-inner border border-gray-200" style={{ background: generateGradient(bid.bidder) }}></div>
                    <div>
                      <p onClick={() => navigate(`/profile/${bid.bidder}`)} className="font-bold text-sm font-mono text-blue-600 hover:underline cursor-pointer">
                        {short(bid.bidder)} {index === 0 && <span className="text-[8px] bg-yellow-400 text-black px-2 py-0.5 rounded font-black">CAO NHẤT</span>}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(bid.timestamp).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                  <p className="font-black text-lg text-gray-900">{bid.amount} <span className="text-sm text-gray-400">ETH</span></p>
                </div>
              ))}
            </div>
          </InfoPanel>
        </section>
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-10 py-8 border-b border-gray-100 flex items-center gap-3">
          <Activity size={28} className="text-orange-500" />
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Lịch sử hoạt động</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-widest text-gray-400">
                <th className="p-8 font-black">Sự kiện</th>
                <th className="p-8 font-black">Giá</th>
                <th className="p-8 font-black">Từ</th>
                <th className="p-8 font-black">Đến</th>
                <th className="p-8 font-black text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic">Chưa có hoạt động nào.</td></tr>
              ) : activity.map((log) => {
                const style = eventStyle(log.type);
                return (
                  <tr key={`${log.blockNumber}-${log.logIndex}-${log.type}`} onClick={() => setSelectedActivity(log)} className="border-b border-gray-50 hover:bg-orange-50/30 cursor-pointer">
                    <td className="p-8"><div className={`flex items-center gap-3 font-bold text-sm ${style.color}`}>{style.icon} {eventLabel(log.type)}</div></td>
                    <td className="p-8 font-mono text-sm font-black text-gray-900">{log.price !== "-" ? `${log.price} ETH` : <span className="text-gray-300">-</span>}</td>
                    <td className="p-8 font-mono text-sm">{renderAddress(log.from, account, navigate, short)}</td>
                    <td className="p-8 font-mono text-sm">{renderAddress(log.to, account, navigate, short)}</td>
                    <td className="p-8 text-right text-sm text-gray-500 font-medium">{new Date(log.timestamp).toLocaleString("vi-VN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function renderAddress(address, account, navigate, short) {
  if (!address || address === ZERO) return <span className="text-gray-400">-</span>;
  if (account && address.toLowerCase() === account.toLowerCase()) return <span className="bg-gray-900 text-white font-bold px-2 py-1 rounded text-[10px]">BẠN</span>;
  return <span onClick={(event) => { event.stopPropagation(); navigate(`/profile/${address}`); }} className="text-blue-600 hover:underline cursor-pointer">{short(address)}</span>;
}

const InfoPanel = ({ title, icon, children }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">{icon} {title}</h3>
    {children}
  </div>
);

const DetailRow = ({ icon, label, value, onClick }) => (
  <div className="flex items-center justify-between px-8 py-5 hover:bg-orange-50/30">
    <div className="flex items-center gap-3 text-gray-500 font-medium">{icon} <span className="text-sm">{label}</span></div>
    <div onClick={onClick} className={`${onClick ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-900"} text-sm font-bold font-mono`}>{value}</div>
  </div>
);

const StatusBox = ({ status, text }) => {
  const isSold = status === "sold";
  return (
    <div className={`${isSold ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-[#2A2B35] border-gray-700 text-gray-400"} border p-5 rounded-2xl text-center font-bold text-sm flex items-center justify-center gap-2`}>
      {isSold ? <CheckCircle2 size={20} /> : <ArchiveX size={20} />}
      {text}
    </div>
  );
};
