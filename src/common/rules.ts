/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/*
Rules explained:
ruleSet = [rule,rule,...]

rule = {
  name: The Rule Name
  condition: ruleCondition
  resultTrue: result 
  resultFalse: result
}

If condition resolves to True, then resultTrue is fired. If Condition resolves to false, then resultFalse is fired.
a rule must have a name, a label and a condition. AlertRules, EnablementRules and QualityRules must have  a resultTrue and/or a resultFalse

ruleCondition = {
  metadataType: The Metadata Type to query
  operator: One of: ['always', 'never', 'exists', 'notexists', 'null', 'gt', 'gte', 'lt', 'lte', 'eq','between']
  operand: value that operator works on.
  expiration: dateTime
  processAlways: boolean (only within a conditionOr OR a conditionAnd)
  conditionPerItem: boolean (only within a conditionAnd)
  conditionOr: ruleCondition
  conditionAnd: ruleCondition
}

A ruleCondition must have an operator
If operator is anything other than 'always' or 'never' then ruleCondition must have an operand and a metadataType
If operator is 'between', then operand must be a 2 element array noting the bounds of the between (non inclusive)
ruleCondition cannot have both a conditionAnd AND a conditionOR, but both are optional

OR:
If conditionOr exists, then the result is an OR of the result of the main condition and the conditionOr condition
If processAlways is true within the conditionOr, then conditionOr will be evaluated even if the main condition is already true

AND:
If conditionAnd exists then the resuls is an AND of the result of the main condition and the conditionAnd condition
If process Always is true within the conditionAnd, then conditionAnd will be evaluated even if the main condition is already false.
If conditionPerItem is true within the conditionAnd, then the ultimate result is based on the union of items which pass each side of the condition
  e.g.:
    condition: {
      metadataType: 'ApexTrigger.objects.*',
      operator: 'gte',
      operand: 1,
      conditionAnd: {
        metadataType: 'Flow.objects.*',
        operator: 'gte',
        operand: 1,
      },
    },
    the above condition will resolve to true if there is any object with an apex trigger and if there is any object with a process builder trigger

    If the condition looks like:
    condition: {
      metadataType: 'ApexTrigger.objects.*',
      operator: 'gte',
      operand: 1,
      conditionAnd: {
        metadataType: 'Flow.objects.*',
        operator: 'gte',
        operand: 1,
        conditionPerItem: true
      },
    },
    the condition will resolve to true if any object has both an apex trigger and a process builder trigger.
   
result = {
  label: Friendly output to display when rule is triggered 
  message: Text to display
  url: link to content
  showDetails: boolean
}
A result must have a message and a label
if showDetails is true, then the individual components which pass the condition are included in the result 
e.g the first will output just the message. The second will output the message as well as each individual class with and API version that meets the criteria
{
    name: 'Metadata API Version',
    condition: {
      metadataType: 'apiVersions.mdapi',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Metadata API Version',
      message: `You appear to be using a version of Metadata API less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
    },
  },
  {
    name: 'Apex API Version',
    condition: {
      metadataType: 'apiVersions.ApexClass.*',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Apex API Version',
      message: `You appear to be using an API version less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
      showDetails: true
    }
  },
*/


const minAPI = 43;

const rulesVersion = '20200317';

