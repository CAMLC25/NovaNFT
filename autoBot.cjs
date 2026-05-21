require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";
const ADMIN_PRIVATE_KEY = process.env.GANACHE_PRIVATE_KEY;
const SCAN_INTERVAL_MS = Number(process.env.BOT_SCAN_INTERVAL_MS || 12000);

if (!ADMIN_PRIVATE_KEY) {
  console.error("[autoBot] Thiếu GANACHE_PRIVATE_KEY trong file .env");
  process.exit(1);
}

const addresses = require("./src/constants/contractAddress.json");
const AUCTION_ADDRESS = addresses.auction;

if (!AUCTION_ADDRESS || AUCTION_ADDRESS === ethers.constants.AddressZero) {
  console.error("[autoBot] Địa chỉ Auction contract không hợp lệ. Vui lòng deploy contract trước.");
  process.exit(1);
}

const auctionArtifact = require("./artifacts/contracts/Auction.sol/AuctionMarket.json");
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const auctionContract = new ethers.Contract(AUCTION_ADDRESS, auctionArtifact.abi, adminWallet);
const processingAuctions = new Set();

let intervalId;

async function scanAuctions() {
  try {
    await provider.getBlockNumber();

    const gasBalance = await provider.getBalance(adminWallet.address);
    if (gasBalance.isZero()) {
      console.warn("[autoBot] Ví bot không có ETH để trả gas.");
      return;
    }

    const tokenIds = await auctionContract.getAllAuctionTokenIds();
    const now = Math.floor(Date.now() / 1000);

    for (const tokenIdBN of tokenIds) {
      const tokenId = tokenIdBN.toString();
      if (processingAuctions.has(tokenId)) continue;

      const auction = await auctionContract.auctions(tokenIdBN);
      if (!auction.active || now < auction.endTime.toNumber()) continue;

      processingAuctions.add(tokenId);

      try {
        console.log(`[autoBot] Đang chốt phiên đấu giá #${tokenId} đã hết hạn...`);
        const tx = await auctionContract.completeAuction(tokenIdBN, { gasLimit: 600000 });
        console.log(`[autoBot] Đã gửi giao dịch: ${tx.hash}`);
        await tx.wait();
        console.log(`[autoBot] Đã chốt xong phiên đấu giá #${tokenId}`);
      } catch (error) {
        console.error(`[autoBot] Không thể chốt phiên đấu giá #${tokenId}:`, error.reason || error.message);
      } finally {
        processingAuctions.delete(tokenId);
      }
    }
  } catch (error) {
    console.error("[autoBot] Quét phiên đấu giá thất bại:", error.reason || error.message);
  }
}

async function runBot() {
  console.log("[autoBot] Worker tự động chốt đấu giá NovaNFT đã khởi động");
  console.log(`[autoBot] RPC: ${RPC_URL}`);
  console.log(`[autoBot] Ví bot: ${adminWallet.address}`);
  console.log(`[autoBot] Auction contract: ${AUCTION_ADDRESS}`);
  console.log(`[autoBot] Chu kỳ quét: ${SCAN_INTERVAL_MS}ms`);

  await scanAuctions();
  intervalId = setInterval(scanAuctions, SCAN_INTERVAL_MS);
}

process.on("SIGINT", () => {
  console.log("\n[autoBot] Đang dừng worker...");
  if (intervalId) clearInterval(intervalId);
  process.exit(0);
});

runBot().catch((error) => {
  console.error("[autoBot] Lỗi nghiêm trọng:", error.reason || error.message);
  process.exit(1);
});
