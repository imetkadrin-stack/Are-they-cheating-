"""
Azure Container App Worker
--------------------------
Long-running background processor. Reads job requests from an Azure Storage
Queue and processes them, writing results to Azure Blob Storage.

Environment variables expected at runtime:
  AZURE_STORAGE_CONNECTION_STRING  – connection string for the storage account
  JOB_QUEUE_NAME                   – name of the Storage Queue (default: "jobs")
  RESULTS_CONTAINER_NAME           – Blob container for results (default: "results")
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ---------------------------------------------------------------------------
# Optional imports – only available when the Azure SDK is installed.
# The worker falls back to a polling loop so it can start without credentials.
# ---------------------------------------------------------------------------
try:
    from azure.storage.queue import QueueClient
    from azure.storage.blob import BlobServiceClient

    _AZURE_SDK = True
except ImportError:
    _AZURE_SDK = False
    logging.warning("azure-storage-queue / azure-storage-blob not installed – running in dry-run mode")

STORAGE_CONNECTION = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
JOB_QUEUE_NAME = os.environ.get("JOB_QUEUE_NAME", "jobs")
RESULTS_CONTAINER = os.environ.get("RESULTS_CONTAINER_NAME", "results")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))


def process_job(job: dict) -> dict:
    """
    Core job handler.  Replace this stub with your automation / AI logic.
    """
    job_id = job.get("job_id", "unknown")
    logging.info("Processing job %s", job_id)

    # ----- your automation / AI logic goes here -----
    result = {
        "job_id": job_id,
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "output": "Job processed successfully.",
    }
    # -------------------------------------------------

    logging.info("Job %s completed", job_id)
    return result


def save_result(blob_client: "BlobServiceClient", job_id: str, result: dict) -> None:
    container = blob_client.get_container_client(RESULTS_CONTAINER)
    try:
        container.create_container()
    except Exception:
        pass  # already exists
    blob_name = f"{job_id}.json"
    container.upload_blob(name=blob_name, data=json.dumps(result), overwrite=True)
    logging.info("Result saved to blob: %s", blob_name)


def run() -> None:
    logging.info("Worker starting (azure_sdk=%s)", _AZURE_SDK)

    if _AZURE_SDK and STORAGE_CONNECTION:
        queue_client = QueueClient.from_connection_string(STORAGE_CONNECTION, JOB_QUEUE_NAME)
        blob_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION)
    else:
        queue_client = None
        blob_client = None

    while True:
        if queue_client is None:
            logging.info("No storage connection – idle poll (dry-run mode)")
            time.sleep(POLL_INTERVAL)
            continue

        messages = queue_client.receive_messages(max_messages=5, visibility_timeout=60)
        for msg in messages:
            try:
                job = json.loads(msg.content)
                result = process_job(job)
                if blob_client:
                    save_result(blob_client, job.get("job_id", "unknown"), result)
                queue_client.delete_message(msg)
            except Exception as exc:
                logging.exception("Failed to process message: %s", exc)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
