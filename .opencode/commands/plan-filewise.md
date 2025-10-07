---
command: plan-filewise
category: planning
purpose: Generate comprehensive file-by-file implementation plans
arguments: [feature-request, context-sources]
usage: /plan-filewise "feature description" [--context=@file-path,@ado:123,@folder-path]
output-style: "plan-filewise"
---

# Plan Filewise Command

Creates detailed, file-by-file implementation plans that provide step-by-step specifications for implementing features. Each plan includes comprehensive analysis, dependency-ordered file specifications, and implementation-ready details.

## Purpose

You are a coding agent that specializes in generating comprehensive, file-by-file implementation plans for software features. Your task is to analyze a feature request and create a detailed, structured plan that provides specific file-level implementation guidance without actually writing code.

## Command Usage

### Basic Usage
```
/plan-filewise "implement user authentication system"
```

### With Context Sources
```
/plan-filewise "add shopping cart functionality" --context=@components/,@api/routes/,@ado:AUTH-123
```

### With Multiple Context Types
```
/plan-filewise "implement real-time chat" --context=@websocket-config.js,@ado:CHAT-456,@docs/architecture.md
```

## Arguments

### Required Arguments
- **feature-request**: Detailed description of the feature to be implemented

### Optional Arguments
- **--context**: Comma-separated list of context sources
  - `@file-path`: Include specific files (e.g., `@src/components/Button.tsx`)
  - `@folder-path/`: Include entire directories (e.g., `@src/api/`)
  - `@ado:ticket-id`: Include Azure DevOps work item context (e.g., `@ado:USER-123`)
  - `@url`: Include web resources (e.g., `@https://api-docs.example.com`)

## Planning Process

The command follows a comprehensive planning methodology:

1. **Codebase Analysis**: Examine existing project structure, patterns, and architecture
2. **Context Integration**: Process all provided context sources (files, ADO tickets, documentation)
3. **Feature Decomposition**: Break down the feature into implementable components
4. **Dependency Analysis**: Order files by implementation dependencies
5. **Specification Generation**: Create detailed, implementation-ready file specifications

## Output Structure

The command generates plans using the **file-by-file output style** which includes:

### Discovery & Analysis Phase
- **Codebase Analysis**: Framework detection, architecture patterns, integration points
- **Context Review**: Analysis of all provided context sources
- **Pattern Identification**: Existing patterns that influence implementation

### Implementation Specification
- **File-by-File Plan**: Dependency-ordered file specifications
- **Integration Points**: How components connect and communicate
- **Testing Strategy**: Comprehensive testing approach for each file
- **Quality Assurance**: Error handling, performance, and accessibility considerations

### Validation & Deployment
- **Quality Gates**: Validation criteria for each implementation phase
- **Testing Requirements**: Unit, integration, and E2E testing specifications
- **Deployment Considerations**: Build, deployment, and rollback strategies

## Context Source Integration

### File Context (`@file-path`)
- Analyzes existing code patterns and conventions
- Identifies reusable components and utilities
- Ensures consistency with current implementation style

### Directory Context (`@folder-path/`)
- Examines architectural patterns across multiple files
- Identifies common utilities and shared components
- Analyzes module organization and dependency patterns

### ADO Integration (`@ado:ticket-id`)
- Incorporates requirements from Azure DevOps work items
- Considers acceptance criteria and business requirements
- Aligns technical implementation with project management context

### Documentation Context (`@url`, `@doc-path`)
- References external API documentation and specifications
- Incorporates architectural decision records and design documents
- Ensures compliance with external system requirements

## Examples

### Simple Feature Implementation
```
/plan-filewise "add user profile editing functionality"
```
Creates a comprehensive file-by-file plan for user profile editing with form validation, API integration, and state management.

### Complex Feature with Context
```
/plan-filewise "implement multi-tenant dashboard" --context=@src/auth/,@src/api/tenants/,@ado:TENANT-789,@docs/tenant-architecture.md
```
Generates a detailed plan considering existing authentication, tenant API patterns, project requirements, and architectural documentation.

### API Integration Feature
```
/plan-filewise "integrate third-party payment system" --context=@src/payment/,@https://stripe.com/docs/api,@ado:PAY-456
```
Creates implementation plan incorporating existing payment infrastructure, external API documentation, and project requirements.

## Output Location

Plans are automatically saved to:
- **Directory**: `/ai-docs/stories/`
- **Filename**: Auto-generated based on feature request (e.g., `user-authentication-filewise-plan.md`)
- **Format**: Structured markdown with the file-by-file output style

## Key Features

### Implementation-Ready Specifications
- Complete file specifications requiring no additional research
- Specific imports, exports, and function signatures
- Detailed implementation logic and error handling

### Dependency Management
- Files ordered by implementation dependencies
- Clear prerequisites and integration points
- Smooth implementation flow from foundation to features

### Quality Integration
- Built-in testing strategy for each file
- Performance considerations and optimization points
- Accessibility and security requirements included

### Context-Aware Planning
- Leverages existing codebase patterns and conventions
- Integrates external requirements and documentation
- Ensures consistency with project architecture and standards

## Best Practices

1. **Provide Clear Feature Descriptions**: More detailed requests yield better plans
2. **Include Relevant Context**: Use `--context` to provide existing code and requirements
3. **Review Generated Plans**: Validate the plan against your specific requirements before implementation
4. **Follow Implementation Order**: Implement files in the dependency order specified in the plan
5. **Use Quality Gates**: Follow the testing and validation criteria provided in each file specification

This command creates comprehensive, actionable implementation plans that enable developers to implement features efficiently while maintaining code quality and architectural consistency.