"""FastAPI router for CargoChain Consensus Simulator.

Provides endpoints for querying supported models, executing simulated
consensus runs, and generating cross-protocol comparison reports.
Strictly educational; isolated from Ganache blockchain.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from simulator.schemas import (
    SimulationConfig,
    SimulationResult,
    ComparisonRequest,
    ComparisonResult,
)
from simulator.engine import (
    run_simulation,
    compare_consensus,
    get_supported_models,
)

router = APIRouter(prefix="/consensus", tags=["consensus-simulator"])


@router.get("/models", response_model=List[Dict[str, Any]])
async def list_models():
    """Retrieve catalog of supported educational consensus mechanisms."""
    return get_supported_models()


@router.post("/simulate", response_model=SimulationResult)
async def simulate(config: SimulationConfig):
    """Run an isolated educational consensus simulation for a specific protocol."""
    try:
        result = run_simulation(config)
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_SIMULATION_CONFIG", "message": str(ve), "details": {}}},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "SIMULATION_ERROR", "message": f"Simulation execution failed: {str(exc)}", "details": {}}},
        )


@router.post("/compare", response_model=ComparisonResult)
async def compare(req: ComparisonRequest):
    """Run parallel simulations across multiple consensus models on an identical workload."""
    try:
        return compare_consensus(req)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "COMPARISON_ERROR", "message": f"Comparison execution failed: {str(exc)}", "details": {}}},
        )
