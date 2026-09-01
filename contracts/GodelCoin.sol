// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GodelCoin ($GODEL) — the incompleteness memecoin
/// @notice Unofficial, unaffiliated fan token inspired by Godel Terminal (@shkreloi).
///         Not an investment. Not endorsed by anyone. Possibly not provable.
///
///         Design notes (the anti-rug part, stated on-chain):
///           - Fixed supply, minted once in the constructor. There is no mint().
///           - No owner, no admin, no proxy, no pause, no blacklist, no transfer tax.
///           - Nothing in this file can change after deployment.
///         Any axiom you cannot derive from this source is not part of the system.
contract GodelCoin {
    string public constant name = "Godel Coin";
    string public constant symbol = "GODEL";
    uint8 public constant decimals = 18;

    /// @dev 1,931,000,000 tokens — for 1931, the year the incompleteness theorems shipped.
    uint256 public constant MAX_SUPPLY = 1_931_000_000 * 1e18;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);
    error ZeroAddress();

    constructor(address treasury) {
        if (treasury == address(0)) revert ZeroAddress();
        totalSupply = MAX_SUPPLY;
        balanceOf[treasury] = MAX_SUPPLY;
        emit Transfer(address(0), treasury, MAX_SUPPLY);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientAllowance(allowed, value);
            unchecked {
                allowance[from][msg.sender] = allowed - value;
            }
        }
        _transfer(from, to, value);
        return true;
    }

    /// @notice Burn your own tokens. The only supply-changing operation, and it only goes down.
    function burn(uint256 value) external {
        uint256 bal = balanceOf[msg.sender];
        if (bal < value) revert InsufficientBalance(bal, value);
        unchecked {
            balanceOf[msg.sender] = bal - value;
            totalSupply -= value;
        }
        emit Transfer(msg.sender, address(0), value);
    }

    function _transfer(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance(bal, value);
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    /* ------------------------------------------------------------------ *
     *  Lore. Pure functions, zero gas when called off-chain, zero utility.
     * ------------------------------------------------------------------ */

    /// @notice This system cannot prove its own completeness.
    function isComplete() external pure returns (bool) {
        return false;
    }

    /// @notice Assume consistency. You cannot verify it from in here.
    function isConsistent() external pure returns (bool) {
        return true;
    }

    /// @notice Every holder gets a Godel number. It means nothing. That's the point.
    function godelNumber(address holder) external pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("G(", holder, ")")));
    }

    /// @notice The undecidable sentence, on-chain, forever.
    function theorem() external pure returns (string memory) {
        return "This token is not provable within this token.";
    }
}
