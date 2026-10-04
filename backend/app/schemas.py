"""Pydantic schemas for CargoChain API request/response validation per API_SPEC.md."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

STATUS_NAMES = {
    0: "Created",
    1: "Accepted",
    2: "InTransit",
    3: "Delayed",
    4: "Arrived",
    5: "Delivered",
    6: "Completed",
    7: "Rejected",
    8: "Disputed",
    9: "Cancelled",
}

MILESTONE_NAMES = {
    0: "Dispatched",
    1: "InTransit",
    2: "WarehouseArrival",
    3: "Arrived",
    4: "Delivered",
}

DOC_TYPE_NAMES = {
    0: "Invoice",
    1: "BillOfLading",
    2: "PackingList",
    3: "InspectionCertificate",
    4: "Other",
}

ROLE_NAMES = {
    0: "None",
    1: "Admin",
    2: "Shipper",
    3: "Transporter",
    4: "Warehouse",
    5: "Inspector",
    6: "Receiver",
    7: "Oracle",
}


# ── Auth Schemas ──

class NonceRequest(BaseModel):
    address: str = Field(..., description="EVM wallet address (0x...)")


class NonceResponse(BaseModel):
    nonce: str
    message: str
    expiresAt: str


class LoginRequest(BaseModel):
    address: str = Field(..., description="EVM wallet address")
    signature: str = Field(..., description="Hex signature from personal_sign")


class LoginResponse(BaseModel):
    token: str
    role: int
    roleName: str
    expiresIn: int
    address: str


# ── User Profile & Participants ──

class UserProfileResponse(BaseModel):
    address: str
    role: int
    roleName: str
    displayName: Optional[str] = None
    orgName: Optional[str] = None
    isActive: bool


class ProfileUpdateRequest(BaseModel):
    displayName: Optional[str] = None
    orgName: Optional[str] = None


class ParticipantItem(BaseModel):
    address: str
    role: int
    roleName: str
    displayName: Optional[str] = None
    orgName: Optional[str] = None
    isActive: bool
    registeredBlock: Optional[int] = None


# ── Shipment Schemas ──

class ShipmentItem(BaseModel):
    shipmentId: int
    externalRef: str
    status: int
    statusName: str
    productDescription: str
    quantity: int
    origin: str
    destination: str
    destLat: int
    destLon: int
    geofenceRadiusM: int
    shipper: str
    transporter: str
    receiver: str
    warehouse: Optional[str] = None
    inspector: Optional[str] = None
    currentCustodian: str
    expectedDelivery: int
    deliveredAt: Optional[int] = None
    paymentAmountWei: str
    createdBlock: int
    createdAt: str


class ShipmentsListResponse(BaseModel):
    items: List[ShipmentItem]
    total: int
    limit: int
    offset: int


class MilestoneItem(BaseModel):
    index: int
    type: int
    typeName: str
    location: str
    lat: Optional[int] = None
    lon: Optional[int] = None
    note: Optional[str] = None
    source: str
    submittedBy: str
    submitterRole: int
    submitterRoleName: str
    blockNumber: int
    blockTime: int
    txHash: str


class CustodyItem(BaseModel):
    fromAddress: str
    toAddress: str
    blockNumber: int
    blockTime: int
    txHash: str


class DocumentItem(BaseModel):
    docIndex: int
    docType: int
    docTypeName: str
    contentHash: str
    cid: str
    filename: Optional[str] = None
    sizeBytes: Optional[int] = None
    uploader: str
    isVerified: bool
    verifiedBy: Optional[str] = None
    verifiedAt: Optional[str] = None
    blockNumber: int
    blockTime: int
    txHash: str


class EscrowStateResponse(BaseModel):
    isDeposited: bool
    isEligible: bool
    isReleased: bool
    isRefunded: bool
    isFrozen: bool = False
    amountWei: str
    events: List[Dict[str, Any]]


# ── Document Upload / Verify Schemas ──

class DocumentUploadResponse(BaseModel):
    cid: str
    sha256: str
    size: int
    filename: str


class DocumentVerifyResponse(BaseModel):
    match: bool
    expectedHash: str
    computedHash: str
    cid: str


# ── Analytics & Audit ──

class AnalyticsSummaryResponse(BaseModel):
    totalShipments: int
    activeShipments: int
    completedShipments: int
    delayedShipments: int
    disputedShipments: int
    onTimeRate: float
    statusDistribution: Dict[str, int]


class AuditEventItem(BaseModel):
    id: int
    contractName: str
    eventName: str
    shipmentId: Optional[int] = None
    blockNumber: int
    blockTime: int
    txHash: str
    logIndex: int
    args: Dict[str, Any]


class AuditListResponse(BaseModel):
    items: List[AuditEventItem]
    total: int
    limit: int
    offset: int


# ── Dispute Schemas ──

DISPUTE_REASON_NAMES = {
    0: "Damaged",
    1: "Missing",
    2: "Delayed",
    3: "Other",
}

RESOLUTION_NAMES = {
    0: "ReleaseToTransporter",
    1: "RefundToShipper",
    2: "Split",
}


class DisputeItem(BaseModel):
    id: int
    shipmentId: int
    reason: int
    reasonName: str
    notes: str
    raisedBy: str
    isResolved: bool
    resolution: Optional[int] = None
    resolutionName: Optional[str] = None
    adminNotes: Optional[str] = None
    resolvedBy: Optional[str] = None
    raisedAt: int
    resolvedAt: Optional[int] = None
    txHash: str


class DisputesListResponse(BaseModel):
    items: List[DisputeItem]
    total: int
    limit: int
    offset: int


# ── Oracle Schemas ──

class OracleEventItem(BaseModel):
    id: int
    shipmentId: int
    lat: int
    lon: int
    milestoneType: int
    milestoneTypeName: str
    inGeofence: bool
    reporter: str
    metadataUri: Optional[str] = None
    blockNumber: int
    blockTime: int
    txHash: str


class OracleEventsResponse(BaseModel):
    items: List[OracleEventItem]
    total: int


class OracleStatusResponse(BaseModel):
    oracleAddress: str
    balanceWei: str
    isActive: bool
    activeScenarios: int
    lastReportBlock: Optional[int] = None


class StartScenarioRequest(BaseModel):
    shipmentId: int
    scenarioType: str = Field(..., description="normal, delayed, or deviated")
    name: Optional[str] = None


class ScenarioItem(BaseModel):
    scenarioId: str
    name: str
    scenarioType: str
    shipmentId: int
    status: str
    totalSteps: int
    currentStep: int
    errorMessage: Optional[str] = None
    createdAt: str
    startedAt: Optional[str] = None
    stoppedAt: Optional[str] = None


# ── Advanced Analytics & Route Corridors (Phase 6) ──

class LifecycleDurationMetrics(BaseModel):
    avgCreatedToTransitHours: float
    avgTransitToDeliveredHours: float
    avgDeliveredToCompletedHours: float
    avgTotalLifecycleHours: float


class TransporterSLAItem(BaseModel):
    transporter: str
    totalShipments: int
    onTimeShipments: int
    delayedShipments: int
    disputedShipments: int
    onTimeRatePercent: float


class CorridorDelayItem(BaseModel):
    origin: str
    destination: str
    shipmentCount: int
    delayedCount: int
    avgDelayHours: float


class WaypointItem(BaseModel):
    step: int
    locationName: str
    lat: float
    lon: float
    inGeofence: bool
    timestamp: Optional[int] = None


class RouteCorridorItem(BaseModel):
    shipmentId: int
    externalRef: str
    origin: str
    destination: str
    destLat: float
    destLon: float
    geofenceRadiusM: int
    status: str
    waypoints: List[WaypointItem]


class AdvancedAnalyticsResponse(BaseModel):
    dataClassification: str = "SYNTHETIC_LOCAL_DEMO"
    scope: str
    lifecycleDuration: LifecycleDurationMetrics
    transporterSLA: List[TransporterSLAItem]
    corridorDelays: List[CorridorDelayItem]


class RouteCorridorsResponse(BaseModel):
    dataClassification: str = "SYNTHETIC_LOCAL_DEMO"
    corridors: List[RouteCorridorItem]