const mdTypes = [{
  name: 'Permission Sets',
  metadataType: 'PermissionSet'
},
{
  name: 'Custom Profiles',
  metadataType: 'Profile'
},
{
  name: 'Custom Metadata',
  metadataType: 'CustomMetadata'
},
{
  name: 'Feature Parameters (Boolean)',
  metadataType: 'FeatureParameterBoolean'
},
{
  name: 'Feature Parameters (Date)',
  metadataType: 'FeatureParameterDate'
},
{
  name: 'Feature Parameters (Integer)',
  metadataType: 'FeatureParameterInteger'
},
{
  name: 'Custom Settings',
  metadataType: 'CustomSetting__c'
},
{
  name: 'Custom Labels',
  metadataType: 'CustomLabel'
},
{
  name: 'Tabs',
  metadataType: 'CustomTab'
},
{
  name: 'Flows',
  metadataType: 'Flow'
},
{
  name: 'Apex Classes',
  metadataType: 'ApexClass'
},
{
  name: 'Apex Triggers',
  metadataType: 'ApexTrigger'
},
{
  name: 'Custom Reports',
  metadataType: 'Report'
},
{
  name: 'Custom Report Types',
  metadataType: 'ReportType'
},
{
  name: 'Custom Apps',
  metadataType: 'CustomApplication'
},
{
  name: 'Connected Apps',
  metadataType: 'ConnectedApp'
},
{
  name: 'In-App Prompts',
  metadataType: 'Prompt'
},
{
  name: 'Static Resources',
  metadataType: 'StaticResource'
},
{
  name: 'Sharing Rules',
  metadataType: 'SharingRules'
},
{
  name: 'Validation Rules',
  metadataType: 'ValidationRule'
},
{
  name: 'Custom Objects',
  metadataType: 'CustomObject'
},
{
  name: 'Custom Fields',
  metadataType: 'CustomField'
},
{
  name: 'Platform Events',
  metadataType: 'PlatformEventChannel'
},
{
  name: 'Territory Management',
  metadataType: 'Territory'
},
{
  name: 'Territory Management 2.0',
  metadataType: 'Territory2'
},
{
  name: 'Visualforce Pages',
  metadataType: 'ApexPage'
},
{
  name: 'Aura Web Components',
  metadataType: 'AuraDefinitionBundle'
},
{
  name: 'Lightning Web Components',
  metadataType: 'LightningComponentBundle'
},
{
  name: 'Einstein Analytics Applications',
  metadataType: 'WaveApplication'
},
{
  name: 'Einstein Analytics Dashboards',
  metadataType: 'WaveDashboard'
},
{
  name: 'Einstein Analytics Dataflows',
  metadataType: 'WaveDataflow'
},
{
  name: 'Einstein Analytics Datasets',
  metadataType: 'WaveDataset'
},
{
  name: 'Einstein Analytics Lenses',
  metadataType: 'WaveLens'
},
{
  name: 'Einstein Analytics Template Bundles',
  metadataType: 'WaveTemplateBundle'
},
{
  name: 'Einstein Analytics Dashboards',
  metadataType: 'WaveDashboard'
},

{
  name: 'Record Types',
  metadataType: 'RecordType'
}
];

