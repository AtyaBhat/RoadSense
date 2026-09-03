from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from agent import generate_report

app = FastAPI()


class GenerateReportRequest(BaseModel):
    detections: List[Dict]
    location: str


@app.post("/generate-report")
async def generate_report_route(payload: GenerateReportRequest):
    try:
        report = generate_report(payload.detections, payload.location)
        return report.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))