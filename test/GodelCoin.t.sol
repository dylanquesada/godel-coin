// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GodelCoin} from "../contracts/GodelCoin.sol";

/// Foundry mirror of scripts/test.mjs, for anyone who has forge installed.
contract GodelCoinTest is Test {
    GodelCoin coin;
    address treasury = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        coin = new GodelCoin(treasury);
    }

    function test_SupplyMintedToTreasury() public view {
        assertEq(coin.totalSupply(), 1_931_000_000 ether);
        assertEq(coin.balanceOf(treasury), coin.totalSupply());
    }

    function test_RevertWhen_ConstructedWithZeroTreasury() public {
        vm.expectRevert(GodelCoin.ZeroAddress.selector);
        new GodelCoin(address(0));
    }

    function test_Transfer() public {
        vm.prank(treasury);
        coin.transfer(alice, 1000);
        assertEq(coin.balanceOf(alice), 1000);
    }

    function test_RevertWhen_Overspending() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GodelCoin.InsufficientBalance.selector, 0, 1));
        coin.transfer(bob, 1);
    }

    function test_RevertWhen_TransferToZero() public {
        vm.prank(treasury);
        vm.expectRevert(GodelCoin.ZeroAddress.selector);
        coin.transfer(address(0), 1);
    }

    function test_TransferFromConsumesAllowance() public {
        vm.prank(treasury);
        coin.transfer(alice, 1000);
        vm.prank(alice);
        coin.approve(bob, 400);
        vm.prank(bob);
        coin.transferFrom(alice, bob, 400);
        assertEq(coin.balanceOf(bob), 400);
        assertEq(coin.allowance(alice, bob), 0);
    }

    function test_InfiniteAllowanceIsNotDecremented() public {
        vm.prank(treasury);
        coin.transfer(alice, 1000);
        vm.prank(alice);
        coin.approve(bob, type(uint256).max);
        vm.prank(bob);
        coin.transferFrom(alice, bob, 100);
        assertEq(coin.allowance(alice, bob), type(uint256).max);
    }

    function test_BurnReducesTotalSupply() public {
        uint256 before = coin.totalSupply();
        vm.prank(treasury);
        coin.burn(500);
        assertEq(coin.totalSupply(), before - 500);
    }

    function testFuzz_TransferPreservesTotalSupply(uint256 amount) public {
        amount = bound(amount, 0, coin.totalSupply());
        vm.prank(treasury);
        coin.transfer(alice, amount);
        assertEq(coin.balanceOf(treasury) + coin.balanceOf(alice), coin.totalSupply());
    }

    function test_Lore() public view {
        assertFalse(coin.isComplete());
        assertTrue(coin.isConsistent());
        assertEq(coin.theorem(), "This token is not provable within this token.");
    }
}
