# Nội Dung Slide Giới Thiệu Dự Án NovaNFT

## Slide 1: Trang Bìa

# NovaNFT

### Hybrid Decentralized NFT Marketplace & Automated Auction Platform

Thành viên:

- Thành viên 1: Trình bày tổng quan, vấn đề, công nghệ
- Thành viên 2: Trình bày kiến trúc smart contract, luồng xử lý
- Thành viên 3: Demo hệ thống

---

## Slide 2: Lý Do Chọn Đề Tài

NFT marketplace là một ứng dụng tiêu biểu của Web3, kết hợp nhiều thành phần quan trọng:

- Quản lý tài sản số bằng blockchain
- Giao dịch minh bạch, không cần trung gian
- Đấu giá tài sản theo thời gian thực
- Tự động hóa bằng off-chain worker
- Kết nối ví MetaMask và giao diện người dùng

NovaNFT được xây dựng để mô phỏng một sàn giao dịch NFT hoàn chỉnh ở môi trường local Ganache.

---

## Slide 3: Mục Tiêu Dự Án

NovaNFT hướng đến xây dựng một nền tảng cho phép:

- Đúc NFT mới
- Niêm yết NFT với giá cố định
- Mua NFT bằng ETH
- Tạo phiên đấu giá NFT
- Đặt giá, hoàn tiền bidder cũ
- Tự động chốt phiên đấu giá khi hết giờ
- Quản lý số dư nội bộ qua Bank contract
- Theo dõi lịch sử hoạt động của user và contract

---

## Slide 4: Công Nghệ Sử Dụng

Blockchain:

- Solidity `^0.8.20`
- OpenZeppelin `v4.9.6`
- Hardhat
- Ganache

Frontend:

- ReactJS
- Vite
- Tailwind CSS
- Lucide Icons
- React Router

Web3:

- Ethers.js `v5`
- MetaMask Provider

Lưu trữ phi tập trung:

- IPFS
- Pinata Gateway/API

Automation:

- Node.js CommonJS Worker
- autoBot tự động chốt đấu giá

---

## Slide 5: Kiến Trúc Tổng Thể

NovaNFT sử dụng kiến trúc Hybrid:

On-chain:

- Smart contract xử lý quyền sở hữu NFT, mua bán, đấu giá, số dư nội bộ

Off-chain Storage:

- File NFT và metadata được upload lên IPFS thông qua Pinata
- Smart contract chỉ lưu `tokenURI`, không lưu trực tiếp file ảnh/video/audio

Off-chain:

- Bot Node.js quét các phiên đấu giá hết hạn và tự động gọi chốt phiên

Frontend:

- React app cho phép người dùng tương tác với smart contract qua MetaMask

Sơ đồ:

```text
User + MetaMask
      ↓
React Frontend
      ↓
Ethers.js
      ↓
Smart Contracts
      ↓
Ganache Blockchain

Pinata/IPFS ← metadata + asset

Node.js Bot → tự động completeAuction()
```

---

## Slide 6: Các Smart Contract Chính

Hệ thống gồm 4 contract:

- `NFT.sol`: quản lý NFT, tokenURI, creator, totalSupply
- `Marketplace.sol`: xử lý mua bán giá cố định
- `Auction.sol`: xử lý đấu giá, bid, refund, complete
- `Bank.sol`: quản lý số dư nội bộ và withdraw

Điểm mạnh:

- Hệ thống được chia module rõ ràng
- Dễ bảo trì
- Dễ kiểm thử
- Dễ giải thích kiến trúc khi bảo vệ

---

## Slide 7: NFT Contract

`NFT.sol` kế thừa:

- ERC721
- ERC721Enumerable
- ERC721URIStorage
- Ownable

Chức năng chính:

- Đúc NFT bằng `_safeMint`
- Lưu tokenURI
- Lưu creator của từng NFT
- Emit event `NFTMinted`
- Cho phép frontend quét NFT bằng `totalSupply()` và `tokenByIndex()`
- `tokenURI` trỏ đến metadata được lưu trên IPFS thông qua Pinata

Ý nghĩa:

NFT contract là nơi quản lý tài sản số và quyền sở hữu NFT.

---

## Slide 8: Pinata Và IPFS

NovaNFT sử dụng Pinata/IPFS để lưu trữ dữ liệu NFT.

Lý do cần IPFS:

