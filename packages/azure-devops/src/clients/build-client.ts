import type { AzureDevOpsConfig } from '../interfaces/common.js';
import type {
  Build,
  BuildsResponse,
  BuildQueryOptions,
  Policy,
  PolicyRaw,
  HierarchyQueryResponse,
  RequeuedBuild,
  BuildUpdateOptions
} from '../interfaces/build.js';
import { PolicyStatus } from '../interfaces/build.js';
import type { PullRequest } from '../interfaces/pull-request.js';

export interface BuildMonitorOptions {
  pollInterval?: number; // milliseconds
  maxRetries?: number;
  onStatusChange?: (build: Build) => void;
}

export interface PrGatingBuild {
  policyName: string;
  buildId: number;
  build?: Build;
  status: PolicyStatus;
  isBlocking: boolean;
  isExpired: boolean;
}

export class BuildClient {
  private baseUrl: string;
  private organization: string;
  private project: string;
  private headers: Record<string, string>;
  private readonly BUILD_POLICY_TYPE_ID = '0609b952-1397-4640-95ec-e00a01b2c241';

  constructor(config: AzureDevOpsConfig) {
    this.organization = config.organization;
    this.project = config.project;
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;
    this.headers = {
      'Authorization': `Basic ${Buffer.from(`:${config.pat}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Helper method to make API requests
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data as T;
  }

  /**
   * Get builds for a project or specific repository
   */
  async getBuilds(options: BuildQueryOptions = {}): Promise<Build[]> {
    const params = new URLSearchParams();

    if (options.branchName) params.append('branchName', options.branchName);
    if (options.buildNumber) params.append('buildNumber', options.buildNumber);
    if (options.definitions) params.append('definitions', options.definitions);
    if (options.maxBuildsPerDefinition) params.append('maxBuildsPerDefinition', options.maxBuildsPerDefinition.toString());
    if (options.deletedFilter) params.append('deletedFilter', options.deletedFilter);
    if (options.queryOrder) params.append('queryOrder', options.queryOrder);
    if (options.reasonFilter) params.append('reasonFilter', options.reasonFilter);
    if (options.resultFilter) params.append('resultFilter', options.resultFilter);
    if (options.statusFilter) params.append('statusFilter', options.statusFilter);
    if (options.tagFilters) params.append('tagFilters', options.tagFilters);
    if (options.properties) params.append('properties', options.properties);
    if (options.top) params.append('$top', options.top.toString());
    if (options.continuationToken) params.append('continuationToken', options.continuationToken);
    if (options.maxTime) params.append('maxTime', options.maxTime.toISOString());
    if (options.minTime) params.append('minTime', options.minTime.toISOString());
    if (options.buildIds) params.append('buildIds', options.buildIds);
    if (options.repositoryId) params.append('repositoryId', options.repositoryId);
    if (options.repositoryType) params.append('repositoryType', options.repositoryType);

    params.append('api-version', '6.0');

    const url = `${this.baseUrl}/build/builds?${params.toString()}`;
    const response = await this.request<BuildsResponse>(url, {
      method: 'GET'
    });

    return response.value || [];
  }

  /**
   * Get a specific build by ID
   */
  async getBuild(buildId: number): Promise<Build> {
    const url = `${this.baseUrl}/build/builds/${buildId}?api-version=6.0`;
    return await this.request<Build>(url, {
      method: 'GET'
    });
  }

  /**
   * Get builds for a specific pull request
   */
  async getPrBuilds(repositoryId: string, pullRequestId: number): Promise<Build[]> {
    // Get the PR to find its source branch
    const prUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=6.0`;
    const pr = await this.request<PullRequest>(prUrl, {
      method: 'GET'
    });

    if (!pr.sourceRefName) {
      throw new Error(`Pull request ${pullRequestId} has no source branch`);
    }

    // Query builds for this PR's source branch
    const options: BuildQueryOptions = {
      branchName: pr.sourceRefName,
      repositoryId: repositoryId,
      repositoryType: 'TfsGit',
      queryOrder: 'finishTimeDescending',
      top: 50
    };

    return await this.getBuilds(options);
  }

  /**
   * Get policies for a pull request (including build policies)
   */
  async getPrPolicies(repositoryId: string, pullRequestId: number): Promise<Policy[]> {
    // First get the PR details to get project and repo IDs
    const prUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=6.0`;
    const pr = await this.request<any>(prUrl, {
      method: 'GET'
    });

    if (!pr.repository?.project?.id || !pr.repository?.id) {
      throw new Error(`Could not find project or repository ID for PR ${pullRequestId}`);
    }

    const projectId = pr.repository.project.id;
    const repoId = pr.repository.id;

    // Query the HierarchyQuery API to get policies
    const hierarchyUrl = `https://${this.organization}.visualstudio.com/_apis/Contribution/HierarchyQuery/project/${projectId}`;

    const body = {
      contributionIds: ['ms.vss-code-web.pr-detail-data-provider'],
      dataProviderContext: {
        properties: {
          baseIterationId: 0,
          iterationId: 1,
          pullRequestId: pullRequestId,
          repositoryId: repoId,
          types: 192,
          sourcePage: {
            url: `${this.baseUrl.replace('/_apis', '')}/_git/${repositoryId}/pullrequest/${pullRequestId}`,
            routeId: 'ms.vss-code-web.pull-request-details-route',
            routeValues: {
              project: this.project,
              GitRepositoryName: repositoryId,
              parameters: pullRequestId.toString(),
              vctype: 'git',
              controller: 'ContributedPage',
              action: 'Execute',
              serviceHost: this.organization
            }
          }
        }
      }
    };

    const headers = {
      'Accept': 'application/json; api-version=5.0-preview.1',
      'Content-Type': 'application/json'
    };

    const response = await this.request<HierarchyQueryResponse>(hierarchyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const rawPolicies = response.dataProviders?.['ms.vss-code-web.pr-detail-data-provider']?.policies || [];

    // Convert raw policies to our Policy interface
    return rawPolicies.map((rawPolicy: PolicyRaw) => ({
      id: rawPolicy.configurationId,
      typeId: rawPolicy.policyType?.id || '',
      typeName: rawPolicy.policyType?.displayName || 'Unknown',
      name: rawPolicy.displayName || 'Unknown Policy',
      status: rawPolicy.status as PolicyStatus,
      isBlocking: rawPolicy.isBlocking,
      displayText: rawPolicy.displayText,
      isBuildPolicy: rawPolicy.policyType?.id === this.BUILD_POLICY_TYPE_ID,
      buildId: rawPolicy.buildId,
      buildIsExpired: rawPolicy.buildIsExpired,
      evaluationId: rawPolicy.evaluationId,
      projectId: projectId
    }));
  }

  /**
   * Get only build policies for a pull request
   */
  async getPrBuildPolicies(repositoryId: string, pullRequestId: number): Promise<Policy[]> {
    const allPolicies = await this.getPrPolicies(repositoryId, pullRequestId);
    return allPolicies.filter(p => p.isBuildPolicy);
  }

  /**
   * Requeue a build via its policy evaluation
   */
  async requeueBuild(evaluationId: string, projectId: string): Promise<RequeuedBuild> {
    const url = `https://${this.organization}.visualstudio.com/${projectId}/_apis/policy/Evaluations/${evaluationId}`;

    const headers = {
      'Accept': 'application/json; api-version=5.0-preview.1'
    };

    await this.request(url, {
      method: 'PATCH',
      headers
    });

    return {
      policyName: 'Build Policy',
      buildId: 0, // Will be assigned after requeue
      evaluationId: evaluationId,
      timestamp: new Date()
    };
  }

  /**
   * Requeue all expired builds for a pull request
   */
  async requeueExpiredBuilds(repositoryId: string, pullRequestId: number): Promise<RequeuedBuild[]> {
    const policies = await this.getPrBuildPolicies(repositoryId, pullRequestId);
    const requeuedBuilds: RequeuedBuild[] = [];

    for (const policy of policies) {
      // Skip if already approved
      if (policy.status === PolicyStatus.Approved) {
        console.log(`Build policy '${policy.name}' is already approved - skipping`);
        continue;
      }

      // Skip if no build ID or not expired
      if (!policy.buildId || !policy.buildIsExpired) {
        console.log(`Build ${policy.buildId} for policy '${policy.name}' is not expired - skipping`);
        continue;
      }

      console.log(`Requeueing expired build ${policy.buildId} for policy '${policy.name}'`);

      try {
        const requeued = await this.requeueBuild(policy.evaluationId, policy.projectId);
        requeued.policyName = policy.name;
        requeued.buildId = policy.buildId;
        requeuedBuilds.push(requeued);
        console.log(`Successfully requeued build ${policy.buildId}`);
      } catch (error: any) {
        console.error(`Failed to requeue build ${policy.buildId}: ${error.message}`);
      }
    }

    return requeuedBuilds;
  }

  /**
   * Cancel a build
   */
  async cancelBuild(buildId: number): Promise<Build> {
    const url = `${this.baseUrl}/build/builds/${buildId}?api-version=6.0`;

    const body = {
      status: 'cancelling'
    };

    return await this.request<Build>(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  /**
   * Queue a new build
   */
  async queueBuild(definitionId: number, sourceBranch?: string, parameters?: any): Promise<Build> {
    const url = `${this.baseUrl}/build/builds?api-version=6.0`;

    const body: any = {
      definition: {
        id: definitionId
      }
    };

    if (sourceBranch) {
      body.sourceBranch = sourceBranch;
    }

    if (parameters) {
      body.parameters = typeof parameters === 'string' ? parameters : JSON.stringify(parameters);
    }

    return await this.request<Build>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  /**
   * Get gating builds for a pull request (builds that are blocking PR completion)
   */
  async getPrGatingBuilds(repositoryId: string, pullRequestId: number): Promise<PrGatingBuild[]> {
    const policies = await this.getPrBuildPolicies(repositoryId, pullRequestId);
    const gatingBuilds: PrGatingBuild[] = [];

    for (const policy of policies) {
      if (policy.buildId) {
        let build: Build | undefined;

        try {
          build = await this.getBuild(policy.buildId);
        } catch (error) {
          console.warn(`Could not fetch build ${policy.buildId}: ${error}`);
        }

        gatingBuilds.push({
          policyName: policy.name,
          buildId: policy.buildId,
          build: build,
          status: policy.status,
          isBlocking: policy.isBlocking,
          isExpired: policy.buildIsExpired || false
        });
      }
    }

    return gatingBuilds;
  }

  /**
   * Monitor a build until it completes
   */
  async monitorBuild(buildId: number, options: BuildMonitorOptions = {}): Promise<Build> {
    const pollInterval = options.pollInterval || 5000; // 5 seconds default
    const maxRetries = options.maxRetries || 120; // 10 minutes with 5 second intervals
    let retries = 0;

    while (retries < maxRetries) {
      const build = await this.getBuild(buildId);

      if (options.onStatusChange) {
        options.onStatusChange(build);
      }

      // Check if build is complete
      if (build.status === 'completed' || build.status === 'cancelling') {
        return build;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      retries++;
    }

    throw new Error(`Build ${buildId} monitoring timed out after ${maxRetries} retries`);
  }

  /**
   * Monitor all gating builds for a PR until they complete
   */
  async monitorPrGatingBuilds(
    repositoryId: string,
    pullRequestId: number,
    options: BuildMonitorOptions = {}
  ): Promise<PrGatingBuild[]> {
    const gatingBuilds = await this.getPrGatingBuilds(repositoryId, pullRequestId);
    const monitorPromises: Promise<void>[] = [];

    for (const gatingBuild of gatingBuilds) {
      if (gatingBuild.build && gatingBuild.build.status !== 'completed') {
        const promise = this.monitorBuild(gatingBuild.buildId, {
          ...options,
          onStatusChange: (build) => {
            gatingBuild.build = build;
            if (options.onStatusChange) {
              options.onStatusChange(build);
            }
          }
        }).then(completedBuild => {
          gatingBuild.build = completedBuild;
        }).catch(error => {
          console.error(`Failed to monitor build ${gatingBuild.buildId}: ${error}`);
        });

        monitorPromises.push(promise);
      }
    }

    // Wait for all builds to complete
    await Promise.all(monitorPromises);

    return gatingBuilds;
  }

  /**
   * Get a summary of PR build status
   */
  async getPrBuildSummary(repositoryId: string, pullRequestId: number): Promise<{
    totalPolicies: number;
    buildPolicies: number;
    approvedBuilds: number;
    failedBuilds: number;
    runningBuilds: number;
    expiredBuilds: number;
    blockingBuilds: number;
    allBuildsSucceeded: boolean;
    canComplete: boolean;
    gatingBuilds: PrGatingBuild[];
  }> {
    const gatingBuilds = await this.getPrGatingBuilds(repositoryId, pullRequestId);

    const summary = {
      totalPolicies: gatingBuilds.length,
      buildPolicies: gatingBuilds.length,
      approvedBuilds: 0,
      failedBuilds: 0,
      runningBuilds: 0,
      expiredBuilds: 0,
      blockingBuilds: 0,
      allBuildsSucceeded: true,
      canComplete: true,
      gatingBuilds: gatingBuilds
    };

    for (const gatingBuild of gatingBuilds) {
      if (gatingBuild.status === PolicyStatus.Approved) {
        summary.approvedBuilds++;
      }

      if (gatingBuild.isExpired) {
        summary.expiredBuilds++;
      }

      if (gatingBuild.isBlocking) {
        summary.blockingBuilds++;

        // PR can't complete if there are blocking builds that aren't approved
        if (gatingBuild.status !== PolicyStatus.Approved) {
          summary.canComplete = false;
        }
      }

      if (gatingBuild.build) {
        if (gatingBuild.build.status === 'inProgress' || gatingBuild.build.status === 'notStarted') {
          summary.runningBuilds++;
        }

        if (gatingBuild.build.result === 'failed' || gatingBuild.build.result === 'canceled') {
          summary.failedBuilds++;
          summary.allBuildsSucceeded = false;
        }
      }
    }

    return summary;
  }

  /**
   * Update a build (e.g., to retry)
   */
  async updateBuild(buildId: number, options: BuildUpdateOptions): Promise<Build> {
    const url = `${this.baseUrl}/build/builds/${buildId}?api-version=6.0`;

    const body: any = {};

    if (options.status) {
      body.status = options.status;
    }

    if (options.forceRetry) {
      body.retryBuildId = options.retryBuildId || buildId;
      body.status = 'retry';
    }

    return await this.request<Build>(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }
}