"""GCS upload utility — upload files to Google Cloud Storage bucket."""

import json
import logging
from io import BytesIO

from backend.app.core.config import settings

logger = logging.getLogger("aries.gcs")

_bucket = None


def _get_bucket():
    """Lazy-init GCS bucket client using service account credentials."""
    global _bucket
    if _bucket is not None:
        return _bucket

    if not settings.gca_key:
        raise ValueError("GCA_KEY not configured — needed for GCS access")

    from google.cloud import storage
    from google.oauth2 import service_account

    sa_info = json.loads(settings.gca_key)
    credentials = service_account.Credentials.from_service_account_info(
        sa_info, scopes=["https://www.googleapis.com/auth/devstorage.read_write"],
    )
    client = storage.Client(credentials=credentials, project=settings.gcp_project_id or sa_info.get("project_id"))
    _bucket = client.bucket(settings.gcs_bucket_name)
    return _bucket


def upload_bytes(data: bytes, gcs_path: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to GCS and return the gs:// URI."""
    bucket = _get_bucket()
    blob = bucket.blob(gcs_path)
    blob.upload_from_file(BytesIO(data), content_type=content_type)
    uri = f"gs://{settings.gcs_bucket_name}/{gcs_path}"
    logger.info("Uploaded %s (%d bytes, %s)", uri, len(data), content_type)
    return uri


def generate_signed_url(gcs_path: str, expiration: int = 3600) -> str:
    """Generate a signed URL for reading a GCS object."""
    bucket = _get_bucket()
    blob = bucket.blob(gcs_path)
    return blob.generate_signed_url(version="v4", expiration=expiration)


def delete_from_gcs(gcs_path: str) -> None:
    """Delete a GCS object."""
    bucket = _get_bucket()
    blob = bucket.blob(gcs_path)
    blob.delete()
    logger.info("Deleted gs://%s/%s", settings.gcs_bucket_name, gcs_path)


def download_bytes(gcs_path: str) -> bytes:
    """Download a GCS object and return its bytes."""
    bucket = _get_bucket()
    blob = bucket.blob(gcs_path)
    return blob.download_as_bytes()
