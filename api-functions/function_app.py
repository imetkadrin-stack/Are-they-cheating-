import azure.functions as func
import json
import logging
import uuid
from datetime import datetime, timezone

app = func.FunctionApp()


@app.route(route="jobs/run", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def jobs_run(req: func.HttpRequest) -> func.HttpResponse:
    """Trigger a background worker job."""
    logging.info("jobs/run called")

    try:
        body = req.get_json()
    except ValueError:
        body = {}

    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "status": "queued",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "params": body,
    }

    # TODO: enqueue job_id to Azure Storage Queue for the container worker to pick up.
    logging.info("Job queued: %s", job_id)

    return func.HttpResponse(
        json.dumps(job),
        status_code=202,
        mimetype="application/json",
    )


@app.route(route="jobs/status/{job_id}", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def jobs_status(req: func.HttpRequest, job_id: str) -> func.HttpResponse:
    """Return the status of a previously submitted job."""
    logging.info("jobs/status called for %s", job_id)

    # TODO: look up job_id in Azure Table Storage / Cosmos DB.
    result = {
        "job_id": job_id,
        "status": "unknown",
        "message": "Job lookup not yet implemented. Connect to Azure Table Storage.",
    }

    return func.HttpResponse(
        json.dumps(result),
        status_code=200,
        mimetype="application/json",
    )


@app.route(route="logs/latest", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def logs_latest(req: func.HttpRequest) -> func.HttpResponse:
    """Return the most recent job log entries."""
    logging.info("logs/latest called")

    # TODO: read log entries from Azure Blob Storage or Table Storage.
    result = {
        "logs": [],
        "message": "Log retrieval not yet implemented. Connect to Azure Blob Storage.",
    }

    return func.HttpResponse(
        json.dumps(result),
        status_code=200,
        mimetype="application/json",
    )
