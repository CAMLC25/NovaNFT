# Kịch Bản Demo NovaNFT

File này dùng cho bạn demo web khi bảo vệ đồ án. Nội dung được viết theo hướng dễ nói, không quá máy móc. Khi demo, không cần đọc y nguyên từng chữ, chỉ cần bám theo ý chính.

## 1. Trước Khi Bắt Đầu Demo

Trước khi mở web cho hội đồng xem, mình cần chuẩn bị sẵn các phần sau:

- Ganache đang chạy.
- MetaMask đã kết nối đúng mạng Ganache local.
- Có ít nhất 3 ví test:
  - Một ví dùng để tạo NFT và đăng bán.
  - Một ví dùng để mua hoặc đặt giá đầu tiên.
  - Một ví dùng để đặt giá cao hơn.
- Frontend đang chạy:

```bash
npm run dev
```

Nếu vừa reset Ganache hoặc vừa sửa smart contract thì chạy lại:

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

Nếu muốn demo tự động chốt đấu giá thì mở thêm terminal và chạy:

```bash
node autoBot.cjs
```

## 2. Mở Đầu Phần Demo

Lời dẫn gợi ý:

> Em xin demo hệ thống NovaNFT. Đây là một nền tảng NFT marketplace theo mô hình hybrid. Phần giao dịch quan trọng như mint NFT, mua bán, đấu giá, giữ NFT tạm thời và quản lý số dư đều nằm trên smart contract. Còn phần tự động chốt phiên đấu giá được xử lý bằng một worker Node.js chạy off-chain.

Nói tiếp:

> Dự án không gom toàn bộ logic vào một contract lớn, mà chia thành bốn contract chính: NFT, Marketplace, Auction và Bank. Cách chia này giúp hệ thống dễ kiểm thử, dễ bảo trì và cũng dễ giải thích luồng xử lý hơn.

## 3. Kết Nối Ví

Thao tác:

1. Mở trang NovaNFT.
2. Bấm kết nối MetaMask.
3. Chọn ví đầu tiên.

Lời dẫn:

> Đầu tiên, người dùng cần kết nối ví MetaMask. Frontend sẽ kiểm tra ví đã kết nối chưa, có đúng network Ganache hay không và các contract đã load thành công chưa. Nếu thiếu một trong các điều kiện này thì hệ thống sẽ không cho thực hiện giao dịch.

## 4. Tạo NFT Mới

Thao tác:

1. Bấm `Tạo NFT`.
2. Nhập tên tác phẩm.
3. Chọn danh mục.
4. Nhập mô tả.
5. Upload ảnh bìa và file tài sản.

Lời dẫn:

> Ở bước tạo NFT, người dùng nhập thông tin tác phẩm và upload file. File tài sản không được lưu trực tiếp lên blockchain vì chi phí gas rất cao. Thay vào đó, hệ thống upload file và metadata lên Pinata/IPFS, sau đó smart contract chỉ lưu lại `tokenURI`.

Nói thêm nếu cần:

> Trong metadata có tên NFT, mô tả, danh mục, ảnh hiển thị và file tài sản gốc. Frontend sẽ đọc `tokenURI` để hiển thị lại thông tin này.

## 5. Đăng Bán Giá Cố Định

Thao tác:

1. Chọn loại niêm yết `Giá cố định`.
2. Nhập giá, ví dụ `0.5 ETH`.
3. Bấm `Đúc & Niêm Yết Ngay`.
4. Xác nhận lần lượt các giao dịch trên MetaMask.

Lời dẫn:

> Khi bấm đúc và niêm yết, hệ thống sẽ thực hiện nhiều bước. Đầu tiên là mint NFT. Sau đó, người dùng cấp quyền cho Marketplace contract được chuyển NFT. Cuối cùng, NFT được đưa vào Marketplace để niêm yết.

Điểm cần nhấn mạnh:

> NFT được chuyển vào Marketplace contract để escrow. Nhờ vậy, khi NFT đang được bán, người bán không thể tự ý chuyển NFT đi nơi khác.

## 6. Mua NFT Bằng Ví Khác

Thao tác:

1. Chuyển sang ví thứ hai trong MetaMask.
2. Vào trang `Khám phá`.
3. Mở NFT vừa đăng bán.
4. Bấm `Mua ngay`.
5. Xác nhận giao dịch.

