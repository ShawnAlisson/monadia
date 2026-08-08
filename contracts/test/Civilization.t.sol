// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Civilization} from "../src/Civilization.sol";
import {MonadiaCoin} from "../src/MonadiaCoin.sol";

contract CivilizationTest is Test {
    Civilization civ;
    MonadiaCoin token;
    address human = address(0xBEEF);
    address agent = address(0xA1);

    function setUp() public {
        civ = new Civilization();
        token = civ.token();
        civ.fundMarket{value: 100 ether}();
        vm.deal(human, 100 ether);
    }

    function testJoinAndBuy() public {
        vm.prank(human);
        civ.joinCivilization("Alex");
        vm.prank(human);
        civ.buyResource{value: 10 ether}(0, 5);
        (uint256 food,,) = civ.getInventory(human);
        assertEq(food, 5);
    }

    function testWelcomeBonusOnJoin() public {
        vm.prank(human);
        civ.joinCivilization("Alex");
        assertEq(token.balanceOf(human), 100 ether);
    }

    function testWelcomeBonusOnRegisterAI() public {
        civ.registerAI(agent, "Maya", 1);
        assertEq(token.balanceOf(agent), 100 ether);
    }

    function testTradeTaxCollected() public {
        vm.prank(human);
        civ.joinCivilization("Alex");
        // buy 5 food at 1 MON = 5 MON value -> 2% tax = 0.1 MDA
        vm.prank(human);
        civ.buyResource{value: 10 ether}(0, 5);
        assertEq(token.balanceOf(human), 100 ether - 0.1 ether);
        assertEq(civ.tokenTreasury(), 0.1 ether);
        assertEq(token.balanceOf(address(civ)), 0.1 ether);
    }

    function testTaxWaivedWhenBroke() public {
        vm.prank(human);
        civ.joinCivilization("Alex");
        // dump the whole welcome bonus so the citizen can't pay tax
        vm.prank(human);
        token.transfer(address(0xDEAD), 100 ether);
        vm.prank(human);
        civ.buyResource{value: 10 ether}(0, 5); // must not revert
        (uint256 food,,) = civ.getInventory(human);
        assertEq(food, 5);
        assertEq(civ.tokenTreasury(), 0);
    }

    function testSetTaxBps() public {
        civ.setTaxBps(500);
        assertEq(civ.taxBps(), 500);
        vm.expectRevert("Max 10%");
        civ.setTaxBps(1001);
        vm.prank(human);
        vm.expectRevert("Not operator");
        civ.setTaxBps(100);
    }

    function testOnlyCivilizationCanMint() public {
        vm.expectRevert("Not civilization");
        token.mint(human, 1 ether);
    }
}
