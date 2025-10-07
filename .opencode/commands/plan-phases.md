---
command: plan-phases
category: planning
purpose: Generate comprehensive phase-wise implementation plans
arguments: [feature-request, context-sources]
usage: /plan-phases "feature description" [--context=@file-path,@ado:123,@folder-path]
output-style: "plan-phasewise"
---

# Plan Phases Command

Creates detailed, phase-wise implementation plans that break complex features into manageable, independently deployable phases with clear dependencies, validation criteria, and progress tracking capabilities.

## Purpose

You are a coding agent that specializes in generating comprehensive, phase-wise implementation plans for software features. Your task is to analyze a feature request and create a detailed, structured plan that organizes implementation into logical phases that can be developed, tested, and deployed incrementally.

## Command Usage

### Basic Usage
```
/plan-phases "implement complete e-commerce system"
```

### With Context Sources
```
/plan-phases "modernize legacy user management" --context=@src/legacy/,@api/users/,@ado:LEGACY-456
```

### With Multiple Context Types
```
/plan-phases "implement microservices architecture" --context=@monolith/,@docs/microservices-strategy.md,@ado:ARCH-789,@https://microservices.io/patterns
```

## Arguments

### Required Arguments
- **feature-request**: Detailed description of the feature or system to be implemented

### Optional Arguments
- **--context**: Comma-separated list of context sources
  - `@file-path`: Include specific files (e.g., `@src/config/database.js`)
  - `@folder-path/`: Include entire directories (e.g., `@src/modules/`)
  - `@ado:ticket-id`: Include Azure DevOps work item context (e.g., `@ado:EPIC-123`)
  - `@url`: Include web resources (e.g., `@https://architectural-patterns.com`)

## Planning Methodology

The command follows a comprehensive phase-based planning approach:

1. **System Analysis**: Examine existing architecture, dependencies, and constraints
2. **Context Integration**: Process all provided context sources for complete requirements understanding
3. **Phase Decomposition**: Break complex features into logical, deployable phases
4. **Dependency Mapping**: Identify phase dependencies and optimal implementation sequence
5. **Risk Assessment**: Evaluate risks and plan mitigation strategies for each phase
6. **Validation Planning**: Define success criteria and quality gates for each phase

## Output Structure

The command generates plans using the **phase-wise output style** which includes:

### Project Analysis & Context
- **Framework Detection**: Technology stack and architectural pattern analysis
- **Existing Pattern Analysis**: Reusable components and established conventions
- **Integration Point Mapping**: APIs, services, and system interconnections
- **Context Source Analysis**: Comprehensive review of all provided context

### Phase-Based Implementation Plan
- **Phase Breakdown**: Logical phases with clear deliverables and dependencies
- **Implementation Specifications**: Detailed technical requirements for each phase
- **Validation Criteria**: Success metrics and quality gates for phase completion
- **Risk Management**: Identified risks and mitigation strategies per phase

### Progress Tracking & Deployment
- **XML Structure**: Machine-readable progress tracking capabilities
- **Deployment Strategy**: Phase-specific deployment and rollback procedures
- **Quality Assurance**: Testing and validation requirements for each phase
- **Monitoring & Metrics**: Success measurement and progress tracking

## Phase Design Philosophy

### Independent Deployability
- Each phase delivers working functionality that can be deployed independently
- Phases include complete testing, documentation, and deployment specifications
- Rollback safety ensures phases can be reverted without affecting previous work

### Incremental Value Delivery
- Each phase delivers measurable user value and business outcomes
- Early phases validate architecture and reduce overall project risk
- Progressive enhancement approach builds complexity gradually

### Risk Mitigation
- Critical functionality implemented in early phases to validate architecture
- Dependencies managed through careful phase ordering and interface design
- Quality gates prevent progression until phase objectives are met

## Context Source Integration

### File Context (`@file-path`)
- Analyzes existing system architecture and implementation patterns
- Identifies technical debt and modernization opportunities
- Ensures phase plans respect existing system constraints and capabilities