Lời dẫn:

> Bây giờ em chuyển sang một ví khác để đóng vai người mua. Khi người mua bấm mua, Marketplace contract sẽ kiểm tra listing còn active không, người mua có gửi đủ ETH không và người mua có phải chính seller hay không.

Nói tiếp:

> Sau khi mua thành công, NFT được chuyển từ Marketplace contract sang ví người mua. Tiền bán không chuyển trực tiếp về ví seller, mà được cộng vào số dư nội bộ trong Bank contract.

## 7. Kiểm Tra Bank Balance Và Rút Tiền

Thao tác:

1. Quay lại ví người bán.
2. Mở Profile.
3. Xem số dư `Bank`.
4. Bấm `Rút tiền`.
5. Xác nhận giao dịch.

Lời dẫn:

> Ở đây có hai loại số dư. Số dư ví là ETH thật đang nằm trong MetaMask. Còn số dư Bank là số dư nội bộ được ghi trong Bank contract. Sau khi bán NFT hoặc thắng luồng nhận tiền, seller cần tự bấm rút để chuyển tiền từ Bank về ví.

Nói thêm:

> Cách này giúp Marketplace và Auction không phải gửi ETH trực tiếp bằng `transfer`. Thay vào đó, tiền được ghi nhận bằng `Bank.credit()`, sau đó user tự withdraw.

## 8. Tạo Phiên Đấu Giá

Thao tác:

1. Tạo NFT mới hoặc mở một NFT đang sở hữu.
2. Chọn `Mở đấu giá`.
3. Nhập giá khởi điểm.
4. Có thể bỏ trống thời gian bắt đầu để bắt đầu ngay.
5. Chọn thời gian kết thúc.
6. Xác nhận giao dịch.

Lời dẫn:

> Tiếp theo là phần đấu giá. Khi tạo phiên đấu giá, NFT cũng được escrow vào Auction contract. Người tạo phiên phải là chủ sở hữu NFT và phải approve NFT cho Auction contract trước.

Nói thêm:

> Nếu bỏ trống thời gian bắt đầu, hệ thống hiểu là bắt đầu ngay. Contract sẽ dùng thời gian hiện tại của block làm `startTime`.

## 9. Đặt Giá Và Outbid

Thao tác:

1. Chuyển sang ví bidder 1.
2. Vào trang chi tiết đấu giá.
3. Đặt giá bằng hoặc cao hơn giá khởi điểm.
4. Chuyển sang ví bidder 2.
5. Đặt giá cao hơn bidder 1.

Lời dẫn:

> Với phiên đấu giá, bid đầu tiên phải lớn hơn hoặc bằng giá khởi điểm. Những bid sau phải lớn hơn giá cao nhất hiện tại. Seller không được tự đặt giá cho NFT của mình.

Nói tiếp:

> Khi bidder thứ hai đặt giá cao hơn, bidder cũ sẽ được hoàn tiền. Khoản hoàn này không chuyển trực tiếp về ví, mà được cộng vào Bank balance của bidder cũ.

Nếu có thời gian:

> Em có thể mở Profile của bidder cũ để thấy số dư Bank đã tăng lên đúng bằng số tiền đã bị outbid.

## 10. Chốt Phiên Đấu Giá

Thao tác:

1. Chờ đến khi phiên hết giờ.
2. Nếu autoBot chưa chạy, bấm `Chốt thầu ngay`.
3. Xác nhận giao dịch.
4. Kiểm tra owner NFT.
5. Kiểm tra Bank balance của seller.

Lời dẫn:

> Sau khi hết giờ, bất kỳ ai cũng có thể gọi hàm chốt phiên. Điều này quan trọng vì nếu bot gặp lỗi, người dùng vẫn có thể tự chốt thủ công trên frontend.

Nói tiếp:

> Nếu có người thắng, NFT được chuyển cho winner và giá chốt được cộng vào Bank balance của seller. Nếu không có ai đặt giá, NFT được trả lại cho seller.

## 11. Demo AutoBot

Thao tác:

1. Mở terminal đang chạy `autoBot.cjs`.
2. Tạo một phiên đấu giá có thời gian kết thúc ngắn.
3. Đặt giá.
4. Chờ hết giờ.
5. Quan sát bot tự gọi complete auction.

