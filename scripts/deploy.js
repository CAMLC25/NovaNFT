const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying NovaNFT contracts to Ganache...");

  const NFT = await hre.ethers.getContractFactory("MyNFT");
  const nft = await NFT.deploy();
  await nft.deployed();
  console.log("NFT:", nft.address);

  const Bank = await hre.ethers.getContractFactory("Bank");
  const bank = await Bank.deploy();
  await bank.deployed();
  console.log("Bank:", bank.address);

  const Marketplace = await hre.ethers.getContractFactory("FixedPriceMarket");
  const marketplace = await Marketplace.deploy(nft.address, bank.address);
  await marketplace.deployed();
  console.log("Marketplace:", marketplace.address);

  const Auction = await hre.ethers.getContractFactory("AuctionMarket");
  const auction = await Auction.deploy(nft.address, bank.address);
  await auction.deployed();
  console.log("Auction:", auction.address);

  await (await bank.setAuthorizedContract(marketplace.address, true)).wait();
  await (await bank.setAuthorizedContract(auction.address, true)).wait();
  console.log("Bank authorizations configured.");

  const addresses = {
    nft: nft.address,
    marketplace: marketplace.address,
    auction: auction.address,
    bank: bank.address
  };

  const dir = "./src/constants";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(`${dir}/contractAddress.json`, JSON.stringify(addresses, null, 2));
  console.log("Saved addresses to src/constants/contractAddress.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
