require("dotenv").config();
const { ethers } = require("ethers");
const addresses = require("./src/constants/contractAddress.json");

const RPC_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

const NFT_ADDRESS = addresses.nft;
const MARKET_ADDRESS = addresses.marketplace;
const AUCTION_ADDRESS = addresses.auction;

const PRIVATE_KEYS = (process.env.SEED_PRIVATE_KEYS || process.env.GANACHE_PRIVATE_KEY || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

if (PRIVATE_KEYS.length === 0) {
  console.error("Missing SEED_PRIVATE_KEYS or GANACHE_PRIVATE_KEY in .env");
  process.exit(1);
}

const nftArtifact = require("./artifacts/contracts/NFT.sol/MyNFT.json");
const marketArtifact = require("./artifacts/contracts/Marketplace.sol/FixedPriceMarket.json");
const auctionArtifact = require("./artifacts/contracts/Auction.sol/AuctionMarket.json");

const MOCK_NFTS = [
  { name: "Ether Tiger", desc: "A bold generative tiger artwork.", category: "image", url: "https://picsum.photos/seed/tiger/600", price: "1.5" },
  { name: "Lofi Chain", desc: "A calm audio collectible for Web3 sessions.", category: "audio", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", thumbnail: "https://picsum.photos/seed/music/600", price: "0.8" },
  { name: "Motion Vault", desc: "A short motion artwork.", category: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4", price: "2.5" },
  { name: "Web3 Whitepaper", desc: "A technical document collectible.", category: "document", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", thumbnail: "https://picsum.photos/seed/doc/600", price: "0.5" },
  { name: "Ape Study", desc: "A test profile-style artwork.", category: "image", url: "https://picsum.photos/seed/ape/600", price: "10.0" }
];

const createTokenURI = (nft) => {
  const json = JSON.stringify({
    name: nft.name,
    description: nft.desc,
    category: nft.category,
    image: nft.url,
    asset: nft.url,
    thumbnail: nft.thumbnail || nft.url
  });

  return "data:application/json;base64," + Buffer.from(json).toString("base64");
};

async function runBot() {
  console.log("[autoNFT] Đang tạo dữ liệu mẫu cho NovaNFT...");
  console.log(`[autoNFT] RPC: ${RPC_URL}`);
  console.log(`[autoNFT] NFT: ${NFT_ADDRESS}`);
  console.log(`[autoNFT] Marketplace: ${MARKET_ADDRESS}`);
  console.log(`[autoNFT] Auction: ${AUCTION_ADDRESS}`);

  const txConfig = { gasLimit: 3000000 };

  for (let i = 0; i < MOCK_NFTS.length; i++) {
    const nftData = MOCK_NFTS[i];
    const wallet = new ethers.Wallet(PRIVATE_KEYS[i % PRIVATE_KEYS.length], provider);

    const nftContract = new ethers.Contract(NFT_ADDRESS, nftArtifact.abi, wallet);
    const marketContract = new ethers.Contract(MARKET_ADDRESS, marketArtifact.abi, wallet);
    const auctionContract = new ethers.Contract(AUCTION_ADDRESS, auctionArtifact.abi, wallet);

    console.log(`\n[${i + 1}/${MOCK_NFTS.length}] Minting ${nftData.name} from ${wallet.address}`);

    try {
      const txMint = await nftContract.mintNFT(createTokenURI(nftData), txConfig);
      const receipt = await txMint.wait();
      const transferEvent = receipt.events?.find((event) => event.event === "Transfer");
      const tokenId = transferEvent.args.tokenId.toNumber();

      console.log(`Minted token #${tokenId}`);

      if (i % 2 === 0) {
        await (await nftContract.approve(MARKET_ADDRESS, tokenId, txConfig)).wait();
        await (await marketContract.listNFT(tokenId, ethers.utils.parseEther(nftData.price), txConfig)).wait();
        console.log(`Listed fixed-price NFT #${tokenId} for ${nftData.price} ETH`);
      } else {
        await (await nftContract.approve(AUCTION_ADDRESS, tokenId, txConfig)).wait();
        const startTime = Math.floor(Date.now() / 1000) + 5;
        const endTime = startTime + 86400;
        await (await auctionContract.startAuction(
          tokenId,
          ethers.utils.parseEther(nftData.price),
          startTime,
          endTime,
          txConfig
        )).wait();
        console.log(`Started auction NFT #${tokenId} at ${nftData.price} ETH for 24h`);
      }
    } catch (err) {
      console.error(`Failed to seed ${nftData.name}:`, err.reason || err.message);
    }
  }

  console.log("\n[autoNFT] Done.");
}

runBot();