Lời dẫn:

> Đây là phần hybrid của dự án. AutoBot là một worker Node.js chạy bên ngoài blockchain. Bot quét danh sách auction, nếu thấy phiên nào còn active nhưng đã hết giờ thì tự gọi `completeAuction`.

Nhấn mạnh:

> Bot không thay đổi luật của hệ thống. Nó chỉ gọi một hàm smart contract hợp lệ. Toàn bộ điều kiện bảo mật vẫn nằm trong contract.

## 12. Xem Activity Và Chi Tiết Giao Dịch

Thao tác:

1. Mở Profile.
2. Chọn tab `Hoạt động`.
3. Bấm vào một dòng activity.
4. Mở modal chi tiết.

Lời dẫn:

> Phần Activity được dựng từ event logs on-chain. Mỗi hoạt động có transaction hash, block, log index, contract phát event, địa chỉ từ, địa chỉ đến và thời gian.

Nói thêm:

> Bảng chính hiển thị theo nghiệp vụ marketplace cho dễ hiểu. Ví dụ chốt thầu thành công sẽ thể hiện seller chuyển quyền sở hữu NFT cho winner. Còn trong modal chi tiết, hệ thống có thêm phần luồng kỹ thuật để giải thích tiền thật đi qua Auction, Marketplace hoặc Bank như thế nào.

## 13. Tặng NFT

Thao tác:

1. Vào NFT đang sở hữu.
2. Nhập địa chỉ ví người nhận.
3. Bấm tặng NFT.
4. Mở Profile người nhận.
5. Kiểm tra Activity có `Nhận NFT`.

Lời dẫn:

> Ngoài mua bán và đấu giá, người dùng cũng có thể chuyển NFT trực tiếp cho ví khác. Trường hợp này không đi qua Marketplace hay Auction, mà là transfer ERC721 trực tiếp. Vì vậy activity sẽ đọc event `Transfer` từ NFT contract.

## 14. Một Số Tình Huống Lỗi Có Thể Demo

Nếu còn thời gian, có thể demo nhanh vài trường hợp:

- Người bán không thể tự mua NFT của mình.
- Seller không thể tự bid phiên đấu giá của mình.
- Bid thấp hơn giá hiện tại sẽ bị từ chối.
- Phiên chưa bắt đầu thì chưa thể bid.
- Phiên đã hết giờ thì không thể bid tiếp.
- Chưa kết nối ví thì không thể giao dịch.
- Sai network thì frontend hiển thị cảnh báo.

Lời dẫn:

> Các kiểm tra này được làm ở cả frontend và smart contract. Frontend giúp người dùng hiểu lỗi sớm hơn, còn smart contract là lớp bảo vệ cuối cùng.

## 15. Kết Thúc Demo

Lời kết gợi ý:

> Như vậy, NovaNFT đã mô phỏng được một NFT marketplace tương đối đầy đủ: có mint NFT, lưu metadata bằng IPFS, mua bán giá cố định, đấu giá tự động, Bank balance, activity log và bot off-chain. Điểm chính của dự án là kết hợp smart contract để đảm bảo minh bạch với worker off-chain để tự động hóa các tác vụ theo thời gian.

## 16. Thứ Tự Demo Ngắn Gọn Khi Bảo Vệ

Nếu thời gian bị giới hạn, nên demo theo thứ tự này:

1. Kết nối ví.
2. Tạo NFT.
3. Đăng bán giá cố định.
4. Mua NFT bằng ví khác.
5. Xem Bank balance và rút tiền.
6. Tạo phiên đấu giá.
7. Đặt giá bằng hai ví.
8. Kiểm tra refund bidder cũ.
9. Chốt phiên hoặc để autoBot chốt.
10. Xem Activity và modal chi tiết.

## 17. Checklist Cuối Cùng

Trước khi lên demo, kiểm tra nhanh:

- Ganache đang chạy.
- MetaMask đúng network.
- Các ví demo có ETH.
- `src/constants/contractAddress.json` là address mới nhất.
- Pinata API hoạt động.
- Web chạy ở `localhost:5173`.
- Nếu dùng autoBot, bot đang dùng đúng private key và đúng Auction address.
- Đã thử trước ít nhất một lần các luồng mint, buy, auction.