- File NFT có thể là ảnh, video, audio hoặc tài liệu
- Không nên lưu file trực tiếp trên blockchain vì chi phí gas rất cao
- Blockchain chỉ nên lưu đường dẫn metadata thông qua `tokenURI`

Luồng lưu trữ:

1. Người dùng chọn ảnh bìa và file tài sản
2. Frontend upload file lên Pinata
3. Pinata trả về IPFS URL/CID
4. Frontend tạo metadata JSON gồm name, description, category, image, asset
5. Metadata JSON tiếp tục được upload lên IPFS
6. Smart contract mint NFT với `tokenURI` trỏ đến metadata đó

Ví dụ metadata:

```json
{
  "name": "Nova Artwork",
  "description": "Tác phẩm NFT",
  "image": "ipfs://...",
  "asset": "ipfs://...",
  "category": "image"
}
```

Ý nghĩa:

- Blockchain đảm bảo quyền sở hữu
- IPFS/Pinata đảm bảo lưu trữ metadata và tài sản số
- Frontend đọc `tokenURI` để hiển thị NFT

---

## Slide 9: Marketplace Contract

`Marketplace.sol` xử lý bán giá cố định.

Luồng hoạt động:

1. Seller approve NFT cho Marketplace
2. Seller gọi `listNFT`
3. NFT được chuyển vào Marketplace để escrow
4. Buyer gọi `buyNFT`
5. NFT chuyển từ Marketplace sang buyer
6. Tiền bán được cộng vào Bank balance của seller
7. Phí giao dịch được cộng vào Bank balance của owner

Điểm an toàn:

- Kiểm tra owner
- Kiểm tra approve
- Không cho seller tự mua
- Không dùng `transfer`, tiền đi qua Bank

---

## Slide 10: Auction Contract

`Auction.sol` xử lý đấu giá.

Luồng hoạt động:

1. Seller approve NFT cho Auction
2. Seller tạo phiên đấu giá
3. NFT được escrow vào Auction contract
4. Bidder đặt giá
5. Nếu có bidder mới, bidder cũ được refund vào Bank
6. Hết giờ, bot hoặc user gọi `completeAuction`
7. NFT chuyển cho winner
8. Tiền được cộng vào Bank balance của seller

Trạng thái đấu giá:

- Chưa bắt đầu
- Đang live
- Chờ chốt thầu
- Đã chốt thầu thành công
- Chủ sở hữu đã hủy
- Kết thúc không có người mua

---

## Slide 11: Bank Contract

`Bank.sol` đóng vai trò vault nội bộ.

Chức năng:

- `credit`: chỉ Marketplace hoặc Auction được gọi
- `withdraw`: user rút số dư về ví
- `transferETH`: chuyển ETH giữa user với user
- Emit event:
  - `BalanceCredited`
  - `Withdrawn`
  - `TransferETH`

Lợi ích:

- Tránh gửi ETH trực tiếp trong Marketplace/Auction
- Dễ quản lý dòng tiền
- Dễ hiển thị lịch sử hoạt động
- Tăng tính an toàn khi giao dịch

---

## Slide 12: AutoBot

`autoBot.cjs` là worker off-chain.

Chức năng:

- Kết nối Ganache qua RPC
- Dùng ví bot từ `.env`
- Quét danh sách auction bằng `getAllAuctionTokenIds`
- Nếu auction active và đã hết giờ, gọi `completeAuction`
- Log giao dịch và tx hash

Ý nghĩa:

- Người dùng không cần tự chốt phiên
- Nếu bot lỗi, user vẫn có thể chốt thủ công
- Đảm bảo hệ thống không bị phụ thuộc hoàn toàn vào off-chain worker

---

## Slide 13: Frontend

Frontend gồm các màn hình chính:

- Trang chủ
- Khám phá NFT
- Chi tiết NFT bán giá cố định
- Trang đấu giá
- Chi tiết đấu giá
- Tạo NFT
- Hồ sơ người dùng
- Hồ sơ contract
- Chuyển tiền

Các điểm nổi bật:

- Kết nối MetaMask
- Kiểm tra network Ganache
- Upload asset và metadata lên Pinata/IPFS
- Loading state cho từng action
- Hiển thị lỗi giao dịch
- Activity log từ event on-chain
- Phân biệt user profile và contract profile

---

## Slide 14: Activity Và Profile

