/**
 * Build-related interfaces for Azure DevOps API
 */

import type { IdentityRef } from './pull-request.js';

export interface Build {
  id: number;
  buildNumber: string;
  status?: string;
  result?: string;
  queueTime?: string;
  startTime?: string;
  finishTime?: string;
  url?: string;
  definition?: BuildDefinition;
  project?: Project;
  uri?: string;
  sourceBranch?: string;
  sourceVersion?: string;
  reason?: string;
  requestedFor?: IdentityRef;
  requestedBy?: IdentityRef;
  lastChangedDate?: string;
  lastChangedBy?: IdentityRef;
  orchestrationPlan?: OrchestrationPlan;
}

export interface BuildDefinition {
  id: number;
  name: string;
  url?: string;
  uri?: string;
  path?: string;
  type?: string;
  queueStatus?: string;
  revision?: number;
  project?: Project;
}

export interface Project {
  id: string;
  name?: string;
  url?: string;
  state?: string;
  revision?: number;
  visibility?: string;
  lastUpdateTime?: string;
}


export interface OrchestrationPlan {
  planId: string;
}

export interface Policy {
  id: number;
  typeId: string;
  typeName: string;
  name: string;
  status: PolicyStatus;
  isBlocking: boolean;
  displayText?: string;
  isBuildPolicy: boolean;
  buildId?: number;
  buildIsExpired?: boolean;
  evaluationId: string;
  projectId: string;
}

export enum PolicyStatus {
  NotSet = 0,
  Queued = 1,
  Approved = 2,
  Rejected = 3,
  Running = 4,
  Broken = 5
}

export interface PolicyRaw {
  configurationId: number;
  displayName?: string;
  status: number;
  isBlocking: boolean;
  displayText?: string;
  evaluationId: string;
  buildId?: number;
  buildIsExpired?: boolean;
  policyType?: PolicyType;
}

export interface PolicyType {
  id: string;
  displayName?: string;
}

export interface HierarchyQueryResponse {
  dataProviders?: HierarchyQueryDataProviders;
}

export interface HierarchyQueryDataProviders {
  ['ms.vss-code-web.pr-detail-data-provider']?: PrDetailDataProvider;
}

export interface PrDetailDataProvider {
  policies?: PolicyRaw[];
}

export interface RequeuedBuild {
  policyName: string;
  buildId: number;
  evaluationId: string;
  timestamp?: Date;
}

export interface BuildsResponse {
  count: number;
  value: Build[];
}

export interface BuildQueryOptions {
  branchName?: string;
  buildNumber?: string;
  definitions?: string;  // Comma-separated list of definition IDs
  maxBuildsPerDefinition?: number;
  deletedFilter?: 'excludeDeleted' | 'includeDeleted' | 'onlyDeleted';
  queryOrder?: 'finishTimeAscending' | 'finishTimeDescending' | 'queueTimeAscending' | 'queueTimeDescending' | 'startTimeAscending' | 'startTimeDescending';
  reasonFilter?: string;
  resultFilter?: string;
  statusFilter?: string;
  tagFilters?: string;
  properties?: string;
  top?: number;
  continuationToken?: string;
  maxTime?: Date;
  minTime?: Date;
  buildIds?: string;  // Comma-separated list of build IDs
  repositoryId?: string;
  repositoryType?: string;
}

export interface BuildUpdateOptions {
  forceRetry?: boolean;
  status?: string;
  retryBuildId?: number;
}

export interface BuildStatus {
  id: number;
  buildNumber: string;
  status: string;
  result?: string;
  percentComplete?: number;
  currentOperation?: string;
  startTime?: string;
  finishTime?: string;
}