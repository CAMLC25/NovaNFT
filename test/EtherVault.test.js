const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const parseEther = ethers.utils.parseEther;

async function latestTime() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

async function setNextTime(timestamp) {
  await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await network.provider.send("evm_mine");
}

async function deployFixture() {
  const [owner, seller, buyer, bidder1, bidder2, other] = await ethers.getSigners();

  const NFT = await ethers.getContractFactory("MyNFT");
  const nft = await NFT.deploy();
  await nft.deployed();

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await Bank.deploy();
  await bank.deployed();

  const Marketplace = await ethers.getContractFactory("FixedPriceMarket");
  const market = await Marketplace.deploy(nft.address, bank.address);
  await market.deployed();

  const Auction = await ethers.getContractFactory("AuctionMarket");
  const auction = await Auction.deploy(nft.address, bank.address);
  await auction.deployed();

  await bank.setAuthorizedContract(market.address, true);
  await bank.setAuthorizedContract(auction.address, true);

  return { owner, seller, buyer, bidder1, bidder2, other, nft, bank, market, auction };
}

async function mintTo(nft, signer, uri = "ipfs://token") {
  const tx = await nft.connect(signer).mintNFT(uri);
  const receipt = await tx.wait();
  const event = receipt.events.find((item) => item.event === "Transfer");
  return event.args.tokenId;
}

async function createAuction(nft, auction, seller, tokenId, minPrice = parseEther("1"), duration = 120) {
  await nft.connect(seller).approve(auction.address, tokenId);
  const startTime = (await latestTime()) + 10;
  const endTime = startTime + duration;
  await auction.connect(seller).startAuction(tokenId, minPrice, startTime, endTime);
  return { startTime, endTime };
}