NovaNFT có hệ thống activity dựa trên event logs.

User profile hiển thị:

- Đang sở hữu
- Đã tạo
- Đang niêm yết
- Đang đấu giá
- Hoạt động

Activity gồm:

- Đúc NFT
- Niêm yết
- Mua NFT
- Bán NFT
- Mở đấu giá
- Đặt giá
- Chốt thầu
- Hủy đấu giá
- Cộng tiền vào Bank
- Rút tiền
- Chuyển ETH

Contract profile hiển thị:

- Thông tin hợp đồng
- ETH gốc tại contract
- Phạm vi activity
- Lịch sử event liên quan đến contract

---

## Slide 15: Luồng Demo

Thành viên 3 demo theo thứ tự:

1. Kết nối MetaMask
2. Tạo NFT mới
3. Upload ảnh/file và metadata lên Pinata/IPFS
4. Niêm yết NFT giá cố định
5. Mua NFT bằng ví khác
6. Kiểm tra tiền vào Bank
7. Rút tiền từ Bank
8. Tạo phiên đấu giá
9. Đặt giá bằng ví bidder
10. Outbid bằng ví khác
11. Kiểm tra refund bidder cũ
12. Chờ hết giờ
13. Bot tự động chốt phiên
14. Kiểm tra NFT về winner và tiền về seller
15. Xem activity trong profile

---

## Slide 16: Kiểm Thử

Dự án có test Hardhat cho các luồng chính:

NFT:

- Mint thành công
- Không cho tokenURI rỗng
- Creator đúng
- totalSupply tăng

Marketplace:

- List, buy, cancel
- Không cho tự mua
- Không cho mua thiếu ETH
- Seller nhận tiền qua Bank

Auction:

- Start auction
- Bid
- Outbid refund
- Cancel khi chưa có bid
- Complete sau endTime
- No-bid trả NFT về seller

Bank:

- Authorized credit
- Withdraw
- Chuyển ETH user-to-user
- Chặn gửi vào contract

---

## Slide 17: Kết Quả Đạt Được

NovaNFT đã hoàn thiện các chức năng chính:

- Đúc NFT
- Upload metadata và asset lên Pinata/IPFS
- Mua bán giá cố định
- Đấu giá tự động
- Quản lý số dư Bank
- Hoạt động user và contract
- autoBot chốt phiên
- Hardhat test pass
- Frontend build thành công

Kết quả kiểm thử:

```text
15 passing
npm run build thành công
```

---

## Slide 18: Hạn Chế

Một số hạn chế hiện tại:

- Hệ thống chạy ở local Ganache
- Metadata phụ thuộc Pinata/IPFS
- Chưa deploy testnet/mainnet
- Chưa hỗ trợ royalty chuẩn ERC2981
- Chưa có realtime websocket event listener
- Chưa tối ưu code splitting frontend

---

## Slide 19: Hướng Phát Triển

Trong tương lai, NovaNFT có thể mở rộng:

- Deploy lên testnet như Sepolia
- Hỗ trợ royalty ERC2981
- Tích hợp IPFS gateway ổn định hơn
- Tối ưu UI realtime bằng event listener
- Thêm hệ thống search/filter nâng cao
- Thêm notification khi bid/outbid
- Thêm dashboard admin
- Tối ưu bảo mật và audit contract

---

## Slide 20: Phân Công Thành Viên

Thành viên 1:

- Giới thiệu đề tài
- Lý do chọn đề tài
- Công nghệ sử dụng
- Kiến trúc tổng thể

Thành viên 2:

- Trình bày smart contract
- Luồng Marketplace
- Luồng Auction
- Bank và AutoBot
- Kiểm thử

Thành viên 3:

- Demo web
- Chạy luồng mint, buy, auction
- Giải thích activity và Bank balance
- Trả lời phần thao tác thực tế

---

## Slide 21: Kết Luận

NovaNFT là một nền tảng NFT marketplace hybrid kết hợp:

- Smart contract để đảm bảo minh bạch và bảo mật
- Pinata/IPFS để lưu trữ metadata và tài sản NFT
- Frontend React để người dùng thao tác dễ dàng
- Bank contract để quản lý dòng tiền an toàn
- Node.js bot để tự động hóa đấu giá

Dự án thể hiện được một quy trình Web3 fullstack hoàn chỉnh từ contract, frontend, worker đến kiểm thử.
