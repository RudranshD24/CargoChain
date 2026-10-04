# CARGOCHAIN — CONSENSUS SIMULATOR SPECIFICATION & LAB MANUAL

**Module:** Phase 5 — Module A (Educational Consensus Simulator)  
**Package:** `simulator/`  
**API Endpoints:** `/api/v1/consensus/*`  
**Frontend Route:** `/consensus`  
**Isolation Status:** Strictly isolated from Ganache local blockchain; zero on-chain state mutation.  

---

## 1. PURPOSE & ARCHITECTURE

The CargoChain Consensus Simulator is an academic and analytical laboratory component designed to demonstrate, analyze, and benchmark blockchain consensus mechanisms under controlled network conditions, variable workloads, and byzantine fault injection.

Logistics blockchains often require balancing decentralization, transaction throughput, finality latency, and energy expenditure. This simulator provides direct comparative insights across five major consensus protocol families:

1. **Proof of Work (PoW):** Nakamoto-style competitive puzzle mining.
2. **Proof of Stake (PoS):** Economic validator lottery with attestation committees.
3. **Practical Byzantine Fault Tolerance (PBFT):** Classical 3-phase quorum commit with instant finality.
4. **Proof of Authority (PoA):** Pre-authorized signer round-robin for private consortia.
5. **Proof of Elapsed Time (PoET):** Trusted Execution Environment (TEE) lottery using random wait times.

```
+-------------------------------------------------------------------------------+
|                            SIMULATOR ARCHITECTURE                             |
|                                                                               |
|  [ Frontend /consensus ]  <--->  [ FastAPI /api/v1/consensus ]               |
|                                                |                              |
|                                                v                              |
|                                 [ simulator.engine.run_simulation ]           |
|                                                |                              |
|         +-----------------+--------------------+------------------+           |
|         |                 |                    |                  |           |
|         v                 v                    v                  v           |
|     [ PoWModel ]     [ PoSModel ]        [ PBFTModel ]       [ PoAModel ]     |
|                                                                   |           |
|                                                                   v           |
|                                                              [ PoETModel ]    |
|                                                                               |
|  * Strictly in-memory discrete event loop. NO WEB3 CONTRACT ACCESS.           |
+-------------------------------------------------------------------------------+
```

---

## 2. DETAILED PROTOCOL MECHANICS & ASSUMPTIONS

### 2.1 Proof of Work (PoW)
* **Mechanics:** Nodes compete to find a nonce $n$ such that $\text{SHA256}(\text{prev\_hash} \parallel \text{block\_num} \parallel n \parallel \text{node\_id})$ starts with $D$ leading zeros.
* **Solving Distribution:** Modeled using an exponential distribution scaled by node hashrate ($1200\text{ H/s}$ honest, $600\text{ H/s}$ faulty).
* **Fault Behavior:** Malicious nodes submitting invalid proof-of-work or altered block contents are rejected by the honest majority.
* **Finality:** Probabilistic. Requires multiple confirmations ($k=6$ blocks) to achieve economic finality.
* **Energy Estimate:** Simulated computational ASIC wattage ($\sim 1.2\text{ kW}$ per node).

### 2.2 Proof of Stake (PoS)
* **Mechanics:** Slot leaders are selected via a pseudo-random lottery proportional to staked tokens:
  $$P(\text{leader} = i) = \frac{\text{stake}_i}{\sum_{j} \text{stake}_j}$$
* **Validation & Quorum:** Leader proposes block; an attestation committee votes. Requires $\ge 2/3$ active stake participation.
* **Fault Behavior:** If a slot leader is byzantine/offline, the slot is missed or the invalid proposal is rejected by the committee.
* **Finality:** Deterministic at epoch checkpoints (Casper FFG style).
* **Energy Estimate:** Server validation wattage ($\sim 50\text{ W}$ per node).