const enablementRules = [{
    name: 'ISV Technical Success Center',
    condition: {
        metadataType: 'any',
        operator: 'always'
    },
    resultTrue: {
      label: 'Visit the ISV Technical Success Center',
      message: 'For more resources to help build a successful app, visit the ISV Technical Success Center on the Partner Community',
      url: 'http://p.force.com/TECenter'
    }
  },
  {
    name: 'Flows',
    condition: {
      metadataType: 'Flow',
      operator: 'notexists',
    },
    resultTrue: {
      label: 'Take Advantage of Flows',
      message: 'Flows are a powerful tool to enable forms based workflows and process automation to your users. See this webinar for more information.',
      url: 'https://partners.salesforce.com/0693A000007S2Dq'
    },
  },
  {
    name: 'Flow Templates',
    condition: {
      metadataType: 'Flow.FlowTemplate',
      operator: 'notexists',
      conditionAnd: {
        processAlways: false,
        metadataType: 'Flow',
        operator: 'exists'
      }
    },
    resultTrue: {
      label: 'Include your Flows as Templates',
      message: 'When packaging a Flow, consider using a Flow Template to allow your subscribers to modify the flow to suit their needs. For more information about Flow Templates see this blog post.',
      url: 'https://medium.com/inside-the-salesforce-ecosystem/pre-built-business-processes-how-isvs-use-flow-templates-ddc9910ff93a'
    },
  },
  {
    name: 'Batch Apex',
    condition: {
      metadataType: 'ApexClass.BatchApex',
      operator: 'exists'
    },
    resultTrue: {
      label: 'Follow best practices for Batch Apex',
      message: 'For more information on Batch Apex Design patterns and how best to package Batch Apex, see this webinar.',
      url: 'https://partners.salesforce.com/0693A000006aF9G',
    },
  },
  {
    name: 'In App Prompts',
    condition: {
      metadataType: 'Prompt',
      operator: 'notexists'
    },
    resultTrue: {
      label: 'Take Advantage of In-App Prompts',
      message: 'For more information about how to use In-App Prompts to keep your users informed, see this blog.',
      url: 'https://medium.com/inside-the-salesforce-ecosystem/in-app-prompts-for-isvs-e9b013969016'
    },
  },
  {
    name: 'Platform Cache',
    condition: {
      metadataType: 'PlatformCachePartition',
      operator: 'notexists'
    },
    resultTrue: {
      label: 'Take Advantage of Platform Cache',
      message: 'Use Platform Cache to improve the performance of your application.',
      url: 'https://medium.com/inside-the-salesforce-ecosystem/leverage-platform-cache-to-reduce-transaction-time-and-increase-customer-satisfaction-cd3616c9c6ee'
    }
  },
  {
    name: 'Custom Fields on Activity',
    condition: {
      metadataType: 'CustomField.objects.Activity',
      operator: 'gte',
      operand: 1
    },
    resultTrue: {
      label: 'Be aware of limits on Custom Fields on Activity',
      message: 'Please be aware that there is a hard limit of 100 fields on the Activity object including all managed and unmanaged fields. Your package will not install if this raises the number of fields on the Activity object past this threshold in your subscriber\'s org.'
    }
  },
  {
    name: 'Platform Events',
    condition: {
      metadataType: 'PlatformEventChannel',
      operator: 'exists'
    },
    resultTrue: {
      label: 'Be aware of Platform Events Best Practices',
      message: 'For more information on Platform Events and how to use them within your application, see this webinar.',
      url: 'https://partners.salesforce.com/partnerEvent?id=a033A00000GF5BPQA1'
    }
  },
  {
    name: 'Change Data Capture',
    condition: {
      metadataType: 'PlatformEventChannelMember',
      operator: 'exists'
    },
    resultTrue: {
      label: 'Be aware of Change Data Capture Best Practices',
      message: 'For more information on Change Data Capture and how to use it in your application, please see this webinar.',
      url: 'https://developer.salesforce.com/events/webinars/change-data-capture'
    }
  },
  {
    name: 'Aura Components',
    condition: {
      metadataType: 'AuraDefinitionBundle',
      operator: 'exists',
      conditionAnd: {
        metadataType: 'LightningComponentBundle',
        operator: 'notexists'
      },
    },
    resultTrue: {
      label: 'Learn about migrating from Aura Web Components to Lightning Web Components',
      message: 'Lightning Web Components are the new Salesforce standard for Lightning Components featuring easier devlopment, better performance and standards compliance. For a decision matrix on whether you should be considering migrating to LWC see this blog.',
      url: 'https://medium.com/inside-the-salesforce-ecosystem/lightning-web-components-an-isv-partner-digest-59d9191f3248'
    }
  },
  {
    name: 'Local LWC Development',
    condition: {
      metadataType: 'LightningComponentBundle',
      operator: 'exists'
    },
    resultTrue: {
      label: 'Lightning Web Component Local Development',
      message: 'Lightning Component Development can be significantly improved using local development. See this webinar for more information',
      url: 'https://developer.salesforce.com/event/salesforce-lightning-base-components-open-source'
    }
  },
  {
    name: 'Lightning Web Components',
    condition: {
      metadataType: 'LightningComponentBundle',
      operator: 'notexists'
    },
    resultTrue: {
      label: 'Take advantage of Lightning Web Components',
      message: 'Find more information about how to leverage the power of LWC and for best practices, see this webinar.',
      url: 'https://partners.salesforce.com/0693A000007Kd7oQAC'
    }
  },
  {
    name: 'Einstein Analytics Templates',
    condition: {
      metadataType: 'WaveTemplateBundle',
      operator: 'exists'
    },
    resultTrue: {
      label: 'Learn about Einstein Analytics Template Bundles',
      message: 'For more information on Creating & Distributing Analytics Apps using Templates see this webinar.',
      url: 'https://partners.salesforce.com/partnerEvent?id=a033A00000FYOQOQA5'
    }
  },
  {
    name: 'Feature Management',
    condition: {
      metadataType: 'FeatureParameterBoolean',
      operator: 'exists',
      conditionOr: {
        metadataType: 'FeatureParameterDate',
        operator: 'exists',
        conditionOr: {
          metadataType: 'FeatureParameterInteger',
          operator: 'exists'
        }
      }
    },
    resultTrue: {
      label: 'Learn more about using Feature Management',
      message: 'See this webinar for more information on using Feature Management within your package.',
      url: 'http://salesforce.vidyard.com/watch/pXTQPKtMkF8vmZDJoBidx9'
    }
  }

];

