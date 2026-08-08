// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Civilization} from "../src/Civilization.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        Civilization civ = new Civilization();
        // Optional: set MARKET_FUND_WEI when the deployer already has enough MON.
        // Keeping this separate makes deployment succeed even with a small testnet balance.
        uint256 marketFund = vm.envOr("MARKET_FUND_WEI", uint256(0));
        if (marketFund > 0) {
            civ.fundMarket{value: marketFund}();
        }
        console.log("Civilization deployed at:", address(civ));
        console.log("MonadiaCoin (MDA) deployed at:", address(civ.token()));
        console.log("Market funded (wei):", marketFund);
        vm.stopBroadcast();
    }
}
