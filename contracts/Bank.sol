// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Bank is Ownable, ReentrancyGuard {
    mapping(address => uint256) public balances;
    mapping(address => bool) public authorizedContracts;

    event BalanceCredited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event AuthorizedContractUpdated(address indexed contractAddress, bool allowed);
    event TransferETH(address indexed from, address indexed to, uint256 amount, uint256 timestamp);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not authorized");
        _;
    }

    function setAuthorizedContract(address contractAddress, bool allowed) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract");
        authorizedContracts[contractAddress] = allowed;
        emit AuthorizedContractUpdated(contractAddress, allowed);
    }

    function credit(address user) external payable onlyAuthorized {
        require(user != address(0), "Invalid user");
        require(msg.value > 0, "Amount must be greater than zero");

        balances[user] += msg.value;
        emit BalanceCredited(user, msg.value);
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        balances[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdraw failed");

        emit Withdrawn(msg.sender, amount);
    }

    function transferETH(address to) external payable {
        require(msg.value > 0, "Amount must be greater than zero");
        require(to != address(0), "Invalid recipient");
        require(to != msg.sender, "Cannot send to yourself");
        require(to.code.length == 0, "Recipient cannot be a contract");

        (bool success, ) = to.call{value: msg.value}("");
        require(success, "Transfer failed");

        emit TransferETH(msg.sender, to, msg.value, block.timestamp);
    }
}
