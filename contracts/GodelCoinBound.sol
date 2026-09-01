// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GodelCoinBound ($GODEL) — the unexchangeable memecoin
/// @notice Unofficial, unaffiliated fan token inspired by Godel Terminal (@shkreloi).
///
///         This is the soulbound variant. The entire supply is minted once, to one
///         address, and can never move. transfer, transferFrom and approve always revert.
///         There is no market, no price, no liquidity, and no way for anyone to buy it
///         from you or lose money on it. It is a coin that can only be held and proven,
///         never exchanged — which is either the purest form of the joke or the least
///         useful token ever deployed. Both, ideally.
///
///         NOT ERC-20 COMPLIANT, deliberately: the read surface matches so wallets and
///         explorers render it, but every state-changing transfer path reverts. Do not
///         list it, pool it, or bridge it. It would not work, which is the feature.
contract GodelCoinBound {
    string public constant name = "Godel Coin (Bound)";
    string public constant symbol = "GODEL";
    uint8 public constant decimals = 18;

    /// @dev 1,931,000,000 tokens — for 1931, the year the incompleteness theorems shipped.
    uint256 public constant MAX_SUPPLY = 1_931_000_000 * 1e18;

    /// @notice The one address that will ever hold this. Set at deploy, immutable after.
    address public immutable holder;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Thrown by every path that would move tokens between addresses.
    error NotTransferable();
    error NotHolder();
    error InsufficientBalance(uint256 available, uint256 required);
    error ZeroAddress();

    constructor(address holder_) {
        if (holder_ == address(0)) revert ZeroAddress();
        holder = holder_;
        totalSupply = MAX_SUPPLY;
        balanceOf[holder_] = MAX_SUPPLY;
        emit Transfer(address(0), holder_, MAX_SUPPLY);
    }

    /* --------------------------- the wall --------------------------- */

    function transfer(address, uint256) external pure returns (bool) {
        revert NotTransferable();
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert NotTransferable();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert NotTransferable();
    }

    /// @notice Always zero. Nothing can ever be spent on your behalf.
    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    /// @notice The only way the supply ever changes, and only the holder can do it.
    ///         You may destroy your own axioms. You may not hand them to anyone else.
    function burn(uint256 value) external {
        if (msg.sender != holder) revert NotHolder();
        uint256 bal = balanceOf[holder];
        if (bal < value) revert InsufficientBalance(bal, value);
        unchecked {
            balanceOf[holder] = bal - value;
            totalSupply -= value;
        }
        emit Transfer(holder, address(0), value);
    }

    /* ---------------------------- lore ------------------------------ */

    /// @notice The honest answer, on-chain, callable by anyone before they try.
    function isTransferable() external pure returns (bool) {
        return false;
    }

    function isComplete() external pure returns (bool) {
        return false;
    }

    function isConsistent() external pure returns (bool) {
        return true;
    }

    function godelNumber(address who) external pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("G(", who, ")")));
    }

    function theorem() external pure returns (string memory) {
        return "A coin that cannot be traded cannot be wrong about its price.";
    }
}
