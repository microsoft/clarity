metadata name = 'Clarity AI Visibility - Front Door Log Forwarder'
metadata description = 'Deploy Azure Front Door Log Forwarder to send AFD access logs to Clarity for AI Visibility bot detection.'

// ============================================================================
// Parameters
// ============================================================================

@description('Location for the resources. Must be a region that supports Azure Container Apps.')
@allowed([
  'australiaeast'
  'brazilsouth'
  'canadacentral'
  'centralus'
  'eastasia'
  'eastus'
  'eastus2'
  'francecentral'
  'germanywestcentral'
  'japaneast'
  'koreacentral'
  'northcentralus'
  'northeurope'
  'southcentralus'
  'southeastasia'
  'swedencentral'
  'uksouth'
  'westeurope'
  'westus'
  'westus2'
  'westus3'
])
param location string

@description('Name of the existing Azure Front Door resource to forward logs from.')
@minLength(1)
@maxLength(260)
param frontDoorName string

@description('Your Clarity project ID.')
@minLength(1)
param projectId string

// ============================================================================
// Variables
// ============================================================================

var namePrefix = 'clarityaivisibility'

// ============================================================================
// Existing Resources
// ============================================================================

resource afdResource 'Microsoft.Cdn/profiles@2023-05-01' existing = {
  name: frontDoorName
}

// ============================================================================
// Storage Account
// ============================================================================

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${namePrefix}sa'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource checkpointContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'azure-webjobs-eventhub'
}

// ============================================================================
// Event Hub
// ============================================================================

resource ehNamespace 'Microsoft.EventHub/namespaces@2023-01-01-preview' = {
  name: '${namePrefix}-ehns'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
    capacity: 1
  }
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2023-01-01-preview' = {
  parent: ehNamespace
  name: 'afd-logs'
  properties: {
    partitionCount: 4
    messageRetentionInDays: 1
  }
}

resource consumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2023-01-01-preview' = {
  parent: eventHub
  name: 'afd-forwarder'
}

// ============================================================================
// Container Apps
// ============================================================================

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {}
}

resource functionApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${namePrefix}-func'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        {
          name: 'storage-connection'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'eventhub-connection'
          value: listKeys('${ehNamespace.id}/authorizationRules/RootManageSharedAccessKey', ehNamespace.apiVersion).primaryConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'function'
          image: 'ghcr.io/microsoft/afd-log-forwarder:1.0'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'AzureWebJobsStorage'
              secretRef: 'storage-connection'
            }
            {
              name: 'FUNCTIONS_EXTENSION_VERSION'
              value: '~4'
            }
            {
              name: 'FUNCTIONS_WORKER_RUNTIME'
              value: 'dotnet-isolated'
            }
            {
              name: 'EVENT_HUB_NAME'
              value: eventHub.name
            }
            {
              name: 'EVENT_HUB_CONSUMER_GROUP'
              value: consumerGroup.name
            }
            {
              name: 'EVENT_HUB_CONNECTION'
              secretRef: 'eventhub-connection'
            }
            {
              name: 'TARGET_HTTP_ENDPOINT'
              value: 'https://app-clarity-server-request-ingest-eus2.azurewebsites.net/collect/frontdoor/${projectId}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 4
        rules: [
          {
            name: 'active-window'
            custom: {
              type: 'cron'
              metadata: {
                timezone: 'UTC'
                start: '15 */12 * * *'
                end: '0 */12 * * *'
                desiredReplicas: '4'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Diagnostic Setting (connects AFD to Event Hub)
// ============================================================================

resource afdDiagnosticSetting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'forward-to-eventhub'
  scope: afdResource
  properties: {
    eventHubAuthorizationRuleId: '${ehNamespace.id}/authorizationRules/RootManageSharedAccessKey'
    eventHubName: eventHub.name
    logs: [
      {
        category: 'FrontDoorAccessLog'
        enabled: true
      }
      {
        category: 'FrontDoorHealthProbeLog'
        enabled: false
      }
      {
        category: 'FrontDoorWebApplicationFirewallLog'
        enabled: false
      }
    ]
    metrics: []
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Storage account name')
output storageAccountName string = storage.name

@description('Event Hub Namespace name')
output eventHubNamespaceName string = ehNamespace.name

@description('Event Hub name')
output eventHubName string = eventHub.name

@description('Container App name')
output containerAppName string = functionApp.name

@description('Container Apps Environment name')
output containerAppEnvName string = containerAppEnv.name

@description('Diagnostic setting name created on AFD')
output diagnosticSettingName string = 'forward-to-eventhub'
