---
allowed-tools: [Read, Write, Edit, Glob, Grep, TodoWrite, Task, mcp__sequential-thinking__sequentialthinking, mcp__context7__context7]
description: "Generate structured implementation workflows from PRDs and feature requirements with expert guidance"
argument-hint: "[prd-file|feature-description] [--persona expert] [--c7] [--sequential] [--strategy systematic|agile|mvp] [--output roadmap|tasks|detailed]"
---

# /sc:workflow - Implementation Workflow Generator

## Purpose
Analyze Product Requirements Documents (PRDs) and feature specifications to generate comprehensive, step-by-step implementation workflows with expert guidance, dependency mapping, and automated task orchestration.

## Usage
```
/sc:workflow [prd-file|feature-description] [--persona expert] [--c7] [--sequential] [--strategy systematic|agile|mvp] [--output roadmap|tasks|detailed]
```

## Arguments
- `prd-file|feature-description` - Path to PRD file or direct feature description
- `--strategy` - Workflow strategy (systematic, agile, mvp)
- `--output` - Output format (roadmap, tasks, detailed)
- `--estimate` - Include time and complexity estimates
- `--dependencies` - Map external dependencies and integrations
- `--risks` - Include risk assessment and mitigation strategies
- `--parallel` - Identify parallelizable work streams
- `--milestones` - Create milestone-based project phases

## MCP Integration Flags
- `--c7` / `--context7` - Enable Context7 for framework patterns and best practices
- `--sequential` - Enable Sequential thinking for complex multi-step analysis
- `--magic` - Enable Magic for UI component workflow planning
- `--all-mcp` - Enable all MCP servers for comprehensive workflow generation

## Workflow Strategies

### Systematic Strategy (Default)
1. **Requirements Analysis** - Deep dive into PRD structure and acceptance criteria
2. **Architecture Planning** - System design and component architecture
3. **Dependency Mapping** - Identify all internal and external dependencies
4. **Implementation Phases** - Sequential phases with clear deliverables
5. **Testing Strategy** - Comprehensive testing approach at each phase
6. **Deployment Planning** - Production rollout and monitoring strategy

### Agile Strategy
1. **Epic Breakdown** - Convert PRD into user stories and epics
2. **Sprint Planning** - Organize work into iterative sprints
3. **MVP Definition** - Identify minimum viable product scope
4. **Iterative Development** - Plan for continuous delivery and feedback
5. **Stakeholder Engagement** - Regular review and adjustment cycles
6. **Retrospective Planning** - Built-in improvement and learning cycles

### MVP Strategy
1. **Core Feature Identification** - Strip down to essential functionality
2. **Rapid Prototyping** - Focus on quick validation and feedback
3. **Technical Debt Planning** - Identify shortcuts and future improvements
4. **Validation Metrics** - Define success criteria and measurement
5. **Scaling Roadmap** - Plan for post-MVP feature expansion
6. **User Feedback Integration** - Structured approach to user input

## Output Formats

### Roadmap Format (`--output roadmap`)
```
# Feature Implementation Roadmap
## Phase 1: Foundation (Week 1-2)
- [ ] Architecture design and technology selection
- [ ] Database schema design and setup
- [ ] Basic project structure and CI/CD pipeline

## Phase 2: Core Implementation (Week 3-6)
- [ ] API development and authentication
- [ ] Frontend components and user interface
- [ ] Integration testing and security validation

## Phase 3: Enhancement & Launch (Week 7-8)
- [ ] Performance optimization and load testing
- [ ] User acceptance testing and bug fixes
- [ ] Production deployment and monitoring setup
```

### Tasks Format (`--output tasks`)
```
# Implementation Tasks
## Epic: User Authentication System
### Story: User Registration
- [ ] Design registration form UI components
- [ ] Implement backend registration API
- [ ] Add email verification workflow
- [ ] Create user onboarding flow

### Story: User Login
- [ ] Design login interface
- [ ] Implement JWT authentication
- [ ] Add password reset functionality
- [ ] Set up session management
```

### Detailed Format (`--output detailed`)
```
# Detailed Implementation Workflow
## Task: Implement User Registration API
**Persona**: Backend Developer
**Estimated Time**: 8 hours
**Dependencies**: Database schema, authentication service
**MCP Context**: Express.js patterns, security best practices

### Implementation Steps:
1. **Setup API endpoint** (1 hour)
   - Create POST /api/register route
   - Add input validation middleware
   
2. **Database integration** (2 hours)
   - Implement user model
   - Add password hashing
   
3. **Security measures** (3 hours)
   - Rate limiting implementation
   - Input sanitization
   - SQL injection prevention
   
4. **Testing** (2 hours)
   - Unit tests for registration logic
   - Integration tests for API endpoint

### Acceptance Criteria:
- [ ] User can register with email and password
- [ ] Passwords are properly hashed
- [ ] Email validation is enforced
- [ ] Rate limiting prevents abuse
```