const qualityRules = [{
    name: 'Metadata API Version',
    condition: {
      metadataType: 'apiVersions.mdapi',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Metadata API Version',
      message: `You appear to be using a version of Metadata API less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
    },
  },
  {
    name: 'Apex API Version',
    condition: {
      metadataType: 'apiVersions.ApexClass.*',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Apex API Version',
      message: `You appear to be using an API version less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
      showDetails: true
    }
  },
  {
    name: 'Trigger API Version',
    condition: {
      metadataType: 'apiVersions.ApexTrigger.*',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Trigger API Version',
      message: `You appear to be using an API version less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
      showDetails: true
    }
  },
  {
    name: 'Aura Component API Version',
    condition: {
      metadataType: 'apiVersions.AuraDefinitionBundle.*',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Aura Component API Version',
      message: `You appear to be using an API version less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
      showDetails: true
    }
  },
  {
    name: 'LWC API Version',
    condition: {
      metadataType: 'apiVersions.LightningComponentBundle.*',
      operator: 'between',
      operand: [20,'minAPI'],
    },
    resultTrue: {
      label: 'Using old Lightning Web Component API Version',
      message: `You appear to be using an API version less than the minimum specified. Use the --minapi flag to adjust the minimum API version.`,
      showDetails: true
    }
  },
  {
    name: 'Custom Object Description',
    condition: {
      metadataType: 'componentProperties.CustomObject',
      operator: 'exists',
      conditionAnd: {
        metadataType: 'componentProperties.CustomObject.*.descriptionExists',
        operator: 'notexists'
      }
    },
    resultTrue: {
      label: 'Custom Objects should have a description',
      message: `It is a best practice that Custom Objects have a description.`,
      showDetails: true
    }
  },
  {
    name: 'Custom Field Description',
    condition: {
      metadataType: 'componentProperties.CustomField',
      operator: 'exists',
      conditionAnd: {
        metadataType: 'componentProperties.CustomField.*.descriptionExists',
        operator: 'notexists'
      }
    },
    resultTrue: {
      label: 'Custom Fields should have a description',
      message: `It is a best practice that Custom Fields have a description.`,
      showDetails: true
    }
  },
  {
    name: 'Triggers per Object',
    condition: {
      metadataType: 'ApexTrigger.objects.*',
      operator: 'gt',
      operand: 1
    },
    resultTrue: {
      label: 'Multiple Triggers per Object',
      message: 'It is a best practice to have 1 trigger per object. Please check triggers on the objects below to see if you can use triggers and trigger handlers to reduce the number of triggers per object.',
      showDetails: true
    }
  },
  {
    name: 'Process Builders per Object',
    condition: {
      metadataType: 'Flow.objects.*',
      operator: 'gt',
      operand: 1
    },
    resultTrue: {
      label: 'Multiple Process Builders per Object',
      message: 'It is a best best practice to have 1 record-change process per object. Please check Process Builders on the objects below to see if you can combine all processes into one.',
      showDetails: true
    }
  },
  {
    name: 'Change Processes per Object',
    condition: {
      metadataType: 'ApexTrigger.objects.*',
      operator: 'gte',
      operand: 1,
      conditionAnd: {
        metadataType: 'Flow.objects.*',
        operator: 'gte',
        operand: 1,
        conditionPerItem: true
      },
    },

    resultTrue: {
      label: 'Multiple Change Processes per Object',
      message: 'It is a best best practice to have 1 record-change process per object. Avoid using both Triggers and Process Builders on the same object.',
      showDetails: true
    }
  },
];