### Directory Context (`@folder-path/`)
- Examines system organization and architectural boundaries
- Identifies natural phase boundaries based on existing module structure
- Analyzes cross-cutting concerns and shared infrastructure requirements

### ADO Integration (`@ado:ticket-id`)
- Incorporates business requirements and acceptance criteria
- Aligns phases with project milestones and business priorities
- Considers stakeholder needs and delivery timeline constraints

### Documentation Context (`@url`, `@doc-path`)
- References architectural decision records and design patterns
- Incorporates industry best practices and proven implementation approaches
- Ensures compliance with external standards and integration requirements

## Examples

### Large System Implementation
```
/plan-phases "implement complete customer relationship management system"
```
Creates a multi-phase plan breaking CRM implementation into logical phases like user management, contact management, sales pipeline, reporting, and integrations.

### System Modernization with Context
```
/plan-phases "modernize legacy monolith to microservices" --context=@src/legacy/,@docs/migration-strategy.md,@ado:MODERN-123
```
Generates a comprehensive modernization plan considering existing legacy code, migration strategy documentation, and business requirements.

### Complex Integration Project
```
/plan-phases "implement multi-channel notification system" --context=@src/notifications/,@https://twilio.com/docs,@ado:NOTIFY-456,@docs/notification-requirements.md
```
Creates phased implementation plan for complex notification system incorporating existing infrastructure, external service documentation, and detailed requirements.

## Output Location

Plans are automatically saved to:
- **Directory**: `/ai-docs/stories/`
- **Filename**: Auto-generated based on feature request (e.g., `crm-system-phases-plan.md`)
- **Format**: Structured markdown with XML elements for machine-readable progress tracking

## Key Features

### Phase Independence
- Each phase can be developed, tested, and deployed independently
- Clear phase boundaries with well-defined interfaces and contracts
- Rollback capability without affecting previous phases

### Progress Tracking
- XML structure enables automated progress monitoring and reporting
- Clear validation criteria for each phase completion
- Machine-readable format for integration with project management tools

### Risk Management
- Early phases validate critical architecture decisions
- Risk assessment and mitigation strategies for each phase
- Quality gates prevent progression until phase objectives are met

### Business Alignment
- Phases aligned with business value delivery and user needs
- Consideration of stakeholder priorities and delivery timelines
- Measurable outcomes and success criteria for each phase

## Phase Planning Best Practices

### Phase Design
1. **Foundation First**: Infrastructure and core services in early phases
2. **Value Early**: User-facing functionality in phases 2-3 for early feedback
3. **Complexity Late**: Advanced features and optimizations in later phases
4. **Integration Continuous**: API and service integration throughout all phases

### Dependency Management
1. **Minimize Cross-Phase Dependencies**: Each phase should be as self-contained as possible
2. **Clear Interfaces**: Well-defined contracts between phases and existing systems
3. **Backward Compatibility**: Later phases don't break earlier phase functionality
4. **Data Migration Strategy**: Clear data handling approach across phases

### Quality Assurance
1. **Phase-Specific Testing**: Comprehensive testing strategy for each phase
2. **Integration Testing**: Continuous validation of phase interactions
3. **Performance Monitoring**: Phase-specific performance metrics and monitoring
4. **Documentation Updates**: Living documentation updated with each phase

## Best Practices

1. **Provide Comprehensive Feature Descriptions**: Complex features benefit from detailed requirements
2. **Include Relevant Context**: Use `--context` to provide existing code, documentation, and requirements
3. **Consider Business Priorities**: Phases should align with business value delivery
4. **Plan for Feedback**: Early phases should enable user feedback and course correction
5. **Monitor Progress**: Use the XML structure for automated progress tracking and reporting

This command creates comprehensive, manageable implementation plans that enable teams to deliver complex features incrementally while maintaining system stability and delivering continuous business value.