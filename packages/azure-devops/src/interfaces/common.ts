/**
 * Common Azure DevOps Interfaces
 */

export interface AzureDevOpsConfig {
  organization: string;
  project: string;
  pat: string;
  apiVersion?: string;
}

export interface ApiResponse<T> {
  value: T[];
  count: number;
  continuationToken?: string;
}

export interface ErrorResponse {
  $id: string;
  innerException?: any;
  message: string;
  typeName: string;
  typeKey: string;
  errorCode?: number;
  eventId?: number;
}

export interface RequestOptions {
  top?: number;
  skip?: number;
  continuationToken?: string;
  expand?: string;
}

export interface BatchRequest<T> {
  value: T[];
}

export interface BatchResponse<T> {
  count: number;
  value: T[];
}

export class AzureDevOpsError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: ErrorResponse
  ) {
    super(message);
    this.name = 'AzureDevOpsError';
  }
}