# Work Item Context

## Work Item #4190965: [TI] SFI: Prevent Permissions-Based Boundary Traversal , Revoke exposed certs (non-prod in Torus) - TeamsLiveEvents Attendee

### Basic Information
- **Type**: Feature
- **State**: On Hold
- **Assigned To**: Kiran Madipally
- **Created**: 7/10/2025
- **Tags**: test-1758386529287
- **Priority**: 6

### Description
Risk Definition Unclear. Compound statement. Only thing clear is exposed secrets. Overall Mitigation Plan "Create a plan" - We haven't been able to create a proactive plan because upstream security planning on additional TorusProd security hardening has been nondeterministic. Every time we've tried to nail down M365 or COSMIC or other hardening, its been problematic. This isn't actionable at the moment unless there is new information I'm not aware of. "..adopt TDF network isolation" - There is no TDF network isolation plan and hence, nothing to implement. Exposed Secrets - One IC3 regression measured via ES3.3.1. Note this is a KTLO item already. So nothing to really track here. Planned End State for Wave 6 (Exit Criteria) Unknown Unknown Exposed secrets = zero Dependencies Tk Measurement Unknown Unknown Exposed Secrets: https://vnext.s360.msftcloudes.com/blades/security?blade=KPI:583d65f8-d054-4a08-936a-ef4ff8db470c~SLA:3~AssignedTo:All~Forums:All~waves:All~Tab:Summary~_loc:Security&peopleBasedNodes=sumis_team;perryc_team;yongwang_team;rajivk_team&global=1:81004838-6311-4249-b521-ab6fcc3834f7&tile=ActionItemSubtype:CorpBoxTorusSni~_loc:__key__Security__583d65f8-d054-4a08-936a-ef4ff8db470c

### Discussion History
**Kiran Madipally** (9/20/2025):
Test comment added at 2025-09-20T16:42:09.603Z

**Kiran Madipally** (9/20/2025):
Test comment from Azure DevOps package - 2025-09-20T16:41:33.564Z

**Kiran Madipally** (9/20/2025):
Test comment added at 2025-09-20T16:36:39.024Z

**Peter Schmatz** (9/12/2025):
Changing state to "On-Hold" until AEGIS guidance is available

**Nihal Konan** (7/10/2025):
Let's align w/Teams on scope (which should only be exposed secrets).

### Parent Work Item
- #4173104: [TI] SFI: Prevent Permissions-Based Boundary Traversal , Revoke exposed certs (non-prod in Torus)
  - Type: Key Result
  - State: On Hold

## Implementation Context

Based on the work item details and related information above:
1. This work item requires implementation of the described functionality
2. Consider the acceptance criteria and any constraints mentioned
3. Review related PRs for context on similar implementations
4. Ensure alignment with parent/child work items if present

Please implement the required functionality following the specifications and context provided.