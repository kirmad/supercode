/**
 * Azure DevOps Work Item Interfaces
 */

export interface WorkItem {
  id: number;
  rev: number;
  fields: WorkItemFields;
  relations?: WorkItemRelation[];
  _links: {
    self: { href: string };
    workItemUpdates: { href: string };
    workItemRevisions: { href: string };
    workItemComments: { href: string };
    html: { href: string };
    workItemType: { href: string };
    fields: { href: string };
  };
  url: string;
}

export interface WorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.WorkItemType': string;
  'System.State': string;
  'System.AssignedTo'?: UserReference;
  'System.Tags'?: string;
  'System.Description'?: string;
  'System.History'?: string;
  'System.AreaPath': string;
  'System.TeamProject': string;
  'System.IterationPath': string;
  'System.CreatedDate': string;
  'System.ChangedDate': string;
  'System.CreatedBy': UserReference;
  'System.ChangedBy': UserReference;
  'System.Reason': string;
  'System.CommentCount': number;
  'System.Parent'?: number;
  [key: string]: any; // For custom fields
}

export interface UserReference {
  displayName: string;
  uniqueName: string;
  id: string;
  imageUrl: string;
  descriptor?: string;
}

export interface WorkItemRelation {
  rel: string;
  url: string;
  attributes?: {
    isLocked?: boolean;
    name?: string;
    comment?: string;
    resourceCreatedDate?: string;
    resourceModifiedDate?: string;
  };
}

export interface WiqlQuery {
  query: string;
}

export interface WiqlQueryResult {
  queryType: 'flat' | 'tree' | 'oneHop';
  queryResultType: 'workItem' | 'workItemLink';
  asOf: string;
  columns: WiqlColumn[];
  sortColumns?: WiqlSortColumn[];
  workItems: WorkItemReference[];
  workItemRelations?: WorkItemLink[];
}

export interface WiqlColumn {
  referenceName: string;
  name: string;
  url?: string;
}

export interface WiqlSortColumn {
  field: WiqlColumn;
  descending: boolean;
}

export interface WorkItemReference {
  id: number;
  url?: string;
}

export interface WorkItemLink {
  source?: WorkItemReference;
  target: WorkItemReference;
  rel?: string;
}

export interface WorkItemComment {
  id: number;
  workItemId: number;
  text: string;
  createdBy: UserReference;
  createdDate: string;
  modifiedBy: UserReference;
  modifiedDate: string;
  url: string;
  format?: 'html' | 'markdown';
}

export interface WorkItemCommentsResponse {
  comments: WorkItemComment[];
  count: number;
  nextPage?: string;
  totalCount: number;
  continuationToken?: string;
}

export interface WorkItemUpdate {
  id: number;
  workItemId: number;
  rev: number;
  revisedBy: UserReference;
  revisedDate: string;
  fields?: { [key: string]: any };
  relations?: {
    added?: WorkItemRelation[];
    removed?: WorkItemRelation[];
    updated?: WorkItemRelation[];
  };
  url: string;
}

export interface WorkItemType {
  name: string;
  referenceName: string;
  description: string;
  color: string;
  icon: {
    id: string;
    url: string;
  };
  isDisabled: boolean;
  fields?: WorkItemTypeField[];
  fieldInstances?: WorkItemTypeField[];
  states?: WorkItemStateColor[];
  url: string;
}

export interface WorkItemTypeField {
  name: string;
  referenceName: string;
  type: string;
  readOnly?: boolean;
  required?: boolean;
  defaultValue?: any;
  alwaysRequired?: boolean;
  helpText?: string;
  url?: string;
}

export interface WorkItemStateColor {
  name: string;
  color: string;
  category: string;
}

export interface WorkItemBatchGetRequest {
  ids: number[];
  fields?: string[];
  asOf?: string;
  expand?: 'none' | 'relations' | 'fields' | 'links' | 'all';
  errorPolicy?: 'fail' | 'omit';
}

export interface WorkItemUpdateRequest {
  op: 'add' | 'replace' | 'remove' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export interface BatchWorkItemUpdateRequest {
  id: number;
  document: WorkItemUpdateRequest[];
}