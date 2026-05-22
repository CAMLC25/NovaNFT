# NovaNFT

**NovaNFT** là một nền tảng Web3 fullstack dành cho NFT, hỗ trợ đúc NFT, mua bán giá cố định, đấu giá tự động và quản lý số dư nội bộ thông qua Bank contract.

Dự án được xây dựng theo mô hình **Hybrid Decentralized NFT Marketplace & Automated Auction Platform**:

- **On-chain**: Smart contract đảm bảo quyền sở hữu NFT, giao dịch, đấu giá và dòng tiền.
- **Off-chain storage**: Pinata/IPFS lưu file tài sản và metadata NFT.
- **Off-chain worker**: Node.js bot tự động chốt các phiên đấu giá đã hết hạn.
- **Frontend**: React + Vite giúp người dùng thao tác qua MetaMask.

---

## 1. Tính Năng Chính

- Đúc NFT mới với metadata lưu trên IPFS.
- Niêm yết NFT giá cố định.
- Mua NFT bằng ETH.
- Tạo phiên đấu giá theo thời gian.
- Đặt giá, outbid và refund bidder cũ qua Bank.
- Tự động chốt đấu giá bằng `autoBot.cjs`.
- Cho phép user chốt thủ công nếu bot không chạy.
- Quản lý số dư nội bộ bằng Bank contract.
- Rút tiền từ Bank về ví.
- Chuyển ETH giữa ví user với ví user.
- Hiển thị user profile và contract profile.
- Hiển thị activity từ event logs on-chain.

---

## 2. Công Nghệ Sử Dụng

### Blockchain

- Solidity `^0.8.20`
- OpenZeppelin `v4.9.6`
- Hardhat
- Ganache local blockchain

### Frontend

- ReactJS
- Vite
- Tailwind CSS
- Lucide Icons
- React Router v6

### Web3

- Ethers.js `v5`
- MetaMask Provider

### Storage

- IPFS
- Pinata API/Gateway

### Automation

- Node.js CommonJS Worker
- `autoBot.cjs`
- `autoNFT.cjs`

---

## 3. Kiến Trúc Hệ Thống

```text
User + MetaMask
      |
      v
React Frontend
      |
      v
Ethers.js v5
      |
      v
Smart Contracts on Ganache
      |
      +--> NFT.sol
      +--> Marketplace.sol
      +--> Auction.sol
      +--> Bank.sol

Pinata/IPFS <--- asset + metadata

autoBot.cjs ---> completeAuction()
```

NovaNFT không sử dụng một contract lớn duy nhất. Hệ thống được chia thành nhiều contract nhỏ để dễ bảo trì, kiểm thử và giải thích khi bảo vệ.

---

## 4. Smart Contract

### `NFT.sol`

Contract NFT chính của hệ thống.

Chức năng:

- Kế thừa `ERC721`, `ERC721Enumerable`, `ERC721URIStorage`, `Ownable`.
- Đúc NFT bằng `_safeMint`.
- Lưu `tokenURI`.
- Lưu `creator` của từng token.
- Emit event `NFTMinted`.
- Hỗ trợ frontend quét NFT bằng `totalSupply()` và `tokenByIndex()`.

### `Marketplace.sol`

Contract xử lý mua bán giá cố định.

Chức năng:

- `listNFT()`: seller niêm yết NFT.
- `buyNFT()`: buyer mua NFT.
- `cancelListing()`: seller hủy niêm yết.
- Escrow NFT vào Marketplace contract khi listing active.
- Credit tiền bán và phí giao dịch vào Bank.

### `Auction.sol`

Contract xử lý đấu giá.

Chức năng:

- `startAuction()`: tạo phiên đấu giá.
- `placeBid()`: đặt giá.
- `cancelAuction()`: seller hủy khi chưa có bid.
- `completeAuction()`: chốt phiên sau khi hết giờ.
- Refund bidder cũ qua Bank khi bị outbid.
- Escrow NFT vào Auction contract khi auction active.

### `Bank.sol`

Contract quản lý số dư nội bộ.

Chức năng:

- `credit()`: Marketplace/Auction credit tiền cho user.
- `withdraw()`: user rút tiền về ví.
- `transferETH()`: chuyển ETH giữa ví user.
- Chỉ authorized contract được gọi `credit()`.
- Chặn chuyển ETH vào contract trong `transferETH()`.

