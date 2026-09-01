// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QuantumCoin ($QBIT) — the observer-effect memecoin
/// @notice Unofficial, unaffiliated fan project. A companion to $GODEL: where that coin
///         cannot prove itself, this one cannot be counted until you look.
///
///         Your balance is genuinely indeterminate before measurement. `balanceOf` returns a
///         fresh superposition every block — a real number, drawn from your amplitude, that is
///         non-binding and will not be what you get. Calling `measure()` collapses it once,
///         permanently, and only then do you own a definite amount you can transfer.
///
///         Supply is accounted for exactly. Collapsed tokens come out of `reserve`, and
///         `totalMeasured + reserve + burned == MAX_SUPPLY` holds after every operation.
///
///         NOT ERC-20 COMPLIANT, deliberately: `balanceOf` is non-deterministic before
///         collapse, which no wallet expects. That is the joke. Do not pool it.
///
///         The randomness is `prevrandao`-based and is NOT secure. A validator can influence
///         its own collapse. For a coin about the impossibility of knowing things, this felt
///         thematically acceptable; do not reuse this pattern where money depends on it.
contract QuantumCoin {
    string public constant name = "Quantum Coin";
    string public constant symbol = "QBIT";
    uint8 public constant decimals = 18;

    /// @dev 6,626,070,150 — Planck's constant, 6.62607015e-34, with the exponent discarded.
    uint256 public constant MAX_SUPPLY = 6_626_070_150 * 1e18;

    /// @dev Expected value of one collapse. Actual draws land in [0, 2*QUANTUM].
    uint256 public constant QUANTUM = MAX_SUPPLY / 100_000;

    /// @notice Tokens not yet claimed by any measurement.
    uint256 public reserve;
    /// @notice Sum of every collapsed balance still in existence.
    uint256 public totalMeasured;
    /// @notice Collapsed tokens destroyed. They never return to the reserve.
    /// @dev Invariant: totalMeasured + reserve + burned == MAX_SUPPLY.
    uint256 public burned;

    mapping(address => bool) public isSuperposed;
    mapping(address => bool) public isObserved;
    mapping(address => uint256) private _collapsed;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @dev Mutual entanglement. Both parties must name each other for it to take effect.
    mapping(address => address) public entangledWith;
    mapping(address => address) private _entangleRequest;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Superposed(address indexed who, uint256 amplitude);
    event Collapsed(address indexed who, uint256 value, bool viaEntanglement);
    event Entangled(address indexed a, address indexed b);

    error AlreadySuperposed();
    error NotSuperposed();
    error AlreadyObserved();
    error NotObserved();
    error ReserveExhausted();
    error CannotEntangleSelf();
    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);
    error ZeroAddress();

    constructor() {
        reserve = MAX_SUPPLY;
    }

    /* ----------------------- entering the wave ----------------------- */

    /// @notice Enter superposition. Permissionless, once per address, no cost but gas.
    ///         You now have an amplitude and an undetermined balance.
    function superpose() external {
        if (isSuperposed[msg.sender]) revert AlreadySuperposed();
        if (reserve == 0) revert ReserveExhausted();
        isSuperposed[msg.sender] = true;
        emit Superposed(msg.sender, QUANTUM);
    }

    /// @notice Propose entanglement. Takes effect only when the other address names you back.
    ///         Entangled pairs collapse together, and anticorrelated: the two draws sum to
    ///         exactly 2 * QUANTUM. Measuring yours determines theirs.
    function entangle(address other) external {
        if (other == msg.sender) revert CannotEntangleSelf();
        if (other == address(0)) revert ZeroAddress();
        if (!isSuperposed[msg.sender]) revert NotSuperposed();
        if (isObserved[msg.sender]) revert AlreadyObserved();
        _entangleRequest[msg.sender] = other;
        if (_entangleRequest[other] == msg.sender && isSuperposed[other] && !isObserved[other]) {
            entangledWith[msg.sender] = other;
            entangledWith[other] = msg.sender;
            emit Entangled(msg.sender, other);
        }
    }

    /* -------------------------- observation -------------------------- */

    /// @notice Collapse your balance. Irreversible, and the only way to get a real one.
    function measure() external {
        if (!isSuperposed[msg.sender]) revert NotSuperposed();
        if (isObserved[msg.sender]) revert AlreadyObserved();

        uint256 draw = _superposition(msg.sender);
        address partner = entangledWith[msg.sender];

        // Anticorrelation: the pair's draws sum to 2 * QUANTUM. Fix the partner's share first
        // so a depleted reserve can never leave an entangled pair half-collapsed.
        uint256 partnerDraw;
        if (partner != address(0) && !isObserved[partner]) {
            partnerDraw = (2 * QUANTUM) - draw;
        }

        if (draw + partnerDraw > reserve) revert ReserveExhausted();

        _collapse(msg.sender, draw, false);
        if (partner != address(0) && !isObserved[partner]) {
            _collapse(partner, partnerDraw, true);
        }
    }

    function _collapse(address who, uint256 value, bool viaEntanglement) private {
        isObserved[who] = true;
        _collapsed[who] = value;
        reserve -= value;
        totalMeasured += value;
        emit Collapsed(who, value, viaEntanglement);
        emit Transfer(address(0), who, value);
    }

    /// @dev The wave function. Redrawn every block; binding only at the moment measure() reads it.
    function _superposition(address who) private view returns (uint256) {
        uint256 r = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.number, who, entangledWith[who]))
        );
        return r % (2 * QUANTUM + 1);
    }

    /* ------------------------- the read surface ----------------------- */

    /// @notice Before measurement this is a live superposition: it changes every block and is
    ///         NOT what you will receive. After measurement it is your real, fixed balance.
    function balanceOf(address who) public view returns (uint256) {
        if (isObserved[who]) return _collapsed[who];
        if (isSuperposed[who]) return _superposition(who);
        return 0;
    }

    /// @notice The honest total: only collapsed tokens actually exist as balances.
    function totalSupply() external view returns (uint256) {
        return totalMeasured;
    }

    /* ---------------------------- transfers --------------------------- */

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        if (!isObserved[msg.sender]) revert NotObserved();
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

    /// @dev You cannot send what has not been determined, and the recipient must also have
    ///      collapsed — an observed token may never re-enter a superposition.
    function _transfer(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        if (!isObserved[from] || !isObserved[to]) revert NotObserved();
        uint256 bal = _collapsed[from];
        if (bal < value) revert InsufficientBalance(bal, value);
        unchecked {
            _collapsed[from] = bal - value;
            _collapsed[to] += value;
        }
        emit Transfer(from, to, value);
    }

    /// @notice Burn collapsed tokens. They do not return to the reserve; the wave loses them.
    function burn(uint256 value) external {
        if (!isObserved[msg.sender]) revert NotObserved();
        uint256 bal = _collapsed[msg.sender];
        if (bal < value) revert InsufficientBalance(bal, value);
        unchecked {
            _collapsed[msg.sender] = bal - value;
            totalMeasured -= value;
            burned += value;
        }
        emit Transfer(msg.sender, address(0), value);
    }

    /* ------------------------------ lore ------------------------------ */

    function theorem() external pure returns (string memory) {
        return "The act of checking your bag changes your bag.";
    }
}
