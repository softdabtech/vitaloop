import httpx
from typing import Dict, Any, Optional
from ..config import settings


class AnalysisServiceClient:
    def __init__(self):
        self.base_url = settings.analysis_service_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)

    async def analyze_text(self, text: str) -> Dict[str, Any]:
        """Analyze lab results from text input"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/v1/analyze/text",
                json={"text": text}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Analysis service error: {str(e)}")

    async def analyze_file(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Analyze lab results from file upload"""
        try:
            files = {"file": (filename, file_content)}
            response = await self.client.post(
                f"{self.base_url}/api/v1/analyze",
                files=files
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Analysis service error: {str(e)}")

    async def get_biomarker_reference(self) -> Dict[str, Any]:
        """Get biomarker reference ranges"""
        try:
            response = await self.client.get(
                f"{self.base_url}/api/v1/biomarkers/reference"
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Analysis service error: {str(e)}")

    async def close(self):
        await self.client.aclose()


# Global client instance
analysis_client = AnalysisServiceClient()