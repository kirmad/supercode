/**
 * Azure DevOps Pull Request Interfaces
 */

export interface PullRequest {
  pullRequestId: number;
  codeReviewId: number;
  status: 'active' | 'abandoned' | 'completed' | 'draft';
  createdBy: IdentityRef;
  creationDate: string;
  closedDate?: string;
  title: string;
  description: string;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: 'succeeded' | 'conflicts' | 'queued' | 'notSet' | 'failure';
  isDraft: boolean;
  mergeId?: string;
  lastMergeSourceCommit?: GitCommitRef;
  lastMergeTargetCommit?: GitCommitRef;
  lastMergeCommit?: GitCommitRef;
  reviewers: IdentityRefWithVote[];
  url: string;
  _links: ReferenceLinks;
  supportsIterations?: boolean;
  artifactId?: string;
  autoCompleteSetBy?: IdentityRef;
  closedBy?: IdentityRef;
  completionOptions?: PullRequestCompletionOptions;
  completionQueueTime?: string;
  mergeFailureMessage?: string;
  mergeFailureType?: string;
  mergeOptions?: GitPullRequestMergeOptions;
  remoteUrl?: string;
  repository?: GitRepository;
}

export interface IdentityRef {
  displayName: string;
  url: string;
  _links?: ReferenceLinks;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor?: string;
  directoryAlias?: string;
  inactive?: boolean;
  isAadIdentity?: boolean;
  isContainer?: boolean;
  profileUrl?: string;
}

export interface IdentityRefWithVote extends IdentityRef {
  vote: number; // -10: Rejected, -5: Waiting for author, 0: No vote, 5: Approved with suggestions, 10: Approved
  hasDeclined?: boolean;
  isFlagged?: boolean;
  isRequired?: boolean;
  votedFor?: IdentityRef[];
}

export interface GitCommitRef {
  commitId: string;
  url: string;
  author?: GitUserDate;
  committer?: GitUserDate;
  comment?: string;
  changeCounts?: ChangeCountDictionary;
}

export interface GitUserDate {
  name: string;
  email: string;
  date: string;
}

export interface ChangeCountDictionary {
  Add?: number;
  Edit?: number;
  Delete?: number;
  [key: string]: number | undefined;
}

export interface ReferenceLinks {
  [key: string]: {
    href: string;
  };
}

export interface PullRequestCompletionOptions {
  bypassPolicy?: boolean;
  bypassReason?: string;
  deleteSourceBranch?: boolean;
  mergeCommitMessage?: string;
  mergeStrategy?: 'noFastForward' | 'squash' | 'rebase' | 'rebaseMerge';
  transitionWorkItems?: boolean;
}

export interface GitPullRequestMergeOptions {
  conflictAuthorship?: boolean;
  detectRenamed?: boolean;
}

export interface GitRepository {
  id: string;
  name: string;
  url: string;
  project: {
    id: string;
    name: string;
    url: string;
    state?: string;
  };
  defaultBranch?: string;
  remoteUrl?: string;
  sshUrl?: string;
  webUrl?: string;
}

export interface GitPullRequestIteration {
  id: number;
  description?: string;
  author: IdentityRef;
  createdDate: string;
  updatedDate: string;
  sourceRefCommit: GitCommitRef;
  targetRefCommit: GitCommitRef;
  commonRefCommit?: GitCommitRef;
  hasMoreCommits?: boolean;
  changeList?: GitPullRequestChange[];
  commits?: GitCommitRef[];
  push?: GitPushRef;
  reason?: 'push' | 'forcePush' | 'create' | 'rebase';
}

export interface GitPullRequestChange {
  changeId?: number;
  changeType: 'add' | 'edit' | 'delete' | 'rename' | 'copy' | 'undelete';
  item: GitItem;
  newContent?: ItemContent;
  sourceServerItem?: string;
  changeTrackingId?: number;
  originalPath?: string;
  newContentTemplate?: GitTemplate;
}

export interface GitItem {
  objectId?: string;
  originalObjectId?: string;
  gitObjectType?: 'blob' | 'tree' | 'commit' | 'tag' | 'bad';
  commitId?: string;
  path: string;
  isFolder?: boolean;
  isSymLink?: boolean;
  url?: string;
  content?: string;
  contentMetadata?: FileContentMetadata;
  size?: number;
}


export interface ItemContent {
  content: string;
  contentType: 'rawtext' | 'base64encoded';
}

export interface FileContentMetadata {
  contentType?: string;
  encoding?: number;
  extension?: string;
  fileName?: string;
  isBinary?: boolean;
  isImage?: boolean;
  vsLink?: string;
}

export interface GitTemplate {
  name: string;
  type: string;
}

export interface GitPushRef {
  pushId: number;
  repositoryId: string;
  date: string;
  pushedBy: IdentityRef;
}

export interface GitPullRequestCommentThread {
  id: number;
  publishedDate: string;
  lastUpdatedDate: string;
  comments: Comment[];
  status: 'unknown' | 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending';
  threadContext?: CommentThreadContext;
  properties?: any;
  identities?: { [key: string]: IdentityRef };
  isDeleted?: boolean;
  _links?: ReferenceLinks;
  artifactId?: string;
}

export interface Comment {
  id: number;
  parentCommentId?: number;
  author: IdentityRef;
  content: string;
  publishedDate: string;
  lastUpdatedDate: string;
  lastContentUpdatedDate: string;
  commentType?: 'unknown' | 'text' | 'codeChange' | 'system';
  usersLiked?: IdentityRef[];
  _links?: ReferenceLinks;
  isDeleted?: boolean;
}

export interface CommentThreadContext {
  filePath?: string;
  leftFileStart?: CommentPosition;
  leftFileEnd?: CommentPosition;
  rightFileStart?: CommentPosition;
  rightFileEnd?: CommentPosition;
}

export interface CommentPosition {
  line: number;
  offset?: number;
  column?: number;
}

export interface CreateThreadRequest {
  comments: CreateCommentRequest[];
  status?: 'active' | 'pending' | 'closed' | 'fixed' | 'wontFix' | 'byDesign';
  threadContext?: CommentThreadContext;
  properties?: any;
}

export interface CreateCommentRequest {
  parentCommentId?: number;
  content: string;
  commentType?: 'text' | 'codeChange';
}

export interface UpdateCommentRequest {
  content: string;
}

export interface UpdateThreadRequest {
  status: 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending';
}

export interface PullRequestSearchCriteria {
  creatorId?: string;
  includeLinks?: boolean;
  repositoryId?: string;
  reviewerId?: string;
  sourceRefName?: string;
  targetRefName?: string;
  status?: 'notSet' | 'active' | 'abandoned' | 'completed' | 'all';
  maxCommentLength?: number;
  skip?: number;
  top?: number;
}

export interface AssociatedWorkItem {
  id: string;
  url: string;
}