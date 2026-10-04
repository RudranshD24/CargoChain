/**
 * Typed API Client for CargoChain P2 Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class ApiException extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(code: string, message: string, statusCode: number, details?: any) {
    super(message);
    this.name = "ApiException";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cargochain_token");
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Set json content-type if body is JSON string and not form-data
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiException("NETWORK_ERROR", `Failed to connect to backend server: ${err.message}`, 0);
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cargochain_token");
      localStorage.removeItem("cargochain_user");
    }
  }

  let data: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errObj = data?.error;
    const code = errObj?.code || "HTTP_ERROR";
    const msg = errObj?.message || response.statusText || "Request failed";
    throw new ApiException(code, msg, response.status, errObj?.details);
  }

  return data as T;
}

// ──────────────── Auth Endpoints ────────────────

export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface LoginResponse {
  token: string;
  role: number;
  roleName: string;
  expiresIn: number;
  address: string;
}

export interface UserProfile {
  address: string;
  role: number;
  roleName: string;
  isActive: boolean;
  companyName?: string | null;
  email?: string | null;
  physicalAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const api = {
  // Auth
  async getNonce(address: string): Promise<NonceResponse> {
    return apiFetch<NonceResponse>("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  },

  async login(address: string, signature: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ address, signature }),
    });
  },

  async getMe(): Promise<UserProfile> {
    return apiFetch<UserProfile>("/me");
  },

  // Participants (Admin only)
  async getParticipants(page = 1, pageSize = 20): Promise<{ items: UserProfile[]; total: number; page: number; pageSize: number }> {
    return apiFetch(`/participants?page=${page}&pageSize=${pageSize}`);
  },

  async updateParticipantProfile(
    address: string,
    profile: { companyName?: string; email?: string; physicalAddress?: string }
  ): Promise<UserProfile> {
    return apiFetch<UserProfile>(`/participants/${address}/profile`, {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  },

  // Shipments
  async getShipments(params: { page?: number; pageSize?: number; status?: number | string; q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.pageSize) query.set("pageSize", params.pageSize.toString());
    if (params.status !== undefined && params.status !== "") query.set("status", params.status.toString());
    if (params.q) query.set("q", params.q);

    return apiFetch<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/shipments?${query.toString()}`);
  },

  async getShipment(id: number | string) {
    return apiFetch<any>(`/shipments/${id}`);
  },

  async getShipmentMilestones(id: number | string) {
    return apiFetch<{ items: any[]; total: number }>(`/shipments/${id}/milestones`);
  },

  async getShipmentCustody(id: number | string) {
    return apiFetch<{ items: any[]; total: number }>(`/shipments/${id}/custody`);
  },

  async getShipmentDocuments(id: number | string) {
    return apiFetch<{ items: any[]; total: number }>(`/shipments/${id}/documents`);
  },

  async getShipmentEscrow(id: number | string) {
    return apiFetch<any>(`/shipments/${id}/escrow`);
  },

  // Documents & IPFS
  async uploadDocument(file: File, shipmentId: number, docType: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("shipmentId", shipmentId.toString());
    formData.append("docType", docType.toString());

    return apiFetch<{
      cid: string;
      sha256: string;
      size: number;
      filename: string;
    }>("/documents/upload", {
      method: "POST",
      body: formData,
    });
  },

  async verifyDocument(file: File, shipmentId: number, docIndex: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("shipmentId", shipmentId.toString());
    formData.append("docIndex", docIndex.toString());

    return apiFetch<{
      match: boolean;
      expectedHash: string;
      computedHash: string;
      cid?: string;
    }>("/documents/verify", {
      method: "POST",
      body: formData,
    });
  },

  async downloadDocumentBlob(cid: string): Promise<Blob> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await fetch(`${API_BASE}/documents/${cid}`, { headers });
    if (!resp.ok) {
      throw new ApiException("NOT_FOUND", "Document not found or access forbidden", resp.status);
    }
    return resp.blob();
  },

  // Analytics & Audit
  async getAnalyticsSummary() {
    return apiFetch<any>("/analytics/summary");
  },

  async getAdvancedAnalytics() {
    return apiFetch<{
      dataClassification: string;
      scope: string;
      lifecycleDuration: {
        avgCreatedToTransitHours: number;
        avgTransitToDeliveredHours: number;
        avgDeliveredToCompletedHours: number;
        avgTotalLifecycleHours: number;
      };
      transporterSLA: Array<{
        transporter: string;
        totalShipments: number;
        onTimeShipments: number;
        delayedShipments: number;
        disputedShipments: number;
        onTimeRatePercent: number;
      }>;
      corridorDelays: Array<{
        origin: string;
        destination: string;
        shipmentCount: number;
        delayedCount: number;
        avgDelayHours: number;
      }>;
    }>("/analytics/advanced");
  },

  async getRouteCorridors() {
    return apiFetch<{
      dataClassification: string;
      corridors: Array<{
        shipmentId: number;
        externalRef: string;
        origin: string;
        destination: string;
        destLat: number;
        destLon: number;
        geofenceRadiusM: number;
        status: string;
        waypoints: Array<{
          step: number;
          locationName: string;
          lat: number;
          lon: number;
          inGeofence: boolean;
          timestamp?: number;
        }>;
      }>;
    }>("/analytics/route-corridors");
  },

  async getAuditLogs(params: { page?: number; pageSize?: number; contract?: string; eventType?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.pageSize) query.set("pageSize", params.pageSize.toString());
    if (params.contract) query.set("contract", params.contract);
    if (params.eventType) query.set("eventType", params.eventType);

    return apiFetch<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/audit?${query.toString()}`);
  },

  // Admin Controls
  async triggerSync() {
    return apiFetch<{ status: string; processedEvents: number }>("/admin/sync", {
      method: "POST",
    });
  },

  async triggerReindex() {
    return apiFetch<{ status: string; processedEvents: number }>("/admin/reindex", {
      method: "POST",
    });
  },

  // Disputes
  async getDisputes(params: { shipmentId?: number; skip?: number; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.shipmentId !== undefined) query.set("shipmentId", params.shipmentId.toString());
    if (params.skip !== undefined) query.set("skip", params.skip.toString());
    if (params.limit !== undefined) query.set("limit", params.limit.toString());
    return apiFetch<{ items: any[]; total: number; limit: number; offset: number }>(`/disputes?${query.toString()}`);
  },

  async getDispute(id: number) {
    return apiFetch<any>(`/disputes/${id}`);
  },

  // Oracle Service
  async getOracleStatus() {
    return apiFetch<{
      oracleAddress: string;
      balanceWei: string;
      isActive: boolean;
      activeScenarios: number;
      lastReportBlock?: number;
    }>("/oracle/status");
  },

  async startOracleScenario(payload: { shipmentId: number; scenarioType: string; name?: string }) {
    return apiFetch<any>("/oracle/scenarios", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async stopOracleScenario(scenarioId: string) {
    return apiFetch<any>(`/oracle/scenarios/${scenarioId}/stop`, {
      method: "POST",
    });
  },

  async getOracleEvents(shipmentId?: number) {
    const query = new URLSearchParams();
    if (shipmentId !== undefined) query.set("shipmentId", shipmentId.toString());
    return apiFetch<{ items: any[]; total: number }>(`/oracle/events?${query.toString()}`);
  },

  async checkHealth() {
    return apiFetch<any>("/health");
  },

  // Phase 5: Consensus Simulator
  async getConsensusModels() {
    return apiFetch<any[]>("/consensus/models");
  },

  async simulateConsensus(payload: {
    mechanism: string;
    nodes_count: number;
    faulty_nodes_count: number;
    workload_blocks: number;
    network_latency_ms: number;
    seed: number;
    parameters?: Record<string, any>;
  }) {
    return apiFetch<any>("/consensus/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async compareConsensus(payload: {
    mechanisms: string[];
    nodes_count: number;
    faulty_nodes_count: number;
    workload_blocks: number;
    network_latency_ms?: number;
    seed?: number;
  }) {
    return apiFetch<any>("/consensus/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Phase 5: ML ETA and Delay Prediction
  async getMLModelInfo() {
    return apiFetch<any>("/ml/model-info");
  },

  async predictETA(payload: {
    shipment_id?: number;
    route_distance_km?: number;
    planned_duration_hours?: number;
    cargo_type?: string;
    priority?: string;
    milestones_completed?: number;
    weather_risk?: string;
  }) {
    return apiFetch<any>("/ml/predict-eta", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

