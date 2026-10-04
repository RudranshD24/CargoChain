// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ReentrancyAttacker — Test contract for escrow reentrancy protection
/// @notice Used in Hardhat tests to verify EscrowManager's nonReentrant guard.
///         NOT part of CargoChain's application contracts.
interface IEscrowManager {
    function releasePayment(uint256 shipmentId) external;
    function refund(uint256 shipmentId) external;
}

contract ReentrancyAttacker {
    IEscrowManager public target;
    uint256 public targetShipmentId;
    bool public attackRelease;
    uint256 public attackCount;
    bool public reentrancySucceeded;

    constructor(address _target) {
        target = IEscrowManager(_target);
    }

    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory) {
        (bool ok, bytes memory res) = to.call{value: value}(data);
        require(ok, "execute failed");
        return res;
    }

    function attackReleasePayment(uint256 id) external {
        targetShipmentId = id;
        attackRelease = true;
        attackCount = 0;
        reentrancySucceeded = false;
        target.releasePayment(id);
    }

    function attackRefund(uint256 id) external {
        targetShipmentId = id;
        attackRelease = false;
        attackCount = 0;
        reentrancySucceeded = false;
        target.refund(id);
    }

    receive() external payable {
        attackCount++;
        if (attackCount < 3) {
            bytes memory callData = attackRelease
                ? abi.encodeWithSelector(IEscrowManager.releasePayment.selector, targetShipmentId)
                : abi.encodeWithSelector(IEscrowManager.refund.selector, targetShipmentId);
            (bool ok, ) = address(target).call(callData);
            if (ok) {
                reentrancySucceeded = true;
            }
        }
    }
}
