// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAuctionBank {
    function credit(address user) external payable;
}

contract AuctionMarket is ReentrancyGuard {
    address public nftContract;
    IAuctionBank public bank;
    uint256[] public auctionTokenIds;

    struct Auction {
        uint256 tokenId;
        address seller;
        uint256 minPrice;
        uint256 startTime;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        bool active;
    }

    mapping(uint256 => Auction) public auctions;

    event AuctionStarted(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 minPrice,
        uint256 startTime,
        uint256 endTime
    );
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount, uint256 timestamp);
    event AuctionCanceled(uint256 indexed tokenId, address indexed seller, uint256 timestamp);
    event AuctionCompleted(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed winner,
        uint256 amount,
        uint256 timestamp
    );
    event AuctionEndedNoBid(uint256 indexed tokenId, address indexed seller, uint256 timestamp);

    constructor(address _nftContract, address _bankContract) {
        require(_nftContract != address(0), "Invalid NFT contract");
        require(_bankContract != address(0), "Invalid Bank contract");
        nftContract = _nftContract;
        bank = IAuctionBank(_bankContract);
    }

    function startAuction(
        uint256 _tokenId,
        uint256 _minPrice,
        uint256 _startTime,
        uint256 _endTime
    ) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(_minPrice > 0, "Min price must be greater than zero");
        require(!auctions[_tokenId].active, "Auction already active");
        require(nft.ownerOf(_tokenId) == msg.sender, "Not NFT owner");
        require(
            nft.getApproved(_tokenId) == address(this) ||
                nft.isApprovedForAll(msg.sender, address(this)),
            "Auction not approved"
        );
        require(_endTime > _startTime, "Invalid auction time");
        require(_endTime > block.timestamp, "End time must be in future");
        require(_startTime >= block.timestamp, "Start time must be now or future");

        nft.transferFrom(msg.sender, address(this), _tokenId);

        auctions[_tokenId] = Auction({
            tokenId: _tokenId,
            seller: msg.sender,
            minPrice: _minPrice,
            startTime: _startTime,
            endTime: _endTime,
            highestBidder: address(0),
            highestBid: 0,
            active: true
        });

        auctionTokenIds.push(_tokenId);

        emit AuctionStarted(_tokenId, msg.sender, _minPrice, _startTime, _endTime);
    }

    function placeBid(uint256 _tokenId) external payable nonReentrant {
        Auction storage auction = auctions[_tokenId];

        require(auction.active, "Auction is not active");
        require(block.timestamp >= auction.startTime, "Auction has not started");
        require(block.timestamp < auction.endTime, "Auction already ended");
        require(msg.sender != auction.seller, "Seller cannot bid");

        if (auction.highestBid == 0) {
            require(msg.value >= auction.minPrice, "Bid below min price");
        } else {
            require(msg.value > auction.highestBid, "Bid must be higher than current bid");
        }

        if (auction.highestBidder != address(0)) {
            bank.credit{value: auction.highestBid}(auction.highestBidder);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(_tokenId, msg.sender, msg.value, block.timestamp);
    }

    function cancelAuction(uint256 _tokenId) external nonReentrant {
        Auction storage auction = auctions[_tokenId];

        require(auction.active, "Auction is not active");
        require(auction.seller == msg.sender, "Only seller can cancel");
        require(auction.highestBidder == address(0), "Cannot cancel after bid");

        auction.active = false;

        IERC721(nftContract).transferFrom(address(this), msg.sender, _tokenId);

        emit AuctionCanceled(_tokenId, msg.sender, block.timestamp);
    }

    function completeAuction(uint256 _tokenId) external nonReentrant {
        Auction storage auction = auctions[_tokenId];

        require(auction.active, "Auction is not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.active = false;

        if (auction.highestBidder != address(0)) {
            bank.credit{value: auction.highestBid}(auction.seller);
            IERC721(nftContract).transferFrom(address(this), auction.highestBidder, _tokenId);

            emit AuctionCompleted(
                _tokenId,
                auction.seller,
                auction.highestBidder,
                auction.highestBid,
                block.timestamp
            );
        } else {
            IERC721(nftContract).transferFrom(address(this), auction.seller, _tokenId);
            emit AuctionEndedNoBid(_tokenId, auction.seller, block.timestamp);
        }
    }

    function endAuction(uint256 _tokenId) external {
        this.completeAuction(_tokenId);
    }

    function getAllAuctionTokenIds() public view returns (uint256[] memory) {
        return auctionTokenIds;
    }
}