const alertRules = [{
    name: 'Alerts Signup',
    condition: {
      metadataType: 'any',
      operator: 'always'
    },
    resultTrue: {
      label: 'Stay on Top of Alerts',
      message: 'Sign up here to be notified of all Partner Alerts',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000FtFWqQAN'
    }
  },
  {
    name: '@AuraEnabled Methods',
    condition: {
      metadataType: 'ApexClass.AuraEnabledCalls',
      operator: 'exists',
      expiration: '2020-10-01T00:00:00.000Z'
    },
    resultTrue: {
      label: '@AuraEnabled Methods',
      message: 'New Permissions Required to Access Apex Classes containing @AuraEnabled methods.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000Fvo12QAB',  
      showDetails: true
    }    
  },
  {
    name: 'Aura UI Namespace',
    condition: {
      metadataType: 'componentProperties.AuraDefinitionBundle.*.namespaceReferences.ui',
      operator: 'exists',
      expiration: '2020-10-01T00:00:00.000Z'
    },
    resultTrue: {
      label: 'Aura Components in UI Namespace Retiring in Summer \'21',
      message: 'In Summer \'21, Lightning Base Components in the ui namespace will be retired.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GXNKsQAP',
      showDetails: true
    }
  },
  {
    name: 'Custom Metadata Permissions',
    condition: {
      metadataType: 'CustomMetadata',
      operator: 'exists',
      expiration: '2020-10-01T00:00:00.000Z'
    },
    resultTrue: {
      label: 'Custom Metadata',
      message: 'New Permissions Required for Direct Read Access to Custom Metadata Types.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GimUSQAZ',
    }
  },
  {
    name: 'Custom Settings Direct Read',
    condition: {
      metadataType: 'CustomSetting__c',
      operator: 'exists',
      expiration: '2020-10-01T00:00:00.000Z'
    },
    resultTrue: {
      label: 'Custom Settings',
      message: 'New Permissions Required for Direct Read Access to Custom Settings.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GimQ6QAJ',
    }
  },
  {
    name: 'Territory 1 EOL',
    condition: {
      metadataType: 'Territory',
      operator: 'exists',
      expiration: '2020-10-01T00:00:00.000Z'
    },
    resultTrue: {
      label: 'Territory Management 1.0',
      message: 'Territory Management will be End of Life starting in Winter \'20. Please migrate to Territory Management 2.0.',
      url: 'https://help.salesforce.com/articleView?id=000318370&type=1&mode=1',
    }
 },
 {
    name: 'RecordType Access',
    condition: {
      metadataType: 'RecordType',
      operator: 'exists',
      expiration: '2020-05-01T00:00:00.000Z'
    },
    resultTrue: {
      label: 'Change to Record Type Access',
      message: 'There have been changes to Record Type access in permission sets within Managed Packages for Winter \'20 in response to a Known Issue. Subscribers may need to upgrade your package to see this fix.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GSdBoQAL',
    }
 },
 {
    name: 'Lightning Platform API Versions 7-20',
    condition: {
      metadataType: 'apiVersions.*.*',
      operator: 'between',
      operand: [7,20],
    },
    resultTrue: {
      label: 'Lightning Platform API Versions 7-20 Retiring in Summer ‘21',
      message: 'With the Summer ‘21 release, SOAP, REST, and Bulk API legacy versions 7 through 20 will be retired and no longer supported by Salesforce. When these legacy versions are retired, applications consuming impacted versions of the APIs will experience a disruption as the requests will fail and result in an error indicating that the requested endpoint has been deactivated.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GXNIDQA5'
    }
 },
 {
    name: 'External Sharing Model set to Private for all entities',
    condition: {
      expiration: '2020-10-9T00:00:00.000Z',
      metadataType: 'any',
      operator: 'always'
    },
    resultTrue: {
      label: 'All new orgs will sign up with External Sharing Model set to Private for all entities in Spring’20',
      message: 'The external sharing model is automatically enabled in Salesforce orgs created in Spring ’20 or after. Also, external access levels are initially set to Private for all objects in these orgs. These changes don’t affect existing customers.',
      url: 'https://partners.salesforce.com/partnerAlert?id=a033A00000GNnm3QAD'
    }
 },
];

