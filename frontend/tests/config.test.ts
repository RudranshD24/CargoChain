import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAIN_ID,
  CHAIN_ID_HEX,
  ROLE_LABELS,
  STATUS_LABELS,
  MILESTONE_TYPE_LABELS,
  DOC_TYPE_LABELS,
  DISPUTE_REASON_LABELS,
  RESOLUTION_LABELS,
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
} from "../src/contracts/config";

describe("Frontend Contract Configurations & Enums", () => {
  it("uses canonical Ganache Chain ID 1337", () => {
    assert.equal(CHAIN_ID, 1337);
    assert.equal(CHAIN_ID_HEX, "0x539");
  });

  it("has canonical role mappings matching Solidity Role enum (8 roles)", () => {
    assert.equal(ROLE_LABELS[0], "None");
    assert.equal(ROLE_LABELS[1], "Admin");
    assert.equal(ROLE_LABELS[2], "Shipper");
    assert.equal(ROLE_LABELS[3], "Transporter");
    assert.equal(ROLE_LABELS[4], "Warehouse");
    assert.equal(ROLE_LABELS[5], "Inspector");
    assert.equal(ROLE_LABELS[6], "Receiver");
    assert.equal(ROLE_LABELS[7], "Oracle");
  });

  it("has canonical shipment statuses matching Solidity Status enum (10 states)", () => {
    assert.equal(STATUS_LABELS[0], "Created");
    assert.equal(STATUS_LABELS[1], "Accepted");
    assert.equal(STATUS_LABELS[2], "In Transit");
    assert.equal(STATUS_LABELS[3], "Delayed");
    assert.equal(STATUS_LABELS[4], "Arrived");
    assert.equal(STATUS_LABELS[5], "Delivered");
    assert.equal(STATUS_LABELS[6], "Completed");
    assert.equal(STATUS_LABELS[7], "Rejected");
    assert.equal(STATUS_LABELS[8], "Disputed");
    assert.equal(STATUS_LABELS[9], "Cancelled");
  });

  it("has canonical milestone types (5 types)", () => {
    assert.equal(MILESTONE_TYPE_LABELS[0], "Dispatched");
    assert.equal(MILESTONE_TYPE_LABELS[1], "In Transit");
    assert.equal(MILESTONE_TYPE_LABELS[2], "Warehouse Arrival");
    assert.equal(MILESTONE_TYPE_LABELS[3], "Arrived");
    assert.equal(MILESTONE_TYPE_LABELS[4], "Delivered");
  });

  it("has canonical document types (5 types)", () => {
    assert.equal(DOC_TYPE_LABELS[0], "Invoice");
    assert.equal(DOC_TYPE_LABELS[1], "Bill of Lading");
    assert.equal(DOC_TYPE_LABELS[2], "Packing List");
    assert.equal(DOC_TYPE_LABELS[3], "Inspection Certificate");
    assert.equal(DOC_TYPE_LABELS[4], "Other");
  });

  it("has canonical dispute reasons and resolution options", () => {
    assert.equal(DISPUTE_REASON_LABELS[0], "Damaged");
    assert.equal(DISPUTE_REASON_LABELS[1], "Missing");
    assert.equal(DISPUTE_REASON_LABELS[2], "Delayed");
    assert.equal(DISPUTE_REASON_LABELS[3], "Other");
    assert.equal(RESOLUTION_LABELS[0], "Release to Transporter");
    assert.equal(RESOLUTION_LABELS[1], "Refund to Shipper");
    assert.equal(RESOLUTION_LABELS[2], "Split");
  });

  it("loads all 6 contract addresses and ABIs including DisputeManager", () => {
    const contracts = [
      "ParticipantRegistry",
      "ShipmentRegistry",
      "TrackingManager",
      "DocumentRegistry",
      "EscrowManager",
      "DisputeManager",
    ];
    for (const name of contracts) {
      assert.ok((CONTRACT_ADDRESSES as any)[name], `Missing address for ${name}`);
      assert.ok(Array.isArray((CONTRACT_ABIS as any)[name]), `Missing ABI array for ${name}`);
      assert.ok((CONTRACT_ABIS as any)[name].length > 0, `Empty ABI for ${name}`);
    }
  });
});