---

## 5. Pinata Và IPFS

NovaNFT dùng Pinata/IPFS để lưu file NFT và metadata.

Luồng xử lý:

1. User chọn ảnh bìa và file tài sản.
2. Frontend upload file lên Pinata.
3. Pinata trả về IPFS URL/CID.
4. Frontend tạo metadata JSON.
5. Metadata JSON được upload lên IPFS.
6. Smart contract mint NFT với `tokenURI` trỏ tới metadata.

Ví dụ metadata:

```json
{
  "name": "Nova Artwork",
  "description": "Tác phẩm NFT",
  "thumbnail": "ipfs://...",
  "asset": "ipfs://...",
  "category": "image"
}
```

Lý do không lưu file trực tiếp trên blockchain:

- Chi phí gas rất cao.
- Blockchain phù hợp để lưu quyền sở hữu và URI.
- IPFS phù hợp để lưu metadata và tài sản số.

---

## 6. AutoBot

`autoBot.cjs` là worker off-chain tự động chốt đấu giá.

Bot thực hiện:

- Kết nối Ganache qua RPC.
- Dùng private key bot từ `.env`.
- Đọc Auction contract address từ `src/constants/contractAddress.json`.
- Gọi `getAllAuctionTokenIds()`.
- Kiểm tra auction nào `active == true` và đã hết giờ.
- Gọi `completeAuction(tokenId)`.

Nếu bot bị lỗi hoặc không chạy, frontend vẫn cho user gọi `completeAuction()` thủ công sau khi hết giờ.

---

## 7. Frontend

Các trang chính:

- Trang chủ
- Khám phá NFT
- Chi tiết NFT bán giá cố định
- Trang đấu giá
- Chi tiết đấu giá
- Tạo NFT
- Hồ sơ người dùng
- Hồ sơ contract
- Chuyển tiền

Frontend có các kiểm tra:

- Ví MetaMask đã kết nối.
- Đúng network Ganache.
- Contract đã load.
- Giá ETH hợp lệ.
- Trạng thái đấu giá hợp lệ.
- Loading/processing state để tránh spam click.
- Hiển thị lỗi MetaMask hoặc revert reason từ contract.

---

## 8. Activity Và Profile

NovaNFT đọc activity từ event logs.

User profile gồm:

- Đang sở hữu
- Đã tạo
- Đang niêm yết
- Đang đấu giá
- Hoạt động

Activity hỗ trợ:

- Đúc NFT
- Niêm yết
- Mua NFT
- Bán NFT
- Mở đấu giá
- Đặt giá
- Chốt thầu
- Hủy đấu giá
- Kết thúc không có người mua
- Cộng tiền vào Bank
- Rút tiền
- Chuyển ETH
- Nhận ETH

Contract profile hiển thị:

- Địa chỉ hợp đồng.
- Loại hợp đồng.
- Chức năng.
- ETH gốc tại contract.
- Phạm vi activity.
- Lịch sử event liên quan.

---

## 9. Cài Đặt Dự Án

### Yêu cầu

- Node.js
- Ganache
- MetaMask
- Pinata account

### Cài dependencies

```bash
npm install
```

---

## 10. Cấu Hình `.env`

Tạo file `.env` ở thư mục gốc:

```env
VITE_PINATA_JWT=your_pinata_jwt
GANACHE_URL=http://127.0.0.1:7545
GANACHE_PRIVATE_KEY=your_ganache_private_key
BOT_SCAN_INTERVAL_MS=12000
```

Giải thích:

- `VITE_PINATA_JWT`: JWT token dùng để upload file lên Pinata.
- `GANACHE_URL`: RPC URL của Ganache.
- `GANACHE_PRIVATE_KEY`: private key ví deploy/bot.
- `BOT_SCAN_INTERVAL_MS`: chu kỳ quét auction của bot.

Không commit `.env` lên GitHub.

---

## 11. Cấu Hình Ganache Và MetaMask

Ganache local:

```text
RPC URL: http://127.0.0.1:7545
Chain ID: 1337
Currency: ETH
```

MetaMask:

