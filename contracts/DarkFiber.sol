// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DarkFiber encrypted messenger
/// @notice Stores ciphertexts on-chain while keeping the message key confidential with FHE.
contract DarkFiber is ZamaEthereumConfig {
    struct Message {
        address sender;
        address recipient;
        string cipherText;
        eaddress encryptedKey;
        uint256 timestamp;
    }

    Message[] private _messages;
    mapping(address => uint256[]) private _inbox;

    event MessageSent(uint256 indexed messageId, address indexed sender, address indexed recipient);

    error InvalidRecipient();
    error EmptyCiphertext();

    /// @notice Send an encrypted message and its encrypted key to a recipient.
    /// @param recipient The message recipient.
    /// @param cipherText The ciphertext encrypted with a one-time address-derived key.
    /// @param encryptedKey The encrypted one-time address key.
    /// @param inputProof The proof of the encrypted input.
    function sendMessage(
        address recipient,
        string calldata cipherText,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256) {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (bytes(cipherText).length == 0) {
            revert EmptyCiphertext();
        }

        eaddress key = FHE.fromExternal(encryptedKey, inputProof);

        uint256 messageId = _messages.length;
        _messages.push(
            Message({
                sender: msg.sender,
                recipient: recipient,
                cipherText: cipherText,
                encryptedKey: key,
                timestamp: block.timestamp
            })
        );
        _inbox[recipient].push(messageId);

        FHE.allowThis(key);
        FHE.allow(key, recipient);
        FHE.allow(key, msg.sender);

        emit MessageSent(messageId, msg.sender, recipient);
        return messageId;
    }

    /// @notice Returns the message ids for a recipient.
    /// @param recipient The address to query.
    function getInbox(address recipient) external view returns (uint256[] memory) {
        return _inbox[recipient];
    }

    /// @notice Returns a message by id.
    /// @param messageId The message id.
    function getMessage(uint256 messageId)
        external
        view
        returns (address sender, address recipient, string memory cipherText, eaddress encryptedKey, uint256 timestamp)
    {
        Message storage message = _messages[messageId];
        return (message.sender, message.recipient, message.cipherText, message.encryptedKey, message.timestamp);
    }

    /// @notice Returns the total message count.
    function getMessageCount() external view returns (uint256) {
        return _messages.length;
    }
}
