# Azure Deployment Guide

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EricksonAtHome – Azure                       │
│                                                                     │
│  ┌──────────────────────┐     POST /jobs/run     ┌───────────────┐ │
│  │   Web Dashboard      │ ──────────────────────▶ │ Azure         │ │
│  │   (Static Web Apps)  │                        │ Functions     │ │
│  └──────────────────────┘ ◀────────────────────── └───────┬───────┘ │
│         browser                  job status               │         │
│                                                    enqueue to       │
│                                                    Storage Queue    │
│                                                           │         │
│                                              ┌────────────▼──────┐ │
│                                              │ Container App     │ │
│                                              │ Worker            │ │
│                                              └────────┬──────────┘ │
│                                                       │            │
│                                              write results         │
│                                                       │            │
│                                              ┌────────▼──────────┐ │
│                                              │ Blob Storage /    │ │
│                                              │ Table Storage     │ │
│                                              └───────────────────┘ │
│                                                                     │
│  Supporting: Key Vault · Application Insights · Log Analytics       │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Folder | Azure service |
|-----------|--------|---------------|
| API / serverless functions | `api-functions/` | Azure Functions (Consumption, Python 3.11) |
| Background worker | `worker/` | Azure Container Apps |
| Admin dashboard | `web-dashboard/` | Azure Static Web Apps (Next.js) |
| Infrastructure as code | `infra/` | Bicep templates |
| CI/CD | `.github/workflows/azure-full-deploy.yml` | GitHub Actions |

## Quick start

### 1. Create Azure resources with Bicep

```bash
# Log in
az login

# Create a resource group
az group create --name ericksonathome-dev-rg --location westeurope

# Deploy all resources
az deployment group create \
  --resource-group ericksonathome-dev-rg \
  --template-file infra/main.bicep \
  --parameters appName=ericksonathome environment=dev
```

### 2. Create a service principal for GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "github-ericksonathome" \
  --role contributor \
  --scopes /subscriptions/<sub-id>/resourceGroups/ericksonathome-dev-rg \
  --sdk-auth
```

Copy the JSON output into a GitHub secret named **`AZURE_CREDENTIALS`**.

### 3. Set GitHub Secrets

| Secret name | Value |
|-------------|-------|
| `AZURE_CREDENTIALS` | JSON output from step 2 |
| `AZURE_RESOURCE_GROUP` | `ericksonathome-dev-rg` |
| `AZURE_FUNCTION_APP_NAME` | Function App name from Bicep output |
| `AZURE_CONTAINER_REGISTRY` | Container Registry server (e.g. `ericksonathomedevacr.azurecr.io`) |
| `AZURE_CONTAINER_APP_NAME` | Container App name |
| `AZURE_STATIC_WEB_APP_TOKEN` | From Azure Portal → Static Web App → Manage deployment token |
| `NEXT_PUBLIC_API_URL` | Function App URL (e.g. `https://ericksonathome-dev-func.azurewebsites.net/api`) |
| `NEXT_PUBLIC_FUNCTION_KEY` | (Optional) Function App host key for securing endpoints |

### 4. Push to main

After secrets are set, push to `main` and the `azure-full-deploy.yml` workflow will:
1. Deploy the Azure Functions.
2. Build and push the worker Docker image to ACR, then update the Container App.
3. Build and deploy the Next.js dashboard to Static Web Apps.

## Remote dashboard access

1. Open the dashboard URL (output from the Static Web App deployment).
2. The dashboard is the **only** entry point – all API calls require a function key
   (`x-functions-key` header) so that unauthenticated requests are rejected by Azure.
3. Recommended: add [Microsoft Entra ID authentication](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)
   to the Static Web App for full role-based access control.

## Extending the worker

Edit `worker/worker.py` → `process_job()` with your automation or AI logic.
The worker reads job requests from the Azure Storage Queue and writes results
to Blob Storage. No code changes are needed in the Function App or dashboard.

## Monitoring

- **Application Insights**: live metrics, request traces, exceptions.
- **Log Analytics**: query logs with KQL.
- **Azure Portal → Container Apps**: scale, revisions, console access.
- **Azure Portal → Function App**: invocation logs, test runner.
