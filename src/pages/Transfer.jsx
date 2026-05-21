import React, { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { Send, ArrowRight, Wallet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { AUCTION_ADDRESS, BANK_ADDRESS, MARKETPLACE_ADDRESS, NFT_ADDRESS } from "../constants";

export default function Transfer() {
  const { account, balance, bank, isCorrectNetwork, networkError } = useWeb3();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  
  // 💡 STATE CHO CUSTOM DIALOG
  const [dialog, setDialog] = useState({ isOpen: false, type: "success", title: "", message: "" });

  const showDialog = (type, title, message) => {
    setDialog({ isOpen: true, type, title, message });
  };
  const getErrorMessage = (error) => {
    if (error?.code === 4001) return "Bạn đã từ chối giao dịch trên MetaMask.";
    return error?.reason || error?.data?.message || error?.message || "Vui lòng kiểm tra lại số dư hoặc địa chỉ ví nhận.";
  };
  const isSystemContractAddress = (address) => {
    if (!address || !ethers.utils.isAddress(address)) return false;
    const normalized = address.toLowerCase();
    return [NFT_ADDRESS, MARKETPLACE_ADDRESS, AUCTION_ADDRESS, BANK_ADDRESS].some((contractAddress) => contractAddress?.toLowerCase() === normalized);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!account) return showDialog("error", "Chưa kết nối ví", "Vui lòng kết nối ví MetaMask trước khi chuyển tiền!");
    if (!bank) return showDialog("error", "Lỗi hệ thống", "Hệ thống hợp đồng thông minh chưa sẵn sàng. Vui lòng tải lại trang.");
    if (!isCorrectNetwork) return showDialog("error", "Sai mạng", networkError || "Vui lòng chuyển MetaMask về mạng Ganache local.");
    if (!ethers.utils.isAddress(recipient)) return showDialog("error", "Địa chỉ không hợp lệ", "Vui lòng nhập địa chỉ ví Ethereum hợp lệ.");
    if (recipient.toLowerCase() === account.toLowerCase()) return showDialog("error", "Không thể chuyển", "Bạn không thể tự chuyển tiền cho chính mình.");
    if (isSystemContractAddress(recipient)) return showDialog("error", "Không thể chuyển", "Chức năng này chỉ dùng để chuyển ETH giữa ví người dùng, không gửi vào hợp đồng hệ thống.");

    let value;
    try {
      value = ethers.utils.parseEther(amount);
      if (value.lte(0)) return showDialog("error", "Số tiền không hợp lệ", "Số lượng ETH phải lớn hơn 0.");
      if (balance && value.gt(ethers.utils.parseEther(balance))) return showDialog("error", "Không đủ số dư", "Ví của bạn không đủ ETH để chuyển.");
    } catch {
      return showDialog("error", "Số tiền không hợp lệ", "Vui lòng nhập số ETH hợp lệ.");
    }

    setLoading(true);
    setStatus({ type: "info", message: "Đang yêu cầu chữ ký..." });

    try {
      // Gọi qua Bank để lưu sao kê chuyển ETH giữa người dùng.
      const tx = await bank.transferETH(recipient, {
        value
      });

      setStatus({ type: "info", message: "Đang chờ Blockchain xác nhận giao dịch..." });
      await tx.wait(); // Đợi Block được đào

      setStatus({ type: "", message: "" });
      showDialog("success", "Chuyển tiền thành công!", `Bạn đã gửi ${amount} ETH đến địa chỉ ${recipient.slice(0,6)}...`);
      
      // Xóa form sau khi chuyển thành công
      setRecipient("");
      setAmount("");
    } catch (err) {
      console.error(err);
      setStatus({ type: "", message: "" });
      showDialog("error", "Giao dịch thất bại", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-6 lg:px-12 animate-in fade-in duration-700 relative">
      
      {/* 💡 CUSTOM DIALOG POPUP */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 relative">
            <button 
              onClick={() => setDialog({ ...dialog, isOpen: false })}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-inner ${dialog.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
              {dialog.type === 'error' ? <AlertCircle size={40} /> : <CheckCircle2 size={40} />}
            </div>
            
            <h3 className="text-2xl font-black text-center text-gray-900 mb-2">{dialog.title}</h3>
            <p className="text-center text-gray-500 font-medium mb-8 leading-relaxed">{dialog.message}</p>
            
            <button
              onClick={() => setDialog({ ...dialog, isOpen: false })}
              className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 ${dialog.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'}`}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden">
          
          <div className="bg-blue-600 p-10 text-white">
            <h1 className="text-4xl font-black tracking-tighter mb-2 flex items-center gap-3">
              <Send size={32} /> Chuyển Tiền
            </h1>
            <p className="opacity-80 font-medium">Gửi ETH nhanh chóng, an toàn và lưu lại lịch sử sao kê.</p>
          </div>

          <form onSubmit={handleTransfer} className="p-10 space-y-8">
            <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-between border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Số dư của bạn</p>
                  <p className="text-xl font-black text-gray-900">{balance || "0.0"} ETH</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Địa chỉ ví</p>
                <p className="font-mono text-sm font-bold text-blue-600">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Chưa kết nối"}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-900 ml-1">Địa chỉ ví người nhận</label>
              <input 
                required
                type="text" 
                placeholder="0x..." 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-600 rounded-2xl p-5 outline-none transition-all font-mono text-sm"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-900 ml-1">Số lượng (ETH)</label>
              <div className="relative">
                <input 
                  required
                  type="number" 
                  step="0.0001"
                  placeholder="0.0" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-600 rounded-2xl p-5 outline-none transition-all font-black text-2xl"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300">ETH</span>
              </div>
            </div>

            {status.message && (
              <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 flex items-center gap-3 text-sm font-bold animate-pulse">
                <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                {status.message}
              </div>
            )}

            <button 
              disabled={loading || !account}
              type="submit"
              className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-bold text-lg hover:bg-blue-600 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:bg-gray-300 flex items-center justify-center gap-3 group"
            >
              {loading ? "Đang thực hiện..." : (
                <>Xác nhận gửi <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