1. Thêm network Ganache local.
2. Import private key từ Ganache.
3. Đảm bảo tài khoản có ETH test.
4. Chọn đúng network trước khi thao tác frontend.

---

## 12. Compile Và Deploy Contract

Compile:

```bash
npx hardhat compile
```

Deploy lên Ganache:

```bash
npx hardhat run scripts/deploy.js --network ganache
```

Sau khi deploy, script sẽ cập nhật:

```text
src/constants/contractAddress.json
```

Deploy order:

1. NFT
2. Bank
3. Marketplace
4. Auction
5. Authorize Marketplace trong Bank
6. Authorize Auction trong Bank

---

## 13. Chạy Frontend

```bash
npm run dev
```

Mở trình duyệt:

```text
http://localhost:5173
```

Build production:

```bash
npm run build
```

---

## 14. Chạy AutoBot

```bash
node autoBot.cjs
```

Log mẫu:

```text
[autoBot] Worker tự động chốt đấu giá NovaNFT đã khởi động
[autoBot] RPC: http://127.0.0.1:7545
[autoBot] Ví bot: 0x...
[autoBot] Auction contract: 0x...
[autoBot] Chu kỳ quét: 12000ms
```

Bot cần ví có ETH để trả gas.

---

## 15. Tạo Dữ Liệu Mẫu

```bash
node autoNFT.cjs
```

Script này dùng để mint và tạo dữ liệu NFT mẫu phục vụ demo local.

---

## 16. Chạy Test

```bash
npm test
```

Test hiện có:

- NFT mint, tokenURI, creator, totalSupply.
- Marketplace list, buy, cancel, fee, Bank balance.
- Auction start, bid, outbid refund, cancel, complete.
- Bank credit, withdraw, user-to-user transfer.
- Integration flow.

Kết quả gần nhất:

```text
15 passing
```

---

## 17. Luồng Demo Đề Xuất

1. Chạy Ganache.
2. Import account vào MetaMask.
3. Deploy contract.
4. Chạy frontend.
5. Kết nối ví.
6. Tạo NFT mới.
7. Niêm yết NFT giá cố định.
8. Mua NFT bằng ví khác.
9. Kiểm tra Bank balance của seller.
10. Rút tiền từ Bank.
11. Tạo phiên đấu giá.
12. Đặt giá bằng bidder 1.
13. Outbid bằng bidder 2.
14. Kiểm tra refund bidder 1 trong Bank.
15. Chờ hết giờ.
16. Chạy autoBot để tự chốt phiên.
17. Kiểm tra NFT về winner.
18. Kiểm tra tiền về seller trong Bank.
19. Xem activity user.
20. Xem contract profile.

---

## 18. Cấu Trúc Thư Mục

```text
contracts/
  NFT.sol
  Marketplace.sol
  Auction.sol
  Bank.sol

scripts/
  deploy.js

src/
  components/
  constants/
  context/
  pages/
  services/

test/
  EtherVault.test.js

autoBot.cjs
autoNFT.cjs
hardhat.config.js
package.json
```

---

## 19. Lưu Ý Khi Demo

- Ganache phải đang chạy.
- MetaMask phải chọn đúng network.
- `.env` phải có `GANACHE_PRIVATE_KEY`.
- Ví bot phải có ETH test.
- Sau khi sửa contract, cần deploy lại.
- Nếu deploy lại, cần đảm bảo frontend đang dùng address mới.
- Nếu bot không chạy, user vẫn có thể bấm chốt phiên sau khi hết giờ.

---

## 20. Hạn Chế

- Dự án hiện chạy trên local Ganache.
- Chưa deploy testnet/mainnet.
- Metadata phụ thuộc Pinata/IPFS gateway.
- Chưa hỗ trợ royalty ERC2981.
- Chưa có realtime websocket listener.
- Chưa tối ưu code splitting frontend.

---

## 21. Hướng Phát Triển

- Deploy lên Sepolia testnet.
- Hỗ trợ royalty chuẩn ERC2981.
- Thêm notification khi bid/outbid.
- Thêm realtime event listener.
- Thêm dashboard admin.
- Tối ưu UI/UX cho mobile.
- Tối ưu bảo mật và audit contract.

---

## 22. Tác Giả

**CAM**