describe("NovaNFT contracts", function () {
  describe("NFT", function () {
    it("mints safely, stores URI, creator, totalSupply and emits NFTMinted", async function () {
      const { seller, nft } = await deployFixture();

      await expect(nft.connect(seller).mintNFT("ipfs://metadata-1"))
        .to.emit(nft, "NFTMinted")
        .withArgs(1, seller.address, "ipfs://metadata-1");

      expect(await nft.ownerOf(1)).to.equal(seller.address);
      expect(await nft.tokenURI(1)).to.equal("ipfs://metadata-1");
      expect(await nft.creatorOf(1)).to.equal(seller.address);
      expect(await nft.totalSupply()).to.equal(1);
    });

    it("rejects empty tokenURI and missing token reads", async function () {
      const { seller, nft } = await deployFixture();

      await expect(nft.connect(seller).mintNFT("")).to.be.revertedWith("Token URI is required");
      await expect(nft.tokenURI(999)).to.be.revertedWith("Token does not exist");
      await expect(nft.creatorOf(999)).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Marketplace", function () {
    it("lists, sells via Bank balance, credits fee, and withdraws", async function () {
      const { owner, seller, buyer, nft, bank, market } = await deployFixture();
      const tokenId = await mintTo(nft, seller);

      await nft.connect(seller).approve(market.address, tokenId);
      await expect(market.connect(seller).listNFT(tokenId, parseEther("1")))
        .to.emit(market, "NFTListed")
        .withArgs(tokenId, seller.address, parseEther("1"));

      await expect(market.connect(buyer).buyNFT(tokenId, { value: parseEther("1") }))
        .to.emit(market, "NFTSold")
        .withArgs(tokenId, seller.address, buyer.address, parseEther("1"));

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
      expect(await bank.balances(seller.address)).to.equal(parseEther("0.98"));
      expect(await bank.balances(owner.address)).to.equal(parseEther("0.02"));

      await expect(bank.connect(seller).withdraw()).to.emit(bank, "Withdrawn").withArgs(seller.address, parseEther("0.98"));
      expect(await bank.balances(seller.address)).to.equal(0);
    });

    it("rejects invalid listing and buying cases", async function () {
      const { seller, buyer, other, nft, market } = await deployFixture();
      const tokenId = await mintTo(nft, seller);

      await expect(market.connect(other).listNFT(tokenId, parseEther("1"))).to.be.revertedWith("Not NFT owner");
      await expect(market.connect(seller).listNFT(tokenId, 0)).to.be.revertedWith("Price must be greater than zero");
      await expect(market.connect(seller).listNFT(tokenId, parseEther("1"))).to.be.revertedWith("Marketplace not approved");

      await nft.connect(seller).approve(market.address, tokenId);
      await market.connect(seller).listNFT(tokenId, parseEther("1"));

      await expect(market.connect(seller).buyNFT(tokenId, { value: parseEther("1") })).to.be.revertedWith("Cannot buy your own NFT");
      await expect(market.connect(buyer).buyNFT(tokenId, { value: parseEther("0.9") })).to.be.revertedWith("Insufficient payment");
      await expect(market.connect(other).cancelListing(tokenId)).to.be.revertedWith("Only seller can cancel");

      await expect(market.connect(seller).cancelListing(tokenId))
        .to.emit(market, "ListingCanceled")
        .withArgs(tokenId, seller.address);

      await expect(market.connect(buyer).buyNFT(tokenId, { value: parseEther("1") })).to.be.revertedWith("Listing is not active");
    });

    it("rejects duplicate active listing and excessive fee", async function () {
      const { owner, seller, nft, market } = await deployFixture();
      const tokenId = await mintTo(nft, seller);

      await nft.connect(seller).approve(market.address, tokenId);
      await market.connect(seller).listNFT(tokenId, parseEther("1"));
      await expect(market.connect(seller).listNFT(tokenId, parseEther("1"))).to.be.revertedWith("NFT already listed");
      await expect(market.connect(owner).updateFeePercent(11)).to.be.revertedWith("Fee too high");
    });
  });

  describe("Auction", function () {
    it("starts an auction, bids, refunds outbid user to Bank, completes and withdraws", async function () {
      const { seller, bidder1, bidder2, nft, bank, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const { startTime, endTime } = await createAuction(nft, auction, seller, tokenId);

      await setNextTime(startTime);

      await expect(auction.connect(bidder1).placeBid(tokenId, { value: parseEther("1") }))
        .to.emit(auction, "BidPlaced");

      await auction.connect(bidder2).placeBid(tokenId, { value: parseEther("1.5") });
      expect(await bank.balances(bidder1.address)).to.equal(parseEther("1"));

      await setNextTime(endTime + 1);
      await expect(auction.connect(bidder1).completeAuction(tokenId))
        .to.emit(auction, "AuctionCompleted");

      expect(await nft.ownerOf(tokenId)).to.equal(bidder2.address);
      expect(await bank.balances(seller.address)).to.equal(parseEther("1.5"));
      await expect(bank.connect(seller).withdraw()).to.emit(bank, "Withdrawn").withArgs(seller.address, parseEther("1.5"));
    });

    it("validates startAuction inputs and approval", async function () {
      const { seller, other, nft, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const now = await latestTime();

      await expect(auction.connect(other).startAuction(tokenId, parseEther("1"), now + 10, now + 100)).to.be.revertedWith("Not NFT owner");
      await expect(auction.connect(seller).startAuction(tokenId, 0, now + 10, now + 100)).to.be.revertedWith("Min price must be greater than zero");
      await nft.connect(seller).approve(auction.address, tokenId);
      await expect(auction.connect(seller).startAuction(tokenId, parseEther("1"), now + 100, now + 10)).to.be.revertedWith("Invalid auction time");
    });

    it("validates bid rules", async function () {
      const { seller, bidder1, bidder2, nft, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const { startTime, endTime } = await createAuction(nft, auction, seller, tokenId);

      await expect(auction.connect(bidder1).placeBid(tokenId, { value: parseEther("1") })).to.be.revertedWith("Auction has not started");
      await setNextTime(startTime);
      await expect(auction.connect(seller).placeBid(tokenId, { value: parseEther("1") })).to.be.revertedWith("Seller cannot bid");
      await expect(auction.connect(bidder1).placeBid(tokenId, { value: parseEther("0.9") })).to.be.revertedWith("Bid below min price");

      await auction.connect(bidder1).placeBid(tokenId, { value: parseEther("1") });
      await expect(auction.connect(bidder2).placeBid(tokenId, { value: parseEther("1") })).to.be.revertedWith("Bid must be higher than current bid");

      await setNextTime(endTime + 1);
      await expect(auction.connect(bidder2).placeBid(tokenId, { value: parseEther("2") })).to.be.revertedWith("Auction already ended");
    });

    it("cancels only before bids and prevents double completion", async function () {
      const { seller, bidder1, other, nft, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const { startTime } = await createAuction(nft, auction, seller, tokenId);

      await expect(auction.connect(other).cancelAuction(tokenId)).to.be.revertedWith("Only seller can cancel");
      await setNextTime(startTime);
      await auction.connect(bidder1).placeBid(tokenId, { value: parseEther("1") });
      await expect(auction.connect(seller).cancelAuction(tokenId)).to.be.revertedWith("Cannot cancel after bid");
    });

    it("cancels auction with no bid and returns NFT", async function () {
      const { seller, nft, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      await createAuction(nft, auction, seller, tokenId);

      await expect(auction.connect(seller).cancelAuction(tokenId))
        .to.emit(auction, "AuctionCanceled");

      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);
    });

    it("completes no-bid auction and rejects early or double complete", async function () {
      const { seller, bidder1, nft, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const { endTime } = await createAuction(nft, auction, seller, tokenId);

      await expect(auction.connect(bidder1).completeAuction(tokenId)).to.be.revertedWith("Auction not ended");
      await setNextTime(endTime + 1);
      await expect(auction.connect(bidder1).completeAuction(tokenId)).to.emit(auction, "AuctionEndedNoBid");
      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);
      await expect(auction.connect(bidder1).completeAuction(tokenId)).to.be.revertedWith("Auction is not active");
    });
  });

  describe("Bank", function () {
    it("allows authorized credit and rejects unauthorized credit or empty withdraw", async function () {
      const { seller, other, bank, market } = await deployFixture();

      await expect(bank.connect(other).credit(other.address, { value: parseEther("1") })).to.be.revertedWith("Not authorized");
      await expect(bank.connect(other).withdraw()).to.be.revertedWith("No balance to withdraw");

      await bank.setAuthorizedContract(other.address, true);
      await expect(bank.connect(other).credit(seller.address, { value: parseEther("1") }))
        .to.emit(bank, "BalanceCredited")
        .withArgs(seller.address, parseEther("1"));

      await expect(bank.setAuthorizedContract(ethers.constants.AddressZero, true)).to.be.revertedWith("Invalid contract");
      expect(await bank.authorizedContracts(market.address)).to.equal(true);
    });

    it("records user-to-user ETH transfers and rejects contract recipients", async function () {
      const { seller, buyer, bank, market } = await deployFixture();

      await expect(bank.connect(seller).transferETH(buyer.address, { value: parseEther("0.25") }))
        .to.emit(bank, "TransferETH")
        .withArgs(seller.address, buyer.address, parseEther("0.25"), await latestTime() + 1);

      await expect(bank.connect(seller).transferETH(market.address, { value: parseEther("0.1") }))
        .to.be.revertedWith("Recipient cannot be a contract");
    });
  });

  describe("Integration", function () {
    it("mint -> list -> buy -> withdraw", async function () {
      const { seller, buyer, nft, bank, market } = await deployFixture();
      const tokenId = await mintTo(nft, seller);

      await nft.connect(seller).approve(market.address, tokenId);
      await market.connect(seller).listNFT(tokenId, parseEther("2"));
      await market.connect(buyer).buyNFT(tokenId, { value: parseEther("2") });
      await bank.connect(seller).withdraw();

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
      expect(await bank.balances(seller.address)).to.equal(0);
    });

    it("mint -> auction -> bid -> outbid -> complete -> withdraw", async function () {
      const { seller, bidder1, bidder2, nft, bank, auction } = await deployFixture();
      const tokenId = await mintTo(nft, seller);
      const { startTime, endTime } = await createAuction(nft, auction, seller, tokenId);

      await setNextTime(startTime);
      await auction.connect(bidder1).placeBid(tokenId, { value: parseEther("1") });
      await auction.connect(bidder2).placeBid(tokenId, { value: parseEther("2") });
      expect(await bank.balances(bidder1.address)).to.equal(parseEther("1"));

      await setNextTime(endTime + 1);
      await auction.connect(bidder1).completeAuction(tokenId);
      await bank.connect(bidder1).withdraw();
      await bank.connect(seller).withdraw();

      expect(await nft.ownerOf(tokenId)).to.equal(bidder2.address);
    });
  });
});
