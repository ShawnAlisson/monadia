// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MONADIA Coin (MDA)
/// @notice Civic currency of the MONADIA civilization. Minted as welcome
///         bonuses when citizens join, and collected as trade tax by the
///         Civilization contract (its constitutional authority).
contract MonadiaCoin {
    string public constant name = "MONADIA Coin";
    string public constant symbol = "MDA";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public immutable civilization;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyCivilization() {
        require(msg.sender == civilization, "Not civilization");
        _;
    }

    constructor(address civilization_) {
        civilization = civilization_;
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
        require(allowed >= value, "Insufficient allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    /// @notice Mint new MDA (welcome bonuses, rewards). Civilization only.
    function mint(address to, uint256 value) external onlyCivilization {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    /// @notice Move tax from a citizen to the civilization treasury without allowance.
    /// @dev Game mechanic: MDA is an in-game civic token and the Civilization
    ///      contract is empowered to levy taxes on economic activity.
    function collectTax(address from, uint256 value) external onlyCivilization {
        _transfer(from, civilization, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "Insufficient balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
