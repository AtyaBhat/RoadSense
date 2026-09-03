from pydantic import BaseModel
from typing import Literal

class DamageReport(BaseModel):
    damage_type: Literal["alligator_crack","longitudinal_crack","pothole","transverse_crack", "edge_crack", "patching", "rutting", "Not Working", "Working","garbage"]
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float
    location: str
    recommended_action: str
    summary: str
        