### 2.3 Practical Byzantine Fault Tolerance (PBFT)
* **Mechanics:** Classical 3-phase commit protocol across views $v$:
  1. **Pre-Prepare:** Primary broadcasts $\langle\text{PRE-PREPARE}, v, n, d\rangle$ to all $N-1$ replicas.
  2. **Prepare:** Each replica multicasts $\langle\text{PREPARE}, v, n, d, i\rangle$ to all peers ($N \times (N-1)$ messages). Nodes wait for $2f + 1$ matching prepares.
  3. **Commit:** Replicas multicast $\langle\text{COMMIT}, v, n, d, i\rangle$ to all peers ($N \times (N-1)$ messages). Nodes wait for $2f + 1$ commits.
* **Quorum & Fault Tolerance:** Tolerates up to:
  $$f \le \left\lfloor\frac{N - 1}{3}\right\rfloor$$
  If $f > f_{\max}$, quorum is unattainable and view-change fails.
* **Finality:** Deterministic and instant. Once committed, forks are mathematically impossible.
* **Message Overhead:** Total messages per block: $(N-1) + 2N(N-1) = O(N^2)$.

### 2.4 Proof of Authority (PoA)
* **Mechanics:** Consortium model (Clique/Aura). A configured set of $M$ pre-authorized authority nodes rotate block creation duties in round-robin sequence:
  $$\text{Signer Index} = (\text{block\_num} - 1) \pmod M$$
* **Validation:** Replicas verify that the block header is signed by the designated authority key.
* **Fault Behavior:** If an authority is compromised or silent, the network skips to the next assigned signer.
* **Finality:** Deterministic instant upon threshold verification.
* **Energy Estimate:** Minimal digital signature verification ($\sim 30\text{ W}$ per node).

### 2.5 Proof of Elapsed Time (PoET)
* **Mechanics:** Developed for permissioned consortium chains (Hyperledger Sawtooth). Relies on Trusted Execution Environments (TEE / Intel SGX).
* **Wait Timer:** Each validator requests a random sleep duration from its secure hardware enclave:
  $$W = -\frac{1}{\lambda} \ln(U), \quad U \sim \text{Uniform}(0, 1)$$
  The validator whose timer expires first generates the block accompanied by an enclave-signed attestation quote.
* **Fault Behavior:** If an adversary attempts to bypass SGX or fake an expired timer, honest peers reject the invalid attestation.
* **Finality:** Lotteried / Enclave certified.
* **Energy Estimate:** Low-power idle sleep ($\sim 35\text{ W}$ per node).

---

## 3. METRIC DEFINITIONS

| Metric | Unit | Mathematical Definition / Formulation |
| :--- | :---: | :--- |
| **Average Block Latency** | $\text{ms}$ | $\frac{1}{B} \sum_{b=1}^B (T_{\text{commit}, b} - T_{\text{start}, b})$ |
| **Throughput** | $\text{bps}$ | $\frac{B_{\text{accepted}}}{T_{\text{total\_elapsed\_sec}}}$ |
| **Messages Exchanged** | count | Total network multicasts across all rounds ($N-1$ for PoW/PoA, $O(N^2)$ for PBFT) |
| **Simulated Energy** | Joules ($\text{J}$) | $\sum_b \left( \text{Duration}_b \times N \times \text{Wattage}_{\text{proto}} \right)$ |
| **Fault Tolerance Threshold** | string | Maximum fraction of faulty nodes before liveness/safety failure |

---

## 4. REST API SPECIFICATION

### `GET /api/v1/consensus/models`
Returns JSON array of supported protocols with descriptive metadata, parameter constraints, and default values.

### `POST /api/v1/consensus/simulate`
Executes a single simulation.
**Request Body:**
```json
{
  "mechanism": "pbft",
  "nodes_count": 7,
  "faulty_nodes_count": 1,
  "workload_blocks": 4,
  "network_latency_ms": 40.0,
  "seed": 42,
  "parameters": {}
}
```

### `POST /api/v1/consensus/compare`
Runs an identical workload across multiple protocols and outputs comparative analytical summaries.