const editionWarningRules = [{
  name: 'Essentials',
  blockingItems: [{
      label: 'Record Types',
      condition: {
        metadataType: 'RecordType',
        operator: 'exists'  
      }
    },
    {
      label: 'Person Accounts',
      condition: {
        metadataType: 'dependencies.features.PersonAccount',
        operator: 'exists'
      }
    },
    {
      label: 'Classes with Invocable Apex',
      condition: {
        metadataType: 'ApexClass.InvocableApex',
        operator: 'exists'
      }
    },
    {
      label: 'Platform Events',
      condition: {
        metadataType: 'PlatformEventChannel',
        operator: 'exists'
      }
    },
    {
      label: 'Custom Profiles',
      condition: {
        metadataType: 'Profile',
        operator: 'exists'  
      }
    },
    {
      label: 'Sharing Rules',
      condition: {
        metadataType: 'SharingRules',
        operator: 'exists'  
      }
    },

  ]
},
{
  name: 'Group Edition',
  blockingItems: [{
      label: 'Record Types',
      condition: {
        metadataType: 'RecordType',
        operator: 'exists'  
      }
    },
    {
      label: 'Person Accounts',
      condition: {
        metadataType: 'PersonAccount__c',
        operator: 'exists'
      }
    },
    {
      label: 'Custom Report Types',
      condition: {
        metadataType: 'ReportType',
        operator: 'exists'  
      }
    },
    {
      label: 'Classes with SOAP Apex Web Services',
      condition: {
        metadataType: 'ApexClass.ApexSoap',
        operator: 'exists'  
      }
    },
    {
      label: 'Custom Profiles',
      condition: {
        metadataType: 'Profile',
        operator: 'exists'  
      }
    },
    {
      label: 'Sharing Rules',
      condition: {
        metadataType: 'SharingRules',
        operator: 'exists'  
      }
    },
  ]
},
{
  name: 'Professional Edition',
  blockingItems: [{
    label: 'Classes with SOAP Apex Web Services',
    condition: {
      metadataType: 'ApexClass.ApexSoap',
      operator: 'exists'  
    }
    },
    {
      label: 'Custom Report Types',
      condition: {
        metadataType: 'ReportType',
        operator: 'gt',
        operand: 50 
      }
    },
  ]
},
{
  name: 'Enterprise Edition',
  blockingItems: [{
    label: 'Custom Report Types',
    condition: {
      metadataType: 'ReportType',
      operator: 'gt',
      operand: 100 
    }
  },
 ]
},
];

