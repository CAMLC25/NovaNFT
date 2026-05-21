// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBank {
    function credit(address user) external payable;
}

contract FixedPriceMarket is ReentrancyGuard, Ownable {
    uint256 public feePercent = 2;
    address public nftContract;
    IBank public bank;

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256[] public listedTokenIds;

    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCanceled(uint256 indexed tokenId, address indexed seller);

    constructor(address _nftContract, address _bankContract) Ownable() {
        require(_nftContract != address(0), "Invalid NFT contract");
        require(_bankContract != address(0), "Invalid Bank contract");
        nftContract = _nftContract;
        bank = IBank(_bankContract);
    }

    function listNFT(uint256 _tokenId, uint256 _price) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(_price > 0, "Price must be greater than zero");
        require(!listings[_tokenId].active, "NFT already listed");
        require(nft.ownerOf(_tokenId) == msg.sender, "Not NFT owner");
        require(
            nft.getApproved(_tokenId) == address(this) ||
                nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        nft.transferFrom(msg.sender, address(this), _tokenId);

        listings[_tokenId] = Listing({
            tokenId: _tokenId,
            seller: msg.sender,
            price: _price,
            active: true
        });

        listedTokenIds.push(_tokenId);

        emit NFTListed(_tokenId, msg.sender, _price);
    }

    function cancelListing(uint256 _tokenId) external nonReentrant {
        Listing storage listing = listings[_tokenId];

        require(listing.active, "Listing is not active");
        require(msg.sender == listing.seller, "Only seller can cancel");

        listing.active = false;

        IERC721(nftContract).transferFrom(address(this), msg.sender, _tokenId);

        emit ListingCanceled(_tokenId, msg.sender);
    }

    function buyNFT(uint256 _tokenId) external payable nonReentrant {
        Listing storage listing = listings[_tokenId];

        require(listing.active, "Listing is not active");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");
        require(msg.value >= listing.price, "Insufficient payment");

        uint256 price = listing.price;
        uint256 fee = (price * feePercent) / 100;
        uint256 sellerAmount = price - fee;

        listing.active = false;

        if (sellerAmount > 0) {
            bank.credit{value: sellerAmount}(listing.seller);
        }
        if (fee > 0) {
            bank.credit{value: fee}(owner());
        }

        IERC721(nftContract).transferFrom(address(this), msg.sender, _tokenId);

        if (msg.value > price) {
            (bool refunded, ) = msg.sender.call{value: msg.value - price}("");
            require(refunded, "Refund failed");
        }

        emit NFTSold(_tokenId, listing.seller, msg.sender, price);
    }

    function getAllListedTokenIds() public view returns (uint256[] memory) {
        return listedTokenIds;
    }

    function getTotalListings() public view returns (uint256) {
        return listedTokenIds.length;
    }

    function updateFeePercent(uint256 _newFee) external onlyOwner {
        require(_newFee <= 10, "Fee too high");
        feePercent = _newFee;
    }
}