## Advanced Features

### Dependency Analysis
- **Internal Dependencies** - Identify coupling between components and features
- **External Dependencies** - Map third-party services and APIs
- **Technical Dependencies** - Framework versions, database requirements
- **Team Dependencies** - Cross-team coordination requirements
- **Infrastructure Dependencies** - Cloud services, deployment requirements

### Risk Assessment & Mitigation
- **Technical Risks** - Complexity, performance, and scalability concerns
- **Timeline Risks** - Dependency bottlenecks and resource constraints
- **Security Risks** - Data protection and compliance vulnerabilities
- **Business Risks** - Market changes and requirement evolution
- **Mitigation Strategies** - Fallback plans and alternative approaches

### Parallel Work Stream Identification
- **Independent Components** - Features that can be developed simultaneously
- **Shared Dependencies** - Common components requiring coordination
- **Critical Path Analysis** - Bottlenecks that block other work
- **Resource Allocation** - Team capacity and skill distribution
- **Communication Protocols** - Coordination between parallel streams

## Integration with SuperCode Ecosystem

### TodoWrite Integration
- Automatically creates session tasks for immediate next steps
- Provides progress tracking throughout workflow execution
- Links workflow phases to actionable development tasks

### Task Command Integration
- Converts workflow into hierarchical project tasks (`/sc:task`)
- Enables cross-session persistence and progress tracking
- Supports complex orchestration with `/sc:spawn`

### Implementation Command Integration
- Seamlessly connects to `/sc:implement` for feature development
- Provides context-aware implementation guidance
- Auto-activates appropriate personas for each workflow phase

### Analysis Command Integration
- Leverages `/sc:analyze` for codebase assessment
- Integrates existing code patterns into workflow planning
- Identifies refactoring opportunities and technical debt

## Quality Gates and Validation

### Workflow Completeness Check
- **Requirements Coverage** - Ensure all PRD requirements are addressed
- **Acceptance Criteria** - Validate testable success criteria
- **Technical Feasibility** - Assess implementation complexity and risks
- **Resource Alignment** - Match workflow to team capabilities and timeline

### Best Practices Validation
- **Architecture Patterns** - Ensure adherence to established patterns
- **Security Standards** - Validate security considerations at each phase
- **Performance Requirements** - Include performance targets and monitoring
- **Maintainability** - Plan for long-term code maintenance and updates

### Stakeholder Alignment
- **Business Requirements** - Ensure business value is clearly defined
- **Technical Requirements** - Validate technical specifications and constraints
- **Timeline Expectations** - Realistic estimation and milestone planning
- **Success Metrics** - Define measurable outcomes and KPIs

## Performance Optimization

### Workflow Generation Speed
- **PRD Parsing** - Efficient document analysis and requirement extraction
- **Pattern Recognition** - Rapid identification of common implementation patterns
- **Template Application** - Reusable workflow templates for common scenarios
- **Incremental Generation** - Progressive workflow refinement and optimization

### Context Management
- **Memory Efficiency** - Optimal context usage for large PRDs
- **Caching Strategy** - Reuse analysis results across similar workflows
- **Progressive Loading** - Load workflow details on-demand
- **Compression** - Efficient storage and retrieval of workflow data

## Success Metrics

### Workflow Quality
- **Implementation Success Rate** - >90% successful feature completion following workflows
- **Timeline Accuracy** - <20% variance from estimated timelines
- **Requirement Coverage** - 100% PRD requirement mapping to workflow tasks
- **Stakeholder Satisfaction** - >85% satisfaction with workflow clarity and completeness

### Performance Targets
- **Workflow Generation** - <30 seconds for standard PRDs
- **Dependency Analysis** - <60 seconds for complex systems
- **Risk Assessment** - <45 seconds for comprehensive evaluation
- **Context Integration** - <10 seconds for MCP server coordination

## SuperCode Integration
- **Multi-Tool Orchestration** - Coordinates Read, Write, Edit, Glob, Grep for comprehensive analysis
- **Progressive Task Creation** - Uses TodoWrite for immediate next steps and Task for long-term planning
- **MCP Server Coordination** - Intelligent routing to Context7, Sequential, and Magic based on workflow needs
- **Cross-Command Integration** - Seamless handoff to implement, analyze, design, and other SuperCode commands
- **Evidence-Based Planning** - Maintains audit trail of decisions and rationale throughout workflow generation 

---

/sc:workflow $ARGUMENTS