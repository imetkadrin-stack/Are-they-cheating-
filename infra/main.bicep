// infra/main.bicep
// ─────────────────────────────────────────────────────────────────────────────
// Azure resource definitions for EricksonAtHome
//
// Provisions:
//   - Storage Account (queues + blobs for job data)
//   - Key Vault (secrets, including storage connection string)
//   - Application Insights + Log Analytics workspace
//   - Azure Function App (Consumption plan, Python 3.11)
//   - Azure Container Registry (stable GA API)
//   - Container App Environment + Container App (worker)
//   - Static Web App (dashboard)
//
// Connection strings are stored in Key Vault; app settings reference them
// via Key Vault references rather than embedding plain-text secrets.
//
// Deploy with:
//   az deployment group create \
//     --resource-group <rg> \
//     --template-file infra/main.bicep \
//     --parameters appName=<name> location=<region>
// ─────────────────────────────────────────────────────────────────────────────

@description('Base name used for all resources.')
param appName string = 'ericksonathome'

@description('Azure region.')
param location string = resourceGroup().location

@description('Environment tag (dev / staging / prod).')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

var tags = {
  app: appName
  environment: environment
}

// ── Storage Account ─────────────────────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(appName, '-', '')}${environment}sa'
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource jobQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  name: '${storageAccount.name}/default/jobs'
}

resource resultsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/results'
  properties: {
    publicAccess: 'None'
  }
}

// ── Key Vault ────────────────────────────────────────────────────────────────
// Provisioned early so that the Function App and Container App can reference
// its secrets via Key Vault references rather than embedding credentials.
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${appName}-${environment}-kv'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enableRbacAuthorization: true
  }
}

// Store the storage connection string as a Key Vault secret.
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'

resource storageConnSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: storageConnectionString
  }
}

// ── Log Analytics + Application Insights ────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${appName}-${environment}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-${environment}-ai'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Function App (Consumption) ───────────────────────────────────────────────
resource functionPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-${environment}-func-plan'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true   // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${appName}-${environment}-func'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    siteConfig: {
      pythonVersion: '3.11'
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        // Reference storage connection string from Key Vault
        { name: 'AzureWebJobsStorage', value: '@Microsoft.KeyVault(SecretUri=${storageConnSecret.properties.secretUri})' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: '@Microsoft.KeyVault(SecretUri=${storageConnSecret.properties.secretUri})' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: appInsights.properties.InstrumentationKey }
        { name: 'JOB_QUEUE_NAME', value: 'jobs' }
        { name: 'RESULTS_CONTAINER_NAME', value: 'results' }
      ]
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
    keyVaultReferenceIdentity: 'SystemAssigned'
  }
}

// Grant the Function App "Key Vault Secrets User" so it can read Key Vault references.
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
resource funcKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Azure Container Registry (stable GA API) ─────────────────────────────────
resource registry 'Microsoft.ContainerRegistry/registries@2023-01-01' = {
  name: '${replace(appName, '-', '')}${environment}acr'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// ── Container App Environment ────────────────────────────────────────────────
resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${appName}-${environment}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Container App (worker) ───────────────────────────────────────────────────
// The connection string is stored as a Container App secret (fetched from Key Vault
// at deploy time) so it is not embedded as a plain-text environment variable.
resource workerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${appName}-${environment}-worker'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'storage-connection-string'
          keyVaultUrl: storageConnSecret.properties.secretUri
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: '${registry.properties.loginServer}/ericksonathome-worker:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection-string' }
            { name: 'JOB_QUEUE_NAME', value: 'jobs' }
            { name: 'RESULTS_CONTAINER_NAME', value: 'results' }
            { name: 'POLL_INTERVAL_SECONDS', value: '10' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

// Grant the Container App "Key Vault Secrets User" to read its secret.
resource workerKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, workerApp.id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: workerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Static Web App (dashboard) ────────────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${appName}-${environment}-dashboard'
  location: location
  tags: tags
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    repositoryUrl: 'https://github.com/imetkadrin-stack/ericksonathome'
    branch: 'main'
    buildProperties: {
      appLocation: 'web-dashboard'
      outputLocation: 'out'
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output dashboardUrl string = staticWebApp.properties.defaultHostname
output containerRegistryServer string = registry.properties.loginServer
output keyVaultUri string = keyVault.properties.vaultUri
