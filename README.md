# NovaNFT

### Hybrid Decentralized NFT Marketplace & Automated Auction Platform

**NovaNFT** là nền tảng thương mại điện tử Web3 dành cho NFT, hỗ trợ mua bán giá cố định, đấu giá tự động và quản lý số dư nội bộ thông qua Bank contract.

---

## Tính năng chính

### Kiến trúc hợp đồng thông minh

- `NFT.sol`: đúc NFT, lưu tokenURI, creator và hỗ trợ ERC721Enumerable.
- `Marketplace.sol`: niêm yết, mua và hủy bán giá cố định.
- `Auction.sol`: tạo phiên đấu giá, đặt giá, hoàn tiền bidder cũ và chốt phiên.
- `Bank.sol`: quản lý số dư nội bộ và rút tiền về ví.

### Marketplace

- Niêm yết NFT theo giá cố định.
- Mua NFT trực tiếp bằng ETH.
- Seller nhận tiền trong Bank balance.
- Owner nhận phí giao dịch trong Bank balance.

### Đấu giá tự động

- Tạo phiên đấu giá theo `startTime` và `endTime`.
- Bidder cũ được hoàn tiền vào Bank khi bị outbid.
- Sau khi hết giờ, bot hoặc bất kỳ người dùng nào cũng có thể gọi chốt phiên.
- Nếu không có bid, NFT được trả về seller.

### Off-chain Worker

- `autoBot.cjs`: tự động quét và chốt các phiên đấu giá đã hết hạn.
- `autoNFT.cjs`: tạo dữ liệu NFT mẫu để demo local.

### Hồ sơ người dùng

- Đang sở hữu.
- Đã tạo.
- Đang niêm yết.
- Đang đấu giá.
- Hoạt động: mint, mua, bán, bid, chốt thầu, rút tiền, chuyển ETH.

---

## Công nghệ

- Solidity `^0.8.20`
- OpenZeppelin `v4.9.6`
- Hardhat + Ganache
- ReactJS + Vite + Tailwind CSS
- Ethers.js `v5`
- Node.js CommonJS worker

---

## Cài đặt

### Yêu cầu

- Node.js
- Ganache
- MetaMask

### Cài dependencies

```bash
npm install
```

### Cấu hình `.env`

```env
VITE_PINATA_JWT=
GANACHE_URL=http://127.0.0.1:7545
GANACHE_PRIVATE_KEY=
BOT_SCAN_INTERVAL_MS=12000
```

### Compile và deploy

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

Sau deploy, địa chỉ contract sẽ được ghi vào:

```text
src/constants/contractAddress.json
```

### Chạy frontend

```bash
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

### Chạy bot chốt đấu giá

```bash
node autoBot.cjs
```

### Tạo dữ liệu mẫu

```bash
node autoNFT.cjs
```

---

## Kiểm thử

```bash
npm test
```

---

## Luồng demo đề xuất

1. Mint NFT.
2. Niêm yết giá cố định.
3. Mua NFT.
4. Rút tiền từ Bank.
5. Tạo phiên đấu giá.
6. Bid và outbid.
7. Kiểm tra refund trong Bank.
8. Chờ hết giờ.
9. Cho autoBot chốt phiên.
10. Tắt bot và thử chốt phiên thủ công từ frontend.
11. Kiểm tra activity của user và contract profile.

---

## Tác giả

**CAM**