const techAdoptionRules = [
  {
    categoryName: 'DataStore',
    categoryLabel: 'Which platform technology does your application use as its primary data store?',
    items: [
      {
        metadataType: 'CustomObject',
        label: 'Custom Objects'
      }
    ]
  },
  {
    categoryName: 'DataProcess',
    categoryLabel: 'Which other platform technologies does your application use to process and store data?',
    items: [
      {
        metadataType: 'CustomObject',
        label: 'Custom Objects'
      },
      {
        metadataType: 'CustomObject.BigObject',
        label: 'Big Objects'
      },
      {
        metadataType: 'PlatformEvent__c',
        label: 'Platform Events'     
      },
      {
        metadataType: 'PlatformEventChannel',
        label: 'Change Data Capture'     
      }
    ]
  },
  {
    categoryName: 'UX',
    categoryLabel: 'Which user interface technologies does your application use to deliver the end-user experience?',
    items: [
      {
        metadataType: 'LightningComponentBundle',
        label: 'Lightning Web Components',
      },
      {
        metadataType: 'AuraDefinitionBundle',
        label: 'Aura Lightning Components',
      },
      {
        metadataType: 'ApexPage',
        label: 'Visualforce Pages',
      }
    ]
  },
  {
    categoryName: 'ApplicationProcessing',
    categoryLabel: 'Which technologies does your app use for application processing and security?',
    items: [
      {
        metadataType: 'Flow.Workflow',
        label: 'Process Builder',
      },
      {
        metadataType: 'Flow.Flow',
        label: 'Screen Flows',
      },
      {
        metadataType: 'Flow.AutoLaunchedFlow',
        label: 'Autolaunched Flows',
      },
      {
        metadataType: 'ApexClass',
        label: 'Apex',
      },
      {
        metadataType: 'PlatformCachePartition',
        label: 'Platform Cache',
      }
    ]
  }
];

const dependencyRules = [{
  name: 'CommunityCloud',
  label: 'Community Cloud',
  condition: {
    metadataType: 'LightningComponentBundle.targets.lightningCommunity__Page',
    operator: 'exists',
    conditionOr: {
      metadataType: 'LightningComponentBundle.targets.lightningCommunity__Default',
      operator: 'exists',
      conditionOr: {
        metadataType: 'ExperienceBundle',
        operator: 'exists',
        conditionOr: {
          metadataType: 'CommunityTemplateDefinition',
          operator: 'exists',
          conditionOr: {
            metadataType: 'componentProperties.AuraDefinitionBundle.*.interfaces.forceCommunity:availableForAllPageTypes',
            operator: 'exists'
          }
        }
      }
    }
  }
},
{
    name: 'PersonAccount',
    label: 'Person Accounts',
    condition: {
      metadataType: 'dependencies.features.PersonAccount',
      operator: 'exists'
    }
},
{
  name: 'EinsteinAnalytics',
  label: 'Einstein Analytics',
  condition: {
    metadataType: 'WaveApplication',
    operator: 'exists',
    conditionOr: {
      metadataType: 'WaveDataflow',
      operator: 'exists',
      conditionOr: {
        metadataType: 'WaveDashboard',
        operator: 'exists',
        conditionOr: {
          metadataType: 'WaveDataset',
          operator: 'exists',
          conditionOr: {
            metadataType: 'WaveLens',
            operator: 'exists',
            conditionOr: {
              metadataType: 'WaveRecipe',
              operator: 'exists',
              conditionOr: {
                metadataType: 'WaveTemplateBundle',
                operator: 'exists',
                conditionOr: {
                  metadataType: 'WaveXmd',
                  operator: 'exists'
                }
                }
              }
            }
          }
        }
    }
  }
}
]

export {
  mdTypes,
  enablementRules,
  editionWarningRules,
  alertRules,
  qualityRules,
  minAPI,
  techAdoptionRules,
  rulesVersion,
  dependencyRules
};




