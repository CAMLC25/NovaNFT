import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import {
  Activity,
  AlertCircle,
  ArchiveX,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Gavel,
  Image as ImageIcon,
  Sparkles,
  Tag,
  Trophy,
  UserX,
  Wallet,
  X
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { AUCTION_ADDRESS, BANK_ADDRESS, MARKETPLACE_ADDRESS, NFT_ADDRESS } from "../constants";

const ZERO = ethers.constants.AddressZero;
const ETH_IMG = "https://cryptologos.cc/logos/ethereum-eth-logo.png";
const FALLBACK_IMG = "https://picsum.photos/seed/ethervault-profile/300";

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account, nft, market, auction, bank, isCorrectNetwork, networkError } = useWeb3();

  const profileAddress = id || account;
  const isMyProfile = account && profileAddress && account.toLowerCase() === profileAddress.toLowerCase();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("collected");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [copiedId, setCopiedId] = useState(null);
  const [walletBalance, setWalletBalance] = useState("0.000");
  const [bankBalance, setBankBalance] = useState("0.000");
  const [dialog, setDialog] = useState({ isOpen: false, type: "success", title: "", message: "" });
  const [userNFTs, setUserNFTs] = useState({
    collected: [],
    created: [],
    listed: [],
    auctioning: [],
    activity: []
  });

  const showDialog = (type, title, message) => setDialog({ isOpen: true, type, title, message });
  const short = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-";
  const sameAddress = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

  const systemContract = useMemo(() => {
    if (!profileAddress) return null;
    const addr = profileAddress.toLowerCase();
    const contracts = {
      [NFT_ADDRESS.toLowerCase()]: {
        key: "nft",
        name: "Hợp đồng NFT",
        role: "Quản lý ERC-721, tokenURI, creator và totalSupply.",
        shortRole: "ERC-721",
        note: "Hợp đồng này là nguồn phát hành NFT và lịch sử đúc của toàn hệ thống.",
        color: "bg-blue-100 text-blue-700",
        dot: "bg-blue-500"
      },
      [MARKETPLACE_ADDRESS.toLowerCase()]: {
        key: "marketplace",
        name: "Hợp đồng Marketplace",
        role: "Escrow NFT và xử lý mua bán giá cố định.",
        shortRole: "Mua bán",
        note: "NFT được chuyển tạm vào hợp đồng này khi đang niêm yết giá cố định.",
        color: "bg-purple-100 text-purple-700",
        dot: "bg-purple-500"
      },
      [AUCTION_ADDRESS.toLowerCase()]: {
        key: "auction",
        name: "Hợp đồng đấu giá",
        role: "Escrow NFT và xử lý các phiên đấu giá.",
        shortRole: "Đấu giá",
        note: "NFT được chuyển tạm vào hợp đồng này khi phiên đấu giá đang hoạt động.",
        color: "bg-orange-100 text-orange-700",
        dot: "bg-orange-500"
      },
      [BANK_ADDRESS.toLowerCase()]: {
        key: "bank",
        name: "Hợp đồng Bank",
        role: "Giữ số dư nội bộ và cho người dùng rút tiền.",
        shortRole: "Vault",
        note: "Bank ghi nhận số dư nội bộ của người dùng; hồ sơ hợp đồng không phải ví rút tiền.",
        color: "bg-teal-100 text-teal-700",
        dot: "bg-teal-500"
      }
    };
    return contracts[addr] || null;
  }, [profileAddress]);

  const profileIdentity = useMemo(() => {
    if (!profileAddress) return { label: "Chưa kết nối", color: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
    const addr = profileAddress.toLowerCase();
    if (account && addr === account.toLowerCase()) return { label: "Hồ sơ của bạn", color: "bg-green-100 text-green-700", dot: "bg-green-500" };
    if (systemContract) return { label: systemContract.name, color: systemContract.color, dot: systemContract.dot };
    return { label: "Hồ sơ người dùng", color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" };
  }, [profileAddress, account, systemContract]);

  const generateGradient = (address) => {
    if (!address) return "linear-gradient(135deg, #e5e7eb, #f3f4f6)";
    return `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(8, 14)}, #${address.slice(-6)})`;
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchMetadata = async (tokenId) => {
    try {
      const uri = await nft.tokenURI(tokenId);
      const meta = await (await fetch(uri)).json();
      return {
        name: meta.name || `NFT #${tokenId}`,
        img: meta.thumbnail || meta.image || meta.asset || FALLBACK_IMG,
        category: meta.category || "image"
      };
    } catch {
      return { name: `NFT #${tokenId}`, img: FALLBACK_IMG, category: "image" };
    }
  };

  const mapTokenCard = async (tokenId, type, extra = {}) => {
    const meta = await fetchMetadata(tokenId);
    return { id: Number(tokenId), ...meta, type, ...extra };
  };

  const buildNftUniverse = async () => {
    const total = await nft.totalSupply();
    const indexes = Array.from({ length: total.toNumber() }, (_, index) => index);
    return Promise.all(indexes.map((index) => nft.tokenByIndex(index)));
  };

  const fetchActivities = async () => {
    if (systemContract) {
      const contractRows = [];

      if (systemContract.key === "nft") {
        const mintLogs = await nft.queryFilter(nft.filters.NFTMinted());
        contractRows.push(...mintLogs.map((log) => ({
          log,
          type: "Mint",
          tokenId: log.args.tokenId,
          price: "-",
          from: ZERO,
          to: log.args.creator
        })));
      }

      if (systemContract.key === "marketplace") {
        const [listedLogs, soldLogs, canceledLogs] = await Promise.all([
          market.queryFilter(market.filters.NFTListed()),
          market.queryFilter(market.filters.NFTSold()),
          market.queryFilter(market.filters.ListingCanceled())
        ]);
        contractRows.push(
          ...listedLogs.map((log) => ({ log, type: "NFTListed", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.price), from: log.args.seller, to: MARKETPLACE_ADDRESS })),
          ...soldLogs.map((log) => ({ log, type: "NFTSold", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.price), from: log.args.buyer, to: log.args.seller })),
          ...canceledLogs.map((log) => ({ log, type: "ListingCanceled", tokenId: log.args.tokenId, price: "-", from: MARKETPLACE_ADDRESS, to: log.args.seller }))
        );
      }

      if (systemContract.key === "auction") {
        const [startedLogs, bidLogs, canceledLogs, completedLogs, noBidLogs] = await Promise.all([
          auction.queryFilter(auction.filters.AuctionStarted()),
          auction.queryFilter(auction.filters.BidPlaced()),
          auction.queryFilter(auction.filters.AuctionCanceled()),
          auction.queryFilter(auction.filters.AuctionCompleted()),
          auction.queryFilter(auction.filters.AuctionEndedNoBid())
        ]);
        contractRows.push(
          ...startedLogs.map((log) => ({ log, type: "AuctionStarted", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.minPrice), from: log.args.seller, to: AUCTION_ADDRESS })),
          ...bidLogs.map((log) => ({ log, type: "BidPlaced", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.amount), from: log.args.bidder, to: AUCTION_ADDRESS })),
          ...canceledLogs.map((log) => ({ log, type: "AuctionCanceled", tokenId: log.args.tokenId, price: "-", from: AUCTION_ADDRESS, to: log.args.seller })),
          ...completedLogs.map((log) => ({ log, type: "AuctionCompleted", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.amount), from: log.args.winner, to: log.args.seller })),
          ...noBidLogs.map((log) => ({ log, type: "AuctionEndedNoBid", tokenId: log.args.tokenId, price: "-", from: AUCTION_ADDRESS, to: log.args.seller }))
        );
      }

      if (systemContract.key === "bank") {
        const [creditedLogs, withdrawnLogs, transferLogs] = await Promise.all([
          bank.queryFilter(bank.filters.BalanceCredited()),
          bank.queryFilter(bank.filters.Withdrawn()),
          bank.queryFilter(bank.filters.TransferETH())
        ]);
        const bankRows = await Promise.all([...creditedLogs, ...withdrawnLogs, ...transferLogs].map(async (log) => {
          const block = await log.getBlock();
          const isCredit = log.event === "BalanceCredited";
          const isTransfer = log.event === "TransferETH";
          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            type: isTransfer ? "TransferETH" : isCredit ? "BalanceCredited" : "Withdrawn",
            item: { id: "ETH", name: "Ethereum", img: ETH_IMG, category: "Currency" },
            price: ethers.utils.formatEther(log.args.amount),
            from: isTransfer ? log.args.from : isCredit ? BANK_ADDRESS : log.args.user,
            to: isTransfer ? log.args.to : log.args.user,
            timestamp: block.timestamp,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          };
        }));

        return bankRows
          .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
          .slice(0, 100);
      }

      const rows = await Promise.all(contractRows.map(async (row) => {
        const block = await row.log.getBlock();
        const meta = await fetchMetadata(row.tokenId);
        return {
          id: `${row.log.transactionHash}-${row.log.logIndex}`,
          type: row.type,
          item: { id: row.tokenId.toNumber(), ...meta },
          price: row.price,
          from: row.from,
          to: row.to,
          timestamp: block.timestamp,
          blockNumber: row.log.blockNumber,
          logIndex: row.log.logIndex
        };
      }));

      return rows
        .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
        .slice(0, 100);
    }

    const [mintLogs, listedLogs, soldLogs, listingCanceledLogs, auctionStartedLogs, bidLogs, auctionCanceledLogs, auctionCompletedLogs, noBidLogs, creditedLogs, withdrawnLogs, transferSentLogs, transferReceivedLogs] = await Promise.all([
      nft.queryFilter(nft.filters.NFTMinted(null, profileAddress)),
      market.queryFilter(market.filters.NFTListed(null, profileAddress)),
      market.queryFilter(market.filters.NFTSold(null, null, profileAddress)),
      market.queryFilter(market.filters.ListingCanceled(null, profileAddress)),
      auction.queryFilter(auction.filters.AuctionStarted(null, profileAddress)),
      auction.queryFilter(auction.filters.BidPlaced(null, profileAddress)),
      auction.queryFilter(auction.filters.AuctionCanceled(null, profileAddress)),
      auction.queryFilter(auction.filters.AuctionCompleted(null, null, profileAddress)),
      auction.queryFilter(auction.filters.AuctionEndedNoBid(null, profileAddress)),
      bank.queryFilter(bank.filters.BalanceCredited(profileAddress)),
      bank.queryFilter(bank.filters.Withdrawn(profileAddress)),
      bank.queryFilter(bank.filters.TransferETH(profileAddress)),
      bank.queryFilter(bank.filters.TransferETH(null, profileAddress))
    ]);

    const soldAsSellerLogs = await market.queryFilter(market.filters.NFTSold(null, profileAddress));
    const completedAsSellerLogs = await auction.queryFilter(auction.filters.AuctionCompleted(null, profileAddress));

    const nftEventRows = [
      ...mintLogs.map((log) => ({ log, type: "Mint", tokenId: log.args.tokenId, price: "-", from: ZERO, to: log.args.creator })),
      ...listedLogs.map((log) => ({ log, type: "NFTListed", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.price), from: log.args.seller, to: MARKETPLACE_ADDRESS })),
      ...soldLogs.map((log) => ({ log, type: "NFTBought", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.price), from: log.args.seller, to: log.args.buyer })),
      ...soldAsSellerLogs.map((log) => ({ log, type: "NFTSold", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.price), from: log.args.buyer, to: log.args.seller })),
      ...listingCanceledLogs.map((log) => ({ log, type: "ListingCanceled", tokenId: log.args.tokenId, price: "-", from: MARKETPLACE_ADDRESS, to: log.args.seller })),
      ...auctionStartedLogs.map((log) => ({ log, type: "AuctionStarted", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.minPrice), from: log.args.seller, to: AUCTION_ADDRESS })),
      ...bidLogs.map((log) => ({ log, type: "BidPlaced", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.amount), from: log.args.bidder, to: AUCTION_ADDRESS })),
      ...auctionCanceledLogs.map((log) => ({ log, type: "AuctionCanceled", tokenId: log.args.tokenId, price: "-", from: AUCTION_ADDRESS, to: log.args.seller })),
      ...auctionCompletedLogs.map((log) => ({ log, type: "AuctionWon", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.amount), from: log.args.seller, to: log.args.winner })),
      ...completedAsSellerLogs.map((log) => ({ log, type: "AuctionCompleted", tokenId: log.args.tokenId, price: ethers.utils.formatEther(log.args.amount), from: log.args.winner, to: log.args.seller })),
      ...noBidLogs.map((log) => ({ log, type: "AuctionEndedNoBid", tokenId: log.args.tokenId, price: "-", from: AUCTION_ADDRESS, to: log.args.seller }))
    ];

    const nftRows = await Promise.all(nftEventRows.map(async (row) => {
      const block = await row.log.getBlock();
      const meta = await fetchMetadata(row.tokenId);
      return {
        id: `${row.log.transactionHash}-${row.log.logIndex}`,
        type: row.type,
        item: { id: row.tokenId.toNumber(), ...meta },
        price: row.price,
        from: row.from,
        to: row.to,
        timestamp: block.timestamp,
        blockNumber: row.log.blockNumber,
        logIndex: row.log.logIndex
      };
    }));

    const transferLogs = [...transferSentLogs, ...transferReceivedLogs]
      .filter((log, index, rows) => rows.findIndex((row) => row.transactionHash === log.transactionHash && row.logIndex === log.logIndex) === index);

    const bankRows = await Promise.all([...creditedLogs, ...withdrawnLogs, ...transferLogs].map(async (log) => {
      const block = await log.getBlock();
      const isCredit = log.event === "BalanceCredited";
      const isTransfer = log.event === "TransferETH";
      const isOutgoingTransfer = isTransfer && sameAddress(log.args.from, profileAddress);
      return {
        id: `${log.transactionHash}-${log.logIndex}`,
        type: isTransfer ? isOutgoingTransfer ? "TransferETHSent" : "TransferETHReceived" : isCredit ? "BalanceCredited" : "Withdrawn",
        item: { id: "ETH", name: "Ethereum", img: ETH_IMG, category: "Currency" },
        price: ethers.utils.formatEther(log.args.amount),
        from: isTransfer ? log.args.from : isCredit ? BANK_ADDRESS : profileAddress,
        to: isTransfer ? log.args.to : profileAddress,
        timestamp: block.timestamp,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex
      };
    }));

    return [...nftRows, ...bankRows]
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
      .slice(0, 100);
  };

  const fetchUserData = async () => {
    if (!profileAddress || !nft || !market || !auction || !bank) return;
    setLoading(true);

    try {
      const [walletBal, internalBal, tokenIds, listedIds, auctionIds] = await Promise.all([
        nft.provider.getBalance(profileAddress),
        bank.balances(profileAddress),
        buildNftUniverse(),
        market.getAllListedTokenIds(),
        auction.getAllAuctionTokenIds()
      ]);

      setWalletBalance(ethers.utils.formatEther(walletBal));
      setBankBalance(ethers.utils.formatEther(internalBal));

      const [collectedRaw, createdRaw, listedRaw, auctioningRaw, activities] = await Promise.all([
        Promise.all(tokenIds.map(async (tokenId) => {
          try {
            const owner = await nft.ownerOf(tokenId);
            return sameAddress(owner, profileAddress) ? mapTokenCard(tokenId, "owned") : null;
          } catch {
            return null;
          }
        })),
        Promise.all(tokenIds.map(async (tokenId) => {
          try {
            const creator = await nft.creatorOf(tokenId);
            return sameAddress(creator, profileAddress) ? mapTokenCard(tokenId, "created") : null;
          } catch {
            return null;
          }
        })),
        Promise.all(listedIds.map(async (tokenId) => {
          const listing = await market.listings(tokenId);
          if (!listing.active || !sameAddress(listing.seller, profileAddress)) return null;
          return mapTokenCard(tokenId, "fixed", { price: ethers.utils.formatEther(listing.price) });
        })),
        Promise.all(auctionIds.map(async (tokenId) => {
          const auc = await auction.auctions(tokenId);
          if (!auc.active || !sameAddress(auc.seller, profileAddress)) return null;
          const price = auc.highestBid.isZero() ? auc.minPrice : auc.highestBid;
          return mapTokenCard(tokenId, "auction", { price: ethers.utils.formatEther(price) });
        })),
        fetchActivities()
      ]);

      const clean = (items) => items.filter(Boolean).sort((a, b) => b.id - a.id);
      setUserNFTs({
        collected: clean(collectedRaw),
        created: clean(createdRaw),
        listed: clean(listedRaw),
        auctioning: clean(auctioningRaw),
        activity: activities
      });
    } catch (error) {
      console.error(error);
      showDialog("error", "Không tải được hồ sơ", error.reason || error.message || "Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDisplayLimit(10);
  }, [activeTab]);

  useEffect(() => {
    if (systemContract) setActiveTab("activity");
  }, [systemContract]);

  useEffect(() => {
    fetchUserData();
  }, [profileAddress, nft, market, auction, bank]);

  const handleWithdraw = async () => {
    try {
      if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối MetaMask.");
      if (!isCorrectNetwork) return showDialog("error", "Sai network", networkError);
      if (!bank) return showDialog("error", "Hợp đồng chưa sẵn sàng", "Vui lòng thử lại.");
      if (ethers.utils.parseEther(bankBalance).isZero()) return showDialog("error", "Không có số dư", "Số dư Bank của bạn đang bằng 0.");

      setProcessing(true);
      showDialog("info", "Đang rút tiền", "Vui lòng xác nhận giao dịch trong MetaMask.");
      const tx = await bank.withdraw();
      await tx.wait();
      showDialog("success", "Rút tiền thành công", "Số dư Bank đã được chuyển về ví của bạn.");
      await fetchUserData();
    } catch (error) {
      console.error(error);
      showDialog("error", "Rút tiền thất bại", error.reason || error.message || "Vui lòng thử lại.");
    } finally {
      setProcessing(false);
    }
  };

  const getEventStyle = (type) => {
    switch (type) {
      case "Mint": return { color: "text-yellow-500", icon: <Sparkles size={16} />, sign: "" };
      case "NFTBought":
      case "BidPlaced":
      case "TransferETHSent": return { color: "text-red-500", icon: <ArrowUpRight size={16} />, sign: "-" };
      case "NFTSold":
      case "AuctionCompleted":
      case "BalanceCredited":
      case "TransferETHReceived": return { color: "text-green-600", icon: <ArrowDownLeft size={16} />, sign: "+" };
      case "TransferETH": return { color: "text-blue-600", icon: <ArrowUpRight size={16} />, sign: "" };
      case "AuctionWon": return { color: "text-green-600", icon: <Trophy size={16} />, sign: "-" };
      case "Withdrawn": return { color: "text-blue-600", icon: <Wallet size={16} />, sign: "" };
      case "ListingCanceled":
      case "AuctionCanceled":
      case "AuctionEndedNoBid": return { color: "text-orange-500", icon: <ArchiveX size={16} />, sign: "" };
      case "NFTListed": return { color: "text-purple-600", icon: <Tag size={16} />, sign: "" };
      case "AuctionStarted": return { color: "text-orange-500", icon: <Gavel size={16} />, sign: "" };
      default: return { color: "text-gray-500", icon: <Activity size={16} />, sign: "" };
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case "Mint": return "Đúc NFT";
      case "NFTListed": return "Niêm yết";
      case "NFTBought": return "Mua NFT";
      case "NFTSold": return "Bán NFT";
      case "ListingCanceled": return "Hủy niêm yết";
      case "AuctionStarted": return "Mở đấu giá";
      case "BidPlaced": return "Đặt giá";
      case "AuctionWon": return "Thắng đấu giá";
      case "AuctionCompleted": return "Chốt thầu thành công";
      case "AuctionCanceled": return "Hủy đấu giá";
      case "AuctionEndedNoBid": return "Kết thúc không có người mua";
      case "BalanceCredited": return "Cộng tiền vào Bank";
      case "Withdrawn": return "Rút tiền";
      case "TransferETHSent": return "Chuyển ETH";
      case "TransferETHReceived": return "Nhận ETH";
      case "TransferETH": return "Chuyển ETH";
      default: return type;
    }
  };

  const handleActivityClick = (tokenId) => {
    if (tokenId === "ETH") return;
    if (userNFTs.listed.find((item) => item.id === tokenId)) return navigate(`/explore/${tokenId}`);
    if (userNFTs.auctioning.find((item) => item.id === tokenId)) return navigate(`/auction/${tokenId}`);
    if (isMyProfile && userNFTs.collected.find((item) => item.id === tokenId)) return navigate(`/owned/${tokenId}`);
    navigate(`/explore/${tokenId}`);
  };

  const currentDisplayData = systemContract ? userNFTs.activity : userNFTs[activeTab] || [];
  const displayedItems = currentDisplayData.slice(0, displayLimit);
  const hasMore = currentDisplayData.length > displayLimit;

  if (!profileAddress) {
    return (
      <div className="text-center py-32">
        <Wallet size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold">Vui lòng kết nối ví</h2>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-6 lg:p-12 relative">
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

      {!isCorrectNetwork && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold text-red-600">
          {networkError}
        </div>
      )}

      <section className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm relative overflow-hidden mb-12">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-50"></div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
          <div className="w-40 h-40 rounded-full border-[6px] border-white overflow-hidden shadow-2xl shrink-0 bg-gray-100">
            <div className="w-full h-full" style={{ background: generateGradient(profileAddress) }}></div>
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-5">
              <h1 onClick={() => handleCopy(profileAddress, "mainWallet")} className="text-4xl lg:text-5xl font-black tracking-tighter text-gray-900 font-mono cursor-pointer hover:text-blue-600 flex items-center justify-center md:justify-start gap-3">
                {short(profileAddress)}
                {copiedId === "mainWallet" ? <CheckCircle2 size={26} className="text-green-500" /> : <Copy size={24} className="text-gray-300" />}
              </h1>
              <span className={`${profileIdentity.color} px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit mx-auto md:mx-0`}>
                <span className={`w-2 h-2 rounded-full ${profileIdentity.dot}`}></span>
                {profileIdentity.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              {systemContract ? (
                <>
                  <InfoPill icon={<Wallet size={16} />} name="ETH hợp đồng" label={`${Number(walletBalance).toFixed(3)} ETH`} title="Số dư ETH gốc đang nằm trực tiếp tại địa chỉ hợp đồng" />
                  <InfoPill icon={<Activity size={16} />} name="Vai trò" label={systemContract.shortRole} title={systemContract.role} />
                  <InfoPill icon={<ArrowDownLeft size={16} />} name="Bank" label="Không áp dụng" title="Số dư Bank là số dư nội bộ của người dùng, không phải thông tin chính của hợp đồng hệ thống" dark />
                </>
              ) : (
                <>
                  <InfoPill icon={<Wallet size={16} />} name="Ví" label={`${Number(walletBalance).toFixed(3)} ETH`} title="Số dư ETH trong ví MetaMask" />
                  <InfoPill icon={<ArrowDownLeft size={16} />} name="Bank" label={`${Number(bankBalance).toFixed(3)} ETH`} title="Số dư nội bộ trong hợp đồng Bank, có thể rút về ví" dark />
                </>
              )}
              {isMyProfile && !systemContract && (
                <button onClick={handleWithdraw} disabled={processing || Number(bankBalance) <= 0} className="px-5 py-2.5 rounded-2xl bg-green-600 text-white text-sm font-bold hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed">
                  {processing ? "Đang xử lý..." : "Rút tiền"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {systemContract ? (
        <ContractProfilePanel
          contractInfo={systemContract}
          address={profileAddress}
          walletBalance={walletBalance}
          short={short}
          copiedId={copiedId}
          handleCopy={handleCopy}
        />
      ) : (
        <nav className="flex flex-wrap gap-6 mb-10 border-b border-gray-100 pb-px">
          <TabButton active={activeTab === "collected"} onClick={() => setActiveTab("collected")} icon={<ImageIcon size={18} />} label={`Đang sở hữu (${userNFTs.collected.length})`} color="text-blue-600 border-blue-600" />
          <TabButton active={activeTab === "created"} onClick={() => setActiveTab("created")} icon={<Sparkles size={18} />} label={`Đã tạo (${userNFTs.created.length})`} color="text-pink-500 border-pink-500" />
          <TabButton active={activeTab === "listed"} onClick={() => setActiveTab("listed")} icon={<Tag size={18} />} label={`Đang niêm yết (${userNFTs.listed.length})`} color="text-purple-600 border-purple-600" />
          <TabButton active={activeTab === "auctioning"} onClick={() => setActiveTab("auctioning")} icon={<Gavel size={18} />} label={`Đang đấu giá (${userNFTs.auctioning.length})`} color="text-orange-500 border-orange-500" />
          <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")} icon={<Activity size={18} />} label="Hoạt động" color="text-green-600 border-green-600" />
        </nav>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-bold text-gray-500 uppercase">Đang đồng bộ...</p>
        </div>
      ) : systemContract || activeTab === "activity" ? (
        <ActivityTable rows={displayedItems} getEventStyle={getEventStyle} getEventLabel={getEventLabel} navigate={navigate} profileAddress={profileAddress} short={short} handleActivityClick={handleActivityClick} selfLabel={systemContract ? "HỢP ĐỒNG" : "BẠN"} />
      ) : (
        <NftGrid items={displayedItems} isMyProfile={isMyProfile} navigate={navigate} />
      )}

      {hasMore && (
        <div className="text-center pt-8 pb-12">
          <button onClick={() => setDisplayLimit((prev) => prev + 10)} className="bg-white border-2 border-gray-200 text-gray-600 hover:border-blue-600 font-bold py-3 px-8 rounded-full shadow-sm">
            Xem thêm
          </button>
        </div>
      )}
    </div>
  );
}

const ContractProfilePanel = ({ contractInfo, address, walletBalance, short, copiedId, handleCopy }) => (
  <section className="mb-10 grid lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-3 h-3 rounded-full ${contractInfo.dot}`}></div>
        <h2 className="text-xl font-black text-gray-900">Thông tin hợp đồng</h2>
      </div>
      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">{contractInfo.role}</p>
      <div className="space-y-4">
        <ContractInfoRow label="Địa chỉ hợp đồng" value={address} copyKey="contractAddress" copiedId={copiedId} onCopy={handleCopy} />
        <ContractInfoRow label="Loại hợp đồng" value={contractInfo.name} />
        <ContractInfoRow label="Vai trò ngắn" value={contractInfo.shortRole} />
        <ContractInfoRow label="ETH gốc" value={`${Number(walletBalance).toFixed(6)} ETH`} />
      </div>
    </div>

    <div className="bg-gray-900 rounded-[2rem] p-8 text-white shadow-sm">
      <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">Ghi chú demo</p>
      <h3 className="text-2xl font-black mb-4">{contractInfo.shortRole}</h3>
      <p className="text-sm text-gray-300 leading-relaxed">{contractInfo.note}</p>
      <div className="mt-6 rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-1">Hiển thị activity</p>
        <p className="text-sm font-bold">Quét sự kiện trực tiếp từ hợp đồng tương ứng.</p>
      </div>
    </div>
  </section>
);

const ContractInfoRow = ({ label, value, copyKey, copiedId, onCopy }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-gray-50 px-5 py-4">
    <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
    <button
      type="button"
      onClick={copyKey ? () => onCopy(value, copyKey) : undefined}
      className={`font-mono text-sm font-bold text-gray-900 break-all text-left sm:text-right ${copyKey ? "hover:text-blue-600 cursor-pointer" : "cursor-default"}`}
    >
      {value}
      {copyKey && (copiedId === copyKey ? <CheckCircle2 size={16} className="inline ml-2 text-green-500" /> : <Copy size={16} className="inline ml-2 text-gray-300" />)}
    </button>
  </div>
);

const InfoPill = ({ icon, name, label, title, dark }) => (
  <div title={title} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border font-mono text-sm ${dark ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
    {icon}
    <span className={dark ? "text-gray-300 font-bold" : "text-gray-500 font-bold"}>{name}:</span>
    <span className="font-bold">{label}</span>
  </div>
);

const TabButton = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} className={`pb-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${active ? color : "text-gray-400 border-transparent hover:text-gray-600"}`}>
    {icon} {label}
  </button>
);

const NftGrid = ({ items, isMyProfile, navigate }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
    {items.length === 0 ? (
      <div className="col-span-full text-center py-32 bg-white rounded-[3rem] border border-gray-100 border-dashed">
        <UserX size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold">Ví này trống</h2>
      </div>
    ) : items.map((item) => {
      const target = item.type === "auction" ? `/auction/${item.id}` : item.type === "fixed" || item.type === "created" ? `/explore/${item.id}` : isMyProfile ? `/owned/${item.id}` : `/explore/${item.id}`;
      return (
        <div key={`${item.type}-${item.id}`} onClick={() => navigate(target)} className="group bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden flex flex-col cursor-pointer">
          <div className="relative aspect-square bg-gray-50 overflow-hidden">
            <img src={item.img} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} className="w-full h-full object-cover group-hover:scale-110 duration-1000" alt={item.name} />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-gray-900 shadow-sm">{item.category}</div>
          </div>
          <div className="p-6 flex flex-col flex-1">
            <h3 className="text-xl font-black text-gray-900 truncate mb-4 group-hover:text-blue-600">{item.name}</h3>
            <div className="mt-auto pt-4 border-t border-gray-50">
              {item.price ? (
                <>
                  <p className={`text-[10px] font-bold uppercase mb-1 tracking-wider ${item.type === "auction" ? "text-orange-500" : "text-purple-600"}`}>{item.type === "auction" ? "Đang đấu giá" : "Đang niêm yết"}</p>
                  <p className="text-xl font-black text-gray-900 italic">{item.price} ETH</p>
                </>
              ) : (
                <span className="block text-xs font-bold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl uppercase tracking-wider text-center">{item.type === "created" ? "Tác phẩm gốc" : isMyProfile ? "Niêm yết / đấu giá" : "Tài sản cá nhân"}</span>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const ActivityTable = ({ rows, getEventStyle, getEventLabel, navigate, profileAddress, short, handleActivityClick, selfLabel = "BẠN" }) => (
  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest text-gray-500">
            <th className="p-6 font-bold">Sự kiện</th>
            <th className="p-6 font-bold">Vật phẩm</th>
            <th className="p-6 font-bold">Dòng tiền</th>
            <th className="p-6 font-bold">Từ</th>
            <th className="p-6 font-bold">Đến</th>
            <th className="p-6 font-bold text-right">Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Chưa có hoạt động nào.</td></tr>
          ) : rows.map((log) => {
            const style = getEventStyle(log.type);
            return (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="p-6"><div className={`flex items-center gap-2 font-bold ${style.color}`}>{style.icon} {getEventLabel(log.type)}</div></td>
                <td className="p-6">
                  <div className={`flex items-center gap-4 group w-fit ${log.item.id === "ETH" ? "" : "cursor-pointer"}`} onClick={() => handleActivityClick(log.item.id)}>
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-gray-100 p-1">
                      <img src={log.item.img} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} className={`w-full h-full ${log.item.id === "ETH" ? "object-contain" : "object-cover rounded-lg"}`} alt={log.item.name} />
                    </div>
                    <span className="font-bold text-gray-900 group-hover:text-blue-600">{log.item.name}</span>
                  </div>
                </td>
                <td className="p-6 font-mono text-sm font-black">
                  {log.price !== "-" ? <span className={`px-3 py-1.5 rounded-lg ${style.sign === "+" ? "text-green-600 bg-green-50" : style.sign === "-" ? "text-red-500 bg-red-50" : "text-gray-600 bg-gray-100"}`}>{style.sign}{log.price} ETH</span> : <span className="text-gray-400">-</span>}
                </td>
                <td className="p-6 font-mono text-xs">{renderAddress(log.from, profileAddress, navigate, short, selfLabel)}</td>
                <td className="p-6 font-mono text-xs">{renderAddress(log.to, profileAddress, navigate, short, selfLabel)}</td>
                <td className="p-6 text-right text-xs text-gray-400">{new Date(log.timestamp * 1000).toLocaleString("vi-VN")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

function renderAddress(address, profileAddress, navigate, short, selfLabel = "BẠN") {
  if (!address || address === ZERO) return <span className="text-gray-400">-</span>;
  if (address.toLowerCase() === profileAddress.toLowerCase()) return <span className="bg-gray-900 text-white font-bold px-2 py-1 rounded">{selfLabel}</span>;
  return <span onClick={() => navigate(`/profile/${address}`)} className="text-blue-600 hover:underline cursor-pointer">{short(address)}</span>;
}
