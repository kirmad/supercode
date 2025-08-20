# Custom Commands Examples

## Overview

This document provides a comprehensive collection of ready-to-use custom commands covering common development workflows, team collaboration, and productivity patterns.

## Development Workflow Commands

### Code Analysis and Review

**File**: `.opencode/commands/dev/review.md`
```markdown
---
description: "Comprehensive code review with focus areas"
args: ["--security", "--performance", "--style", "--tests", "--docs"]
examples:
  - "/dev:review --security auth.ts"
  - "/dev:review --performance database queries"
  - "/dev:review --style components/"
  - "/dev:review --tests --docs user-service.ts"
tags: ["development", "code-review", "quality"]
author: "Development Team"
---

# Code Review

Please perform a thorough code review of {{args}}.

## Review Focus Areas

### Core Analysis
- **Correctness**: Logic errors, edge cases, algorithm efficiency
- **Maintainability**: Code clarity, structure, documentation
- **Standards**: Coding conventions, naming, organization

### Specialized Focus (based on flags)

**--security**: Security-focused review
- Authentication and authorization flaws
- Input validation and sanitization
- Sensitive data exposure
- OWASP Top 10 vulnerabilities
- Dependency security issues

**--performance**: Performance optimization review
- Algorithm complexity analysis
- Database query optimization
- Memory usage patterns
- Caching opportunities
- Bottleneck identification

**--style**: Code style and conventions
- Consistent formatting and indentation
- Naming conventions adherence
- Code organization and structure
- Documentation completeness
- Dead code elimination

**--tests**: Test coverage and quality
- Unit test completeness
- Integration test scenarios
- Edge case coverage
- Mock usage appropriateness
- Test maintainability

**--docs**: Documentation review
- API documentation accuracy
- Code comments clarity
- README completeness
- Architecture documentation
- Usage examples

## Review Checklist
- [ ] Code builds without warnings
- [ ] All tests pass
- [ ] No obvious bugs or logic errors
- [ ] Performance implications considered
- [ ] Security best practices followed
- [ ] Code style consistent
- [ ] Adequate test coverage
- [ ] Documentation updated

Please provide specific, actionable feedback with examples and suggestions for improvement.
```

**File**: `.opencode/commands/dev/analyze.md`
```markdown
---
description: "Deep architectural and code analysis"
examples:
  - "/dev:analyze user authentication system"
  - "/dev:analyze API rate limiting implementation"
tags: ["analysis", "architecture", "debugging"]
---

# Code Analysis

Please perform a comprehensive analysis of {{args}}.

## Analysis Framework

### 1. Architecture Review
- **Design Patterns**: What patterns are used? Are they appropriate?
- **Separation of Concerns**: Are responsibilities clearly divided?
- **Dependencies**: How are dependencies managed and injected?
- **Coupling**: Is the code loosely coupled and highly cohesive?

### 2. Quality Assessment
- **Complexity**: Are there overly complex functions or classes?
- **Duplication**: Is there code duplication that should be abstracted?
- **Naming**: Are names clear, consistent, and meaningful?
- **Comments**: Is the code self-documenting with appropriate comments?

### 3. Performance Analysis
- **Efficiency**: Are there performance bottlenecks or inefficiencies?
- **Scalability**: How will this perform under load?
- **Resource Usage**: Are resources (memory, CPU, I/O) used efficiently?
- **Caching**: Are there appropriate caching strategies?

### 4. Security Review
- **Vulnerabilities**: Are there potential security issues?
- **Input Validation**: Is input properly validated and sanitized?
- **Authentication**: Are auth mechanisms properly implemented?
- **Data Protection**: Is sensitive data properly handled?

### 5. Maintainability
- **Testability**: Is the code easy to test?
- **Modularity**: Can components be easily modified or replaced?
- **Documentation**: Is the code well-documented?
- **Error Handling**: Are errors properly handled and logged?

## Output Format
Please provide:
1. **Executive Summary**: High-level assessment
2. **Detailed Findings**: Specific issues with severity levels
3. **Recommendations**: Prioritized improvement suggestions
4. **Code Examples**: Before/after examples for key recommendations

Focus on actionable insights that will improve code quality, performance, and maintainability.
```

### Implementation and Development

**File**: `.opencode/commands/dev/implement.md`
```markdown
---
description: "Implement features with systematic approach"
args: ["--tdd", "--docs", "--tests", "--security", "--performance"]
examples:
  - "/dev:implement --tdd user registration system"
  - "/dev:implement --security --tests OAuth integration"
  - "/dev:implement --performance --docs caching layer"
tags: ["implementation", "development", "tdd"]
---

# Feature Implementation

Please implement {{args}} following our development standards.

## Implementation Approach

### 1. Requirements Analysis
- **Functional Requirements**: What must the feature do?
- **Non-Functional Requirements**: Performance, security, scalability needs
- **Acceptance Criteria**: How will we know it's complete?
- **Dependencies**: What other systems or components are involved?

### 2. Design Planning
- **Architecture**: How does this fit into the existing system?
- **API Design**: What interfaces will be exposed?
- **Data Model**: What data structures are needed?
- **Integration Points**: How will this connect with other components?

### 3. Implementation Strategy

**Default Approach**:
1. Create core functionality
2. Add error handling
3. Implement validation
4. Write tests
5. Add documentation

**--tdd**: Test-Driven Development
1. Write failing tests first
2. Implement minimal code to pass
3. Refactor for quality
4. Repeat cycle

**--security**: Security-First Implementation
1. Identify security requirements
2. Implement secure defaults
3. Add input validation
4. Include authentication/authorization
5. Security testing

**--performance**: Performance-Optimized Implementation
1. Profile current performance
2. Identify bottlenecks
3. Implement optimizations
4. Measure improvements
5. Document performance characteristics

**--docs**: Documentation-Driven Implementation
1. Write API documentation first
2. Create usage examples
3. Document architectural decisions
4. Include troubleshooting guides

**--tests**: Comprehensive Testing
1. Unit tests for core logic
2. Integration tests for components
3. End-to-end tests for workflows
4. Performance tests if relevant
5. Security tests for sensitive features

## Quality Standards
- [ ] Code follows project conventions
- [ ] Comprehensive error handling
- [ ] Input validation and sanitization
- [ ] Appropriate logging
- [ ] Security best practices
- [ ] Performance considerations
- [ ] Test coverage ≥80%
- [ ] Documentation updated

## Deliverables
1. **Working Code**: Fully functional implementation
2. **Tests**: Comprehensive test suite
3. **Documentation**: API docs, usage examples, troubleshooting
4. **Migration Guide**: If database changes required
5. **Deployment Notes**: Any special deployment considerations

Please implement incrementally, showing progress at each step.
```

**File**: `.opencode/commands/dev/fix.md`
```markdown
---
description: "Systematic bug fixing and debugging"
args: ["--urgent", "--regression", "--security"]
examples:
  - "/dev:fix --urgent login system crashes on invalid input"
  - "/dev:fix --regression API returns 500 after recent deployment"
  - "/dev:fix --security user data exposed in logs"
---

# Bug Fix

I need help fixing this issue: {{args}}

## Debugging Process

### 1. Issue Analysis
- **Symptoms**: What is the observed behavior?
- **Expected**: What should happen instead?
- **Scope**: How widespread is the issue?
- **Impact**: Who/what is affected?

### 2. Reproduction
- **Steps to Reproduce**: Minimum steps to trigger the bug
- **Environment**: Where does this occur (dev/staging/prod)?
- **Frequency**: How often does this happen?
- **Conditions**: What conditions are necessary?

### 3. Investigation
- **Recent Changes**: What changed recently that might cause this?
- **Logs**: What do the logs show?
- **Error Messages**: Any specific error messages?
- **Stack Traces**: Full stack traces for exceptions

### 4. Root Cause Analysis
- **Hypothesis**: What do we think is causing this?
- **Testing**: How can we verify our hypothesis?
- **Evidence**: What evidence supports our conclusion?

### 5. Solution Design
- **Fix Strategy**: How should we resolve this?
- **Side Effects**: What else might this change affect?
- **Testing**: How will we verify the fix works?
- **Rollback Plan**: How can we revert if needed?

## Priority Handling

**--urgent**: Critical Production Issue
- Immediate investigation required
- Consider hotfix deployment
- Focus on fastest safe resolution
- Document thoroughly for post-mortem

**--regression**: Recently Introduced Bug
- Identify recent changes that might have caused this
- Consider reverting problematic changes
- Add regression tests to prevent recurrence

**--security**: Security Vulnerability
- Assess severity and exposure
- Implement fix without revealing vulnerability details
- Consider immediate mitigation measures
- Follow security disclosure process

## Fix Implementation
1. **Implement Fix**: Make minimal necessary changes
2. **Add Tests**: Prevent regression
3. **Verify Fix**: Test in multiple environments
4. **Document**: Update relevant documentation
5. **Monitor**: Watch for any side effects

Please guide me through each step systematically.
```

## Testing and Quality Assurance

**File**: `.opencode/commands/qa/test.md`
```markdown
---
description: "Comprehensive testing strategy and implementation"
args: ["--unit", "--integration", "--e2e", "--performance", "--security"]
examples:
  - "/qa:test --unit user service functions"
  - "/qa:test --integration --e2e checkout flow"
  - "/qa:test --performance API endpoints"
  - "/qa:test --security authentication system"
---

# Testing Strategy

Please create comprehensive tests for {{args}}.

## Testing Pyramid

### Unit Tests (--unit or default)
**Scope**: Individual functions, methods, classes
**Focus**: Logic correctness, edge cases, error handling

**Test Structure**:
```
describe('ComponentName', () => {
  describe('method', () => {
    it('should handle normal case', () => {})
    it('should handle edge case', () => {})  
    it('should throw error for invalid input', () => {})
  })
})
```

**Coverage Areas**:
- Happy path scenarios
- Edge cases and boundary conditions
- Error conditions and exceptions
- Input validation
- State changes
- Return values

### Integration Tests (--integration)
**Scope**: Component interactions, API endpoints, database operations
**Focus**: Interface contracts, data flow, system integration

**Test Areas**:
- API endpoints with real/mock databases
- Service layer interactions
- External service integrations
- Database queries and transactions
- File system operations
- Network communications

### End-to-End Tests (--e2e)
**Scope**: Complete user workflows, system behavior
**Focus**: User experience, business process validation

**Test Scenarios**:
- Critical user journeys
- Cross-browser compatibility
- Mobile responsiveness
- Performance under load
- Error recovery flows

### Performance Tests (--performance)
**Scope**: System performance, scalability, resource usage
**Focus**: Response times, throughput, resource efficiency

**Test Types**:
- Load testing: Normal usage patterns
- Stress testing: Peak/extreme conditions
- Volume testing: Large data sets
- Spike testing: Sudden load increases
- Endurance testing: Extended periods

**Metrics to Track**:
- Response times (avg, median, 95th percentile)
- Throughput (requests per second)
- Resource utilization (CPU, memory, disk)
- Error rates under load
- Recovery time after failures

### Security Tests (--security)
**Scope**: Vulnerabilities, attack vectors, data protection
**Focus**: OWASP Top 10, authentication, authorization

**Test Categories**:
- Input validation and injection attacks
- Authentication bypass attempts
- Authorization and access control
- Session management
- Data encryption and storage
- API security
- Dependency vulnerabilities

## Test Implementation Guidelines

### Test Structure and Organization
```
tests/
├── unit/           # Unit tests mirroring src structure
├── integration/    # Integration tests by feature
├── e2e/           # End-to-end test scenarios
├── performance/   # Performance test suites
├── security/      # Security test cases
├── fixtures/      # Test data and mocks
└── utils/         # Testing utilities and helpers
```

### Test Quality Standards
- [ ] Tests are isolated and independent
- [ ] Tests are deterministic and repeatable
- [ ] Test names clearly describe what is being tested
- [ ] Tests focus on behavior, not implementation
- [ ] Appropriate use of mocks and stubs
- [ ] Tests run quickly (unit tests <1s each)
- [ ] Good test data management
- [ ] Clear assertions and error messages

### Coverage Requirements
- **Unit Tests**: 85% minimum code coverage
- **Integration Tests**: All API endpoints and critical paths
- **E2E Tests**: All major user workflows
- **Performance Tests**: All public APIs and critical operations
- **Security Tests**: All authentication/authorization flows

## Test Data Management
- Use factories for creating test data
- Isolate test data between tests
- Use realistic but anonymized data
- Clean up test data after each test
- Version control test data schemas

Please create a comprehensive test suite following these guidelines.
```

**File**: `.opencode/commands/qa/review.md`
```markdown
---
description: "Quality assurance review and checklist"
args: ["--checklist", "--automated", "--manual"]
examples:
  - "/qa:review --checklist new feature deployment"
  - "/qa:review --automated CI/CD pipeline"
  - "/qa:review --manual user interface changes"
---

# Quality Assurance Review

Please conduct a QA review of {{args}}.

## QA Review Framework

### 1. Functional Testing
- [ ] **Feature Completeness**: All requirements implemented
- [ ] **User Workflows**: End-to-end scenarios work correctly
- [ ] **Input Validation**: Proper handling of all input types
- [ ] **Error Handling**: Graceful error messages and recovery
- [ ] **Data Integrity**: Data is accurate and consistent
- [ ] **Business Logic**: Rules and calculations are correct

### 2. Non-Functional Testing
- [ ] **Performance**: Meets response time requirements
- [ ] **Scalability**: Handles expected load
- [ ] **Security**: No vulnerabilities or data exposure
- [ ] **Usability**: Intuitive and user-friendly
- [ ] **Accessibility**: WCAG compliance
- [ ] **Compatibility**: Works across browsers/devices

### 3. Integration Testing
- [ ] **API Integration**: External services work correctly
- [ ] **Database**: CRUD operations function properly
- [ ] **Third-party Services**: All integrations tested
- [ ] **Cross-platform**: Works on all target platforms
- [ ] **Backward Compatibility**: Doesn't break existing functionality

### 4. Regression Testing
- [ ] **Existing Features**: No regressions in current functionality
- [ ] **Previous Bug Fixes**: Fixed bugs remain fixed
- [ ] **Core Workflows**: Critical paths still work
- [ ] **Data Migration**: Historical data preserved

## Review Types

### --checklist: Comprehensive Checklist Review
**Pre-deployment Checklist**:
- [ ] Code reviewed and approved
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring/alerting configured
- [ ] Feature flags configured
- [ ] Stakeholder approval received

**Post-deployment Verification**:
- [ ] Application starts successfully
- [ ] Health checks passing
- [ ] Key metrics within normal range
- [ ] No error spikes in logs
- [ ] User workflows functioning
- [ ] Database performance normal
- [ ] Third-party integrations working

### --automated: Automated Testing Review
**CI/CD Pipeline Verification**:
- [ ] Build process successful
- [ ] Unit tests: 100% passing, >85% coverage
- [ ] Integration tests: All scenarios covered
- [ ] Security scans: No high/critical issues
- [ ] Performance tests: Within SLA bounds
- [ ] Code quality gates: Met or exceeded
- [ ] Dependency checks: No vulnerable packages
- [ ] Container scans: Secure base images

**Automation Coverage**:
- [ ] Test automation covers critical paths
- [ ] Deployment automation tested
- [ ] Rollback automation verified
- [ ] Monitoring automation working
- [ ] Backup automation tested

### --manual: Manual Testing Review
**Exploratory Testing**:
- [ ] User interface testing
- [ ] Usability testing
- [ ] Edge case exploration
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Accessibility testing
- [ ] User acceptance testing

**Manual Test Scenarios**:
1. **Happy Path Testing**: Primary user workflows
2. **Edge Case Testing**: Boundary conditions and limits
3. **Error Path Testing**: How system handles failures
4. **Integration Testing**: Real-world usage scenarios
5. **Usability Testing**: User experience evaluation

## Quality Gates

### Minimum Requirements (Must Pass)
- All automated tests passing
- Security scan: No critical vulnerabilities
- Performance: Meets SLA requirements
- Code review: Approved by senior developer
- Documentation: Updated and accurate

### Quality Thresholds
- **Code Coverage**: ≥85% for new code
- **Performance**: <200ms API response time
- **Security**: Zero high/critical vulnerabilities
- **Bugs**: Zero critical, <3 high priority
- **User Acceptance**: >90% positive feedback

## Risk Assessment

### High Risk Areas
- Authentication and authorization
- Payment processing
- Data migration
- Third-party integrations
- Performance-critical operations

### Risk Mitigation
- Extra testing for high-risk areas
- Gradual rollout for risky changes
- Immediate rollback capability
- Enhanced monitoring
- Clear escalation procedures

Please provide a comprehensive QA assessment with specific recommendations for improvement.
```

## Team Collaboration Commands

### Meeting and Planning

**File**: `.opencode/commands/team/standup.md`
```markdown
---
description: "Generate daily standup updates"
examples:
  - "/team:standup worked on auth system, blocked by API changes"
  - "/team:standup completed user stories 123-125, testing deployment"
tags: ["standup", "meetings", "agile"]
---

# Daily Standup Update

Please help me create a structured standup update based on: {{args}}

## Standup Format

### Yesterday
**What I completed:**
- [Extract completed work from context]
- [Include any blocked items that got unblocked]
- [Mention any significant discoveries or insights]

### Today  
**What I'm planning to work on:**
- [Identify current priorities from context]
- [Include any follow-up items from yesterday]
- [Note any meetings or collaboration planned]

### Blockers
**What's preventing progress:**
- [Identify any impediments mentioned]
- [Include resource constraints or dependencies]
- [Note any decisions needed from others]

## Additional Context
- **Sprint Goal Progress**: How does this contribute to our sprint goal?
- **Team Dependencies**: Any work that affects other team members?
- **Risks/Concerns**: Anything the team should be aware of?

## Communication Guidelines
- Be specific about accomplishments and plans
- Clearly identify blockers and who can help
- Keep it concise but informative
- Focus on work that affects the team or sprint goal

Please format this professionally for sharing with the team, and suggest any follow-up conversations that might be needed.
```

**File**: `.opencode/commands/team/retrospective.md`
```markdown
---
description: "Structure sprint retrospective input"
args: ["--positive", "--improvements", "--actions"]
examples:
  - "/team:retrospective this sprint we improved deployment speed"
  - "/team:retrospective --positive great collaboration on complex features"
  - "/team:retrospective --improvements communication gaps between teams"
tags: ["retrospective", "agile", "improvement"]
---

# Sprint Retrospective

Help me organize retrospective feedback about: {{args}}

## Retrospective Framework

### What Went Well ✅
**Successes and positive outcomes:**
- [Identify successful practices, achievements, good collaborations]
- [Note any process improvements that worked]
- [Highlight individual or team contributions]
- [Recognize learning and growth moments]

### What Could Be Improved 🔄
**Areas for enhancement:**
- [Process inefficiencies or bottlenecks]
- [Communication or collaboration challenges]
- [Technical debt or quality issues]
- [Resource or tooling limitations]

### Action Items 🎯
**Concrete steps for improvement:**
- [Specific, actionable improvements]
- [Process changes to implement]
- [Tools or resources needed]
- [Who will own each action item]

## Retrospective Categories

### Process & Workflow
- Sprint planning effectiveness
- Daily standup quality
- Code review process
- Deployment and release process
- Documentation practices

### Collaboration & Communication
- Team coordination
- Cross-team dependencies
- Stakeholder communication
- Knowledge sharing
- Meeting effectiveness

### Technical & Quality
- Code quality and standards
- Technical debt management
- Testing and QA processes
- Tool effectiveness
- Performance and scalability

### Individual & Growth
- Skill development opportunities
- Workload distribution
- Learning and experimentation
- Career development support

## Facilitation Notes

**Flag-specific Focus:**

**--positive**: Emphasize successes and achievements
- Celebrate team wins and individual contributions
- Identify practices to continue and amplify
- Build team morale and confidence
- Recognize learning and growth

**--improvements**: Focus on constructive feedback
- Identify process gaps and inefficiencies
- Address collaboration challenges
- Highlight technical or quality concerns
- Suggest specific improvements

**--actions**: Generate actionable next steps
- Create SMART action items (Specific, Measurable, Achievable, Relevant, Time-bound)
- Assign ownership and timelines
- Prioritize based on impact and effort
- Plan follow-up and measurement

Please help me structure this feedback constructively for our team retrospective, ensuring it's balanced and leads to actionable improvements.
```

### Documentation and Knowledge Sharing

**File**: `.opencode/commands/docs/api.md`
```markdown
---
description: "Generate comprehensive API documentation"
args: ["--openapi", "--examples", "--auth", "--errors"]
examples:
  - "/docs:api --openapi user authentication endpoints"
  - "/docs:api --examples --auth user profile API"
  - "/docs:api --errors payment processing endpoints"
tags: ["documentation", "api", "openapi"]
---

# API Documentation

Please create comprehensive API documentation for {{args}}.

## Documentation Structure

### 1. API Overview
- **Purpose**: What does this API accomplish?
- **Base URL**: API endpoint base URL
- **Version**: API version and versioning strategy
- **Authentication**: Authentication requirements and methods
- **Rate Limits**: Usage limitations and throttling
- **Content Types**: Supported request/response formats

### 2. Endpoints Documentation

For each endpoint, include:

#### Endpoint Summary
- **Method**: GET, POST, PUT, DELETE, PATCH
- **URL**: Full endpoint path with parameters
- **Description**: Brief description of functionality
- **Authentication**: Required authentication level

#### Request Details
- **Path Parameters**: URL path variables
- **Query Parameters**: Optional and required query string parameters
- **Headers**: Required and optional headers
- **Request Body**: Schema and examples

#### Response Details
- **Status Codes**: All possible HTTP status codes
- **Response Headers**: Important response headers
- **Response Body**: Schema and examples for each status code
- **Error Responses**: Detailed error format and codes

### 3. Special Focus Areas

#### --openapi: OpenAPI/Swagger Specification
Generate complete OpenAPI 3.0 specification including:
```yaml
openapi: 3.0.0
info:
  title: API Name
  version: 1.0.0
  description: API description
servers:
  - url: https://api.example.com/v1
paths:
  /endpoint:
    get:
      summary: Description
      parameters: []
      responses:
        '200':
          description: Success response
components:
  schemas: {}
  securitySchemes: {}
```

#### --examples: Comprehensive Examples
Include practical examples:
- **cURL commands** for each endpoint
- **Request/response pairs** for different scenarios
- **Code samples** in multiple languages (JavaScript, Python, Go, etc.)
- **Postman collection** or similar
- **SDK usage examples** if available

#### --auth: Authentication Details
Detailed authentication documentation:
- **Authentication methods**: API keys, JWT, OAuth, etc.
- **Token acquisition**: How to obtain and refresh tokens
- **Token usage**: Where and how to include tokens in requests
- **Permission levels**: What each authentication level allows
- **Security best practices**: Token storage and handling

#### --errors: Error Handling
Comprehensive error documentation:
- **Error response format**: Standard error object structure
- **Error codes**: All possible error codes with descriptions
- **Error categories**: Client errors (4xx) vs server errors (5xx)
- **Error handling**: How clients should handle different errors
- **Troubleshooting**: Common issues and solutions

### 4. Additional Sections

#### Getting Started
- **Quick start guide** with basic examples
- **SDKs and libraries** available
- **Postman collection** or other tools
- **Sandbox environment** for testing

#### Advanced Usage
- **Pagination** for list endpoints
- **Filtering and sorting** options
- **Bulk operations** if supported
- **Webhooks** if available
- **Real-time features** (WebSockets, SSE)

#### Reference
- **Data models** and schemas
- **Enumerations** and constants
- **Changelog** and version history
- **Migration guides** for version updates

## Quality Standards
- [ ] All endpoints documented with examples
- [ ] Authentication clearly explained
- [ ] Error responses comprehensive
- [ ] Code examples tested and working
- [ ] OpenAPI spec validates if requested
- [ ] Consistent formatting and terminology
- [ ] Up-to-date with current implementation
- [ ] Includes troubleshooting guidance

Please ensure the documentation is developer-friendly, comprehensive, and includes practical examples for all use cases.
```

**File**: `.opencode/commands/docs/readme.md`
```markdown
---
description: "Create comprehensive README documentation"
args: ["--getting-started", "--architecture", "--deployment"]
examples:
  - "/docs:readme --getting-started new React component library"
  - "/docs:readme --architecture --deployment microservice project"
tags: ["documentation", "readme", "project"]
---

# README Documentation

Please create a comprehensive README.md for {{args}}.

## README Structure

### 1. Project Header
```markdown
# Project Name

Brief description of what this project does and why it's useful.

[![Build Status](badge-url)](build-url)
[![Coverage Status](badge-url)](coverage-url)
[![License](badge-url)](license-url)

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)
```

### 2. Core Sections

#### Project Overview
- **Purpose**: What problem does this solve?
- **Key Features**: Main functionality and benefits
- **Status**: Development stage, stability, maintenance status
- **Requirements**: System requirements and dependencies

#### Installation
- **Prerequisites**: Required software, versions, environment setup
- **Installation Steps**: Detailed installation instructions
- **Verification**: How to verify installation was successful
- **Troubleshooting**: Common installation issues

#### Quick Start
- **Minimal Example**: Simple working example
- **Expected Output**: What users should see
- **Next Steps**: Links to more detailed documentation

#### Usage
- **Basic Usage**: Common use cases with examples
- **Configuration**: Configuration options and files
- **CLI Commands**: If applicable, all available commands
- **API Usage**: If library, basic API usage patterns

### 3. Specialized Sections (based on flags)

#### --getting-started: Beginner-Friendly Guide
**Extended Getting Started Section**:
- Step-by-step tutorial with screenshots
- Common use case walkthrough
- Troubleshooting for beginners
- Links to additional learning resources
- FAQ section for common questions

**Tutorial Structure**:
1. **Setup**: Environment preparation
2. **First Steps**: Basic functionality
3. **Common Tasks**: Typical usage patterns
4. **Advanced Features**: Power user features
5. **Best Practices**: Recommended approaches

#### --architecture: Technical Architecture
**Architecture Documentation**:
- **System Overview**: High-level architecture diagram
- **Component Structure**: Main components and their relationships
- **Data Flow**: How data moves through the system
- **Technology Stack**: Languages, frameworks, databases, tools
- **Design Decisions**: Key architectural choices and rationale

**Technical Details**:
- **Directory Structure**: Project organization
- **Module Dependencies**: Dependency graph and explanations
- **Database Schema**: If applicable, data models
- **API Design**: If applicable, API architecture principles
- **Performance Considerations**: Scalability and optimization notes

#### --deployment: Deployment Guide
**Deployment Documentation**:
- **Environment Setup**: Production environment requirements
- **Configuration**: Environment variables and configuration files
- **Build Process**: How to build for production
- **Deployment Steps**: Detailed deployment procedures
- **Monitoring**: Health checks and monitoring setup

**Infrastructure**:
- **Server Requirements**: Hardware and software requirements
- **Dependencies**: External services and databases
- **Security**: Security considerations and best practices
- **Backup**: Backup and recovery procedures
- **Scaling**: How to scale the application

### 4. Standard Sections

#### Contributing
- **Code of Conduct**: Behavioral expectations
- **Development Setup**: How to set up for development
- **Contribution Process**: How to submit changes
- **Testing**: How to run and write tests
- **Documentation**: How to update documentation

#### API Reference
- **Core APIs**: Main functions/methods with examples
- **Configuration**: All configuration options
- **Error Handling**: Error types and handling
- **Examples**: Comprehensive usage examples

#### Changelog
- **Version History**: Major changes by version
- **Breaking Changes**: Important compatibility notes
- **Upgrade Guide**: How to upgrade between versions

#### License and Credits
- **License**: License information
- **Contributors**: Acknowledgments
- **Dependencies**: Third-party acknowledgments

## Quality Standards
- [ ] Clear, concise writing
- [ ] Working code examples
- [ ] Proper markdown formatting
- [ ] Current and accurate information
- [ ] Comprehensive but not overwhelming
- [ ] Good visual hierarchy with headers
- [ ] Links work and are relevant
- [ ] Screenshots/diagrams where helpful

## Template Sections

### Badges
Include relevant badges for:
- Build status
- Test coverage  
- Package version
- License
- Download count
- Documentation status

### Code Examples
Use proper markdown code blocks with syntax highlighting:
```javascript
// Example code here
```

### Visual Elements
- Architecture diagrams
- Screenshots of key features
- Flowcharts for complex processes
- Tables for configuration options

Please create a README that serves both new users getting started and experienced developers looking for reference information.
```

## Security and Performance Commands

**File**: `.opencode/commands/security/audit.md`
```markdown
---
description: "Comprehensive security audit and vulnerability assessment"
args: ["--owasp", "--dependencies", "--code", "--infrastructure"]
examples:
  - "/security:audit --owasp web application authentication"
  - "/security:audit --dependencies package.json vulnerabilities"
  - "/security:audit --code --infrastructure deployment pipeline"
tags: ["security", "audit", "vulnerability", "owasp"]
---

# Security Audit

Please perform a comprehensive security audit of {{args}}.

## Security Audit Framework

### 1. Threat Modeling
- **Assets**: What are we protecting?
- **Threats**: What are the potential attack vectors?
- **Vulnerabilities**: What weaknesses exist?
- **Impact**: What's the potential damage?
- **Likelihood**: How probable are these threats?

### 2. Security Assessment Areas

#### Application Security
- **Authentication**: Login mechanisms, session management
- **Authorization**: Access control, permission systems
- **Input Validation**: SQL injection, XSS, command injection
- **Output Encoding**: Data sanitization, encoding
- **Session Management**: Token security, session lifecycle
- **Error Handling**: Information disclosure, error messages

#### Data Security
- **Data Classification**: Sensitive data identification
- **Encryption**: Data at rest and in transit
- **Data Storage**: Database security, backup security
- **Data Access**: Who can access what data
- **Data Retention**: Data lifecycle and deletion
- **Privacy Compliance**: GDPR, CCPA, other regulations

#### Infrastructure Security
- **Server Hardening**: OS configuration, unnecessary services
- **Network Security**: Firewalls, network segmentation
- **Container Security**: Docker/Kubernetes security
- **Cloud Security**: AWS/Azure/GCP configuration
- **Monitoring**: Logging, intrusion detection
- **Backup Security**: Backup encryption and testing

### 3. Specialized Audits (based on flags)

#### --owasp: OWASP Top 10 Assessment
**OWASP Top 10 2021 Check**:

1. **A01 Broken Access Control**
   - [ ] Proper authorization checks on all endpoints
   - [ ] No privilege escalation vulnerabilities
   - [ ] Access controls enforced server-side
   - [ ] Default deny access control policy

2. **A02 Cryptographic Failures**
   - [ ] Strong encryption algorithms used
   - [ ] Proper key management
   - [ ] No sensitive data in transit unencrypted
   - [ ] No hardcoded secrets or weak keys

3. **A03 Injection**
   - [ ] Parameterized queries/prepared statements
   - [ ] Input validation on all user inputs
   - [ ] No command injection vulnerabilities
   - [ ] SQL/NoSQL injection prevention

4. **A04 Insecure Design**
   - [ ] Security requirements defined
   - [ ] Threat modeling performed
   - [ ] Secure design principles followed
   - [ ] Security patterns implemented

5. **A05 Security Misconfiguration**
   - [ ] Secure default configurations
   - [ ] No unnecessary features enabled
   - [ ] Security headers configured
   - [ ] Error messages don't leak information

6. **A06 Vulnerable Components**
   - [ ] All components up to date
   - [ ] No known vulnerable dependencies
   - [ ] Regular security updates applied
   - [ ] Component inventory maintained

7. **A07 Identification and Authentication**
   - [ ] Strong authentication mechanisms
   - [ ] Session management secure
   - [ ] Multi-factor authentication where appropriate
   - [ ] Password policies enforced

8. **A08 Software and Data Integrity**
   - [ ] Code integrity verification
   - [ ] Secure CI/CD pipeline
   - [ ] Digital signatures where appropriate
   - [ ] Supply chain security

9. **A09 Security Logging and Monitoring**
   - [ ] Comprehensive security logging
   - [ ] Real-time monitoring
   - [ ] Incident response procedures
   - [ ] Log integrity protection

10. **A10 Server-Side Request Forgery**
    - [ ] Input validation for URLs
    - [ ] Network segmentation
    - [ ] Whitelist allowed destinations
    - [ ] No blind SSRF vulnerabilities

#### --dependencies: Dependency Vulnerability Scan
**Dependency Security Assessment**:
- [ ] **Vulnerability Scanning**: Use npm audit, Snyk, or similar tools
- [ ] **License Compliance**: Check for license conflicts
- [ ] **Outdated Packages**: Identify packages needing updates
- [ ] **Malicious Packages**: Check for suspicious dependencies
- [ ] **Supply Chain**: Verify package integrity and sources
- [ ] **Transitive Dependencies**: Audit indirect dependencies
- [ ] **Security Policies**: Establish dependency approval process

**Assessment Process**:
1. Generate dependency tree
2. Run automated vulnerability scanners
3. Review security advisories
4. Check for known malicious packages
5. Analyze license compatibility
6. Create update/replacement plan

#### --code: Source Code Security Review
**Static Analysis Security Testing (SAST)**:
- [ ] **Code Quality**: Security-relevant code quality issues
- [ ] **Injection Flaws**: SQL, command, LDAP injection
- [ ] **XSS Prevention**: Output encoding, input validation
- [ ] **Authentication**: Secure authentication implementation
- [ ] **Session Management**: Secure session handling
- [ ] **Error Handling**: No information disclosure
- [ ] **Cryptography**: Proper use of crypto libraries
- [ ] **Input Validation**: Comprehensive input checking

**Manual Code Review Focus**:
- Authentication and authorization logic
- Cryptographic implementations
- Input validation routines
- Error handling procedures
- Security-sensitive business logic

#### --infrastructure: Infrastructure Security Review
**Infrastructure Security Checklist**:
- [ ] **Server Hardening**: OS security configuration
- [ ] **Network Security**: Firewalls, segmentation, monitoring
- [ ] **Access Control**: SSH keys, service accounts, privileged access
- [ ] **Patch Management**: Update procedures and schedules
- [ ] **Monitoring**: Security monitoring and alerting
- [ ] **Backup Security**: Encrypted backups, tested recovery
- [ ] **Container Security**: Secure base images, runtime security
- [ ] **Cloud Security**: IAM policies, resource configuration

**Cloud Security (AWS/Azure/GCP)**:
- IAM roles and policies review
- Resource access controls
- Network security groups
- Encryption configuration
- Logging and monitoring setup
- Compliance configurations

## Security Recommendations

### Immediate Actions (Critical)
- Fix any critical vulnerabilities found
- Update vulnerable dependencies
- Implement missing authentication/authorization
- Add input validation where missing

### Short-term Improvements (1-4 weeks)
- Implement comprehensive logging
- Add security monitoring and alerting
- Update security configurations
- Improve error handling

### Long-term Enhancements (1-6 months)
- Implement security training program
- Establish security code review process
- Create incident response procedures
- Regular security assessments

## Deliverables
1. **Executive Summary**: High-level risk assessment
2. **Detailed Findings**: Vulnerabilities with CVSS scores
3. **Remediation Plan**: Prioritized action items with timelines
4. **Security Recommendations**: Best practices and improvements
5. **Compliance Assessment**: Against relevant standards (OWASP, NIST, etc.)

Please provide a thorough security assessment with specific, actionable recommendations prioritized by risk level.
```

**File**: `.opencode/commands/performance/optimize.md`
```markdown
---
description: "Performance analysis and optimization recommendations"
args: ["--profiling", "--database", "--frontend", "--api", "--infrastructure"]
examples:
  - "/performance:optimize --profiling slow user dashboard loading"
  - "/performance:optimize --database API response times over 2 seconds"
  - "/performance:optimize --frontend bundle size and loading speed"
tags: ["performance", "optimization", "profiling", "benchmarking"]
---

# Performance Optimization

Please analyze and optimize the performance of {{args}}.

## Performance Analysis Framework

### 1. Performance Baseline
- **Current Metrics**: Response times, throughput, resource usage
- **Performance Goals**: Target metrics and acceptance criteria
- **User Impact**: How performance affects user experience
- **Business Impact**: Cost of poor performance

### 2. Performance Assessment Areas

#### Response Time Analysis
- **Frontend Load Time**: Time to first byte, first contentful paint, largest contentful paint
- **API Response Time**: Average, median, 95th percentile response times
- **Database Query Time**: Query execution times and optimization opportunities
- **Third-party Services**: External service response times and reliability

#### Throughput Analysis
- **Request Volume**: Requests per second, concurrent users
- **Data Transfer**: Network bandwidth utilization
- **Transaction Rate**: Database transactions per second
- **Error Rate**: Performance degradation under load

#### Resource Utilization
- **CPU Usage**: Processor utilization patterns and bottlenecks
- **Memory Usage**: RAM consumption, memory leaks, garbage collection
- **Disk I/O**: Storage read/write patterns and optimization
- **Network I/O**: Bandwidth utilization and optimization opportunities

### 3. Specialized Optimization (based on flags)

#### --profiling: Performance Profiling and Analysis
**Profiling Strategy**:
1. **Application Profiling**: CPU, memory, I/O profiling
2. **Database Profiling**: Query analysis, index optimization
3. **Network Profiling**: Request/response analysis
4. **User Experience Profiling**: Real user monitoring (RUM)

**Profiling Tools and Techniques**:
- **Backend**: CPU profilers (pprof, perf), memory profilers
- **Frontend**: Chrome DevTools, Lighthouse, Web Vitals
- **Database**: Query analyzers, execution plan analysis
- **Network**: Network monitoring tools, CDN analytics

**Performance Bottleneck Identification**:
- [ ] Slow database queries
- [ ] Inefficient algorithms
- [ ] Memory leaks
- [ ] Network latency issues
- [ ] Blocking I/O operations
- [ ] Inefficient caching

#### --database: Database Performance Optimization
**Database Performance Analysis**:
- **Query Performance**: Slow query identification and optimization
- **Index Strategy**: Missing indexes, unused indexes, index optimization
- **Schema Design**: Normalization vs denormalization, data types
- **Connection Management**: Connection pooling, connection limits
- **Caching Strategy**: Query caching, result caching, application-level caching
- **Database Configuration**: Memory allocation, buffer sizes, query limits

**Optimization Techniques**:
1. **Query Optimization**:
   - Analyze execution plans
   - Add appropriate indexes
   - Rewrite inefficient queries
   - Use query hints where necessary

2. **Schema Optimization**:
   - Optimize data types
   - Consider denormalization for read-heavy workloads
   - Partition large tables
   - Archive old data

3. **Caching Implementation**:
   - Query result caching
   - Application-level caching
   - CDN for static content
   - Database query plan caching

#### --frontend: Frontend Performance Optimization
**Frontend Performance Metrics**:
- **Core Web Vitals**: LCP, FID, CLS scores
- **Loading Performance**: TTFB, FCP, LCP timings
- **Interactivity**: Time to Interactive, Input Delay
- **Visual Stability**: Cumulative Layout Shift

**Frontend Optimization Strategies**:
1. **Bundle Optimization**:
   - Code splitting and lazy loading
   - Tree shaking unused code
   - Minimize and compress assets
   - Optimize images and media

2. **Caching Strategy**:
   - Browser caching headers
   - Service worker implementation
   - CDN utilization
   - Application state caching

3. **Rendering Optimization**:
   - Server-side rendering (SSR)
   - Static site generation (SSG)
   - Progressive hydration
   - Virtual DOM optimization

4. **Resource Loading**:
   - Critical resource prioritization
   - Preloading important resources
   - Async/defer script loading
   - Font optimization

#### --api: API Performance Optimization
**API Performance Analysis**:
- **Endpoint Performance**: Response times by endpoint
- **Payload Size**: Request/response size optimization
- **Caching Strategy**: API response caching
- **Rate Limiting**: Optimal rate limiting configuration
- **Authentication Overhead**: Auth performance impact

**API Optimization Techniques**:
1. **Response Optimization**:
   - Minimize payload size
   - Use appropriate HTTP status codes
   - Implement response compression
   - Optimize serialization

2. **Caching Implementation**:
   - HTTP caching headers
   - Redis/Memcached for data caching
   - API gateway caching
   - Database query caching

3. **Database Integration**:
   - Efficient query patterns
   - Connection pooling
   - Batch operations
   - Async processing for heavy operations

#### --infrastructure: Infrastructure Performance Optimization
**Infrastructure Performance Areas**:
- **Server Performance**: CPU, memory, disk optimization
- **Network Performance**: Bandwidth, latency, CDN optimization
- **Load Balancing**: Distribution algorithms, health checks
- **Auto-scaling**: Scaling policies and triggers
- **Container Performance**: Docker/Kubernetes optimization
- **Cloud Optimization**: Cloud service configuration

**Infrastructure Optimization**:
1. **Server Optimization**:
   - Resource allocation optimization
   - Operating system tuning
   - Application server configuration
   - Process/thread optimization

2. **Network Optimization**:
   - CDN implementation and configuration
   - Network topology optimization
   - Bandwidth allocation
   - Load balancer optimization

3. **Scaling Strategy**:
   - Horizontal vs vertical scaling
   - Auto-scaling configuration
   - Load distribution algorithms
   - Geographic distribution

## Performance Optimization Process

### 1. Measurement and Baseline
- Establish current performance metrics
- Define performance goals and SLAs
- Set up monitoring and alerting
- Create performance benchmarks

### 2. Identify Bottlenecks
- Use profiling tools to identify hotspots
- Analyze user behavior and usage patterns
- Review system architecture for inefficiencies
- Prioritize optimization efforts by impact

### 3. Implement Optimizations
- Start with highest-impact, lowest-effort improvements
- Implement changes incrementally
- Monitor performance impact of each change
- Document optimization decisions and results

### 4. Validate and Monitor
- Verify performance improvements with benchmarks
- Monitor for performance regressions
- Set up continuous performance monitoring
- Create alerts for performance degradation

## Performance Recommendations

### Quick Wins (Immediate - 1 week)
- Enable compression and caching
- Optimize database queries with missing indexes
- Implement CDN for static assets
- Fix obvious inefficient code patterns

### Medium-term Improvements (1-4 weeks)
- Implement application-level caching
- Optimize frontend bundle size
- Database query optimization
- Infrastructure scaling improvements

### Long-term Enhancements (1-6 months)
- Architecture redesign for scalability
- Implementation of microservices if beneficial
- Advanced caching strategies
- Performance monitoring and alerting systems

## Success Metrics
- **Response Time**: Target response times achieved
- **Throughput**: Increased requests per second
- **Resource Efficiency**: Reduced CPU, memory, bandwidth usage
- **User Experience**: Improved Core Web Vitals, user satisfaction
- **Cost Optimization**: Reduced infrastructure costs
- **Scalability**: Improved ability to handle increased load

Please provide a comprehensive performance analysis with specific, measurable optimization recommendations prioritized by impact and implementation effort.
```

## Productivity and Personal Commands

**File**: `.opencode/commands/personal/learn.md`
```markdown
---
description: "Structured learning and skill development plan"
args: ["--beginner", "--intermediate", "--advanced", "--project"]
examples:
  - "/personal:learn --beginner React hooks and state management"
  - "/personal:learn --project GraphQL API with authentication"
  - "/personal:learn --advanced Kubernetes deployment strategies"
---

# Learning Plan

Please create a comprehensive learning plan for {{args}}.

## Learning Framework

### 1. Learning Assessment
- **Current Level**: What do you already know?
- **Learning Goals**: What do you want to achieve?
- **Time Available**: How much time can you dedicate?
- **Learning Style**: How do you learn best?
- **Success Criteria**: How will you know you've learned it?

### 2. Structured Learning Path

#### --beginner: Foundation Learning
**Learning Structure**:
1. **Fundamentals**: Core concepts and terminology
2. **Basic Examples**: Simple, working examples
3. **Guided Practice**: Step-by-step tutorials
4. **Common Patterns**: Frequently used approaches
5. **Troubleshooting**: Common issues and solutions

**Learning Resources**:
- Official documentation and getting started guides
- Interactive tutorials and online courses
- Video tutorials for visual learning
- Community forums and Q&A sites
- Practice exercises and coding challenges

**Learning Schedule**:
- Week 1-2: Core concepts and basic examples
- Week 3-4: Guided practice and tutorials
- Week 5-6: Building simple projects
- Week 7-8: Practice and reinforcement

#### --intermediate: Skill Building
**Learning Structure**:
1. **Advanced Concepts**: More complex features and patterns
2. **Real-world Examples**: Practical, production-like scenarios
3. **Best Practices**: Industry standards and conventions
4. **Integration**: How it works with other technologies
5. **Performance**: Optimization and scaling considerations

**Practical Application**:
- Build progressively complex projects
- Contribute to open source projects
- Code reviews and peer learning
- Technical discussions and knowledge sharing

#### --advanced: Mastery and Specialization
**Learning Structure**:
1. **Expert-level Concepts**: Advanced patterns and architectures
2. **System Design**: Large-scale implementation considerations
3. **Performance Optimization**: Advanced optimization techniques
4. **Troubleshooting**: Complex problem-solving scenarios
5. **Teaching Others**: Knowledge sharing and mentoring

**Mastery Activities**:
- Design and architect systems
- Mentor other developers
- Contribute to open source projects
- Speak at conferences or write articles
- Research and experiment with cutting-edge approaches

#### --project: Project-Based Learning
**Project Learning Structure**:
1. **Project Definition**: Clear goals and requirements
2. **Architecture Planning**: System design and technology choices
3. **Incremental Implementation**: Build in phases with learning milestones
4. **Problem-Solving**: Real challenges and solutions
5. **Reflection and Documentation**: Learning capture and sharing

**Project Ideas by Complexity**:

**Beginner Projects**:
- To-do list application
- Weather dashboard
- Simple blog or portfolio site
- Basic calculator or converter
- Contact management system

**Intermediate Projects**:
- E-commerce application
- Social media dashboard
- Task management system
- API with authentication
- Real-time chat application

**Advanced Projects**:
- Microservices architecture
- Distributed system with multiple databases
- Machine learning application
- CI/CD pipeline with monitoring
- Scalable multi-tenant application

## Learning Resources and Materials

### Documentation and References
- Official documentation and guides
- API references and specifications
- Best practices documentation
- Architecture guides and case studies

### Interactive Learning
- Online coding platforms (CodePen, JSFiddle, Repl.it)
- Interactive tutorials and courses
- Coding challenges and competitions
- Virtual labs and sandboxes

### Community and Networking
- Developer communities and forums
- Local meetups and user groups
- Online conferences and webinars
- Mentorship programs
- Code review groups

### Hands-on Practice
- Personal projects and experiments
- Open source contributions
- Code challenges and exercises
- Pair programming sessions
- Technical interviews practice

## Learning Schedule and Milestones

### Weekly Structure
- **Day 1-2**: Concept learning and reading
- **Day 3-4**: Hands-on practice and examples
- **Day 5**: Project work or application
- **Day 6**: Review and reinforcement
- **Day 7**: Rest or light review

### Milestone Tracking
- **Week 2**: Basic concepts understood
- **Week 4**: Can build simple examples
- **Week 6**: Completed first project
- **Week 8**: Confident with core features
- **Week 10**: Ready for real-world application

## Assessment and Validation

### Knowledge Validation
- Build projects that demonstrate understanding
- Explain concepts to others (rubber duck teaching)
- Take practice tests or certifications
- Participate in code reviews
- Contribute to technical discussions

### Practical Application
- Use the technology in work projects
- Contribute to open source projects
- Help others learn the technology
- Write blog posts or documentation
- Speak about the technology

### Continuous Learning
- Stay updated with latest developments
- Follow thought leaders and experts
- Participate in community discussions
- Experiment with new features and updates
- Share learnings with others

Please create a personalized learning plan with specific resources, timeline, and milestones based on my current level and goals.
```

**File**: `.opencode/commands/personal/plan.md`
```markdown
---
description: "Task and project planning with prioritization"
args: ["--urgent", "--complex", "--research", "--timeline"]
examples:
  - "/personal:plan --urgent fix critical production bug in payment system"
  - "/personal:plan --complex --timeline implement microservices architecture"
  - "/personal:plan --research evaluate new frontend framework options"
---

# Task Planning

Help me create a comprehensive plan for: {{args}}

## Planning Framework

### 1. Task Analysis
- **Objective**: What needs to be accomplished?
- **Context**: Why is this important now?
- **Constraints**: What limitations exist (time, resources, dependencies)?
- **Success Criteria**: How will we know it's done?
- **Stakeholders**: Who is involved or affected?

### 2. Requirements Gathering
- **Functional Requirements**: What must it do?
- **Non-functional Requirements**: Performance, security, usability needs
- **Technical Requirements**: Technology, platform, integration constraints
- **Business Requirements**: Budget, timeline, compliance needs
- **User Requirements**: End user needs and expectations

### 3. Planning Strategy (based on flags)

#### --urgent: Crisis Management Planning
**Immediate Action Plan**:
1. **Assessment** (0-30 minutes):
   - Understand the full scope of the urgent issue
   - Identify immediate risks and impact
   - Gather key stakeholders and resources
   - Establish communication channels

2. **Rapid Response** (30 minutes - 2 hours):
   - Implement immediate mitigation measures
   - Assign roles and responsibilities
   - Create incident timeline and status updates
   - Document decisions and actions

3. **Resolution** (2-24 hours):
   - Execute systematic fix approach
   - Test fixes in safe environment
   - Deploy fixes with minimal risk
   - Monitor for issues and side effects

4. **Follow-up** (1-7 days):
   - Conduct post-incident review
   - Implement preventive measures
   - Update processes and documentation
   - Share learnings with team

**Crisis Planning Template**:
- **Immediate Actions**: What needs to happen right now?
- **Communication Plan**: Who to notify and how?
- **Rollback Strategy**: How to revert if things go wrong?
- **Testing Strategy**: How to verify the fix works?
- **Documentation**: What needs to be recorded?

#### --complex: Complex Project Planning
**Project Breakdown Structure**:
1. **Project Scope**:
   - Define clear project boundaries
   - Identify major deliverables
   - Establish project constraints
   - Create work breakdown structure

2. **Risk Assessment**:
   - Identify potential risks and issues
   - Assess probability and impact
   - Create risk mitigation strategies
   - Plan contingency responses

3. **Resource Planning**:
   - Identify required skills and expertise
   - Estimate time and effort requirements
   - Plan resource allocation and scheduling
   - Account for dependencies and bottlenecks

4. **Implementation Strategy**:
   - Break down into manageable phases
   - Define milestone and deliverables
   - Create detailed task lists
   - Establish quality gates and reviews

**Complex Project Template**:
- **Phase 1 - Discovery**: Research, analysis, planning
- **Phase 2 - Design**: Architecture, detailed design, prototyping
- **Phase 3 - Implementation**: Development, testing, integration
- **Phase 4 - Deployment**: Release, monitoring, support
- **Phase 5 - Evaluation**: Review, optimization, lessons learned

#### --research: Research and Analysis Planning
**Research Methodology**:
1. **Research Questions**:
   - Define specific questions to answer
   - Establish research objectives
   - Identify success criteria
   - Set research boundaries

2. **Information Gathering**:
   - Identify reliable sources
   - Plan data collection methods
   - Design experiments or evaluations
   - Schedule expert interviews

3. **Analysis Framework**:
   - Define evaluation criteria
   - Create comparison matrices
   - Plan proof of concept work
   - Design validation tests

4. **Decision Making**:
   - Weight decision criteria
   - Analyze trade-offs
   - Document recommendations
   - Plan implementation strategy

**Research Planning Template**:
- **Research Goals**: What questions need answers?
- **Information Sources**: Where to find reliable information?
- **Evaluation Criteria**: How to assess options?
- **Timeline**: When do decisions need to be made?
- **Validation**: How to test assumptions?

#### --timeline: Time-Constrained Planning
**Timeline Planning Process**:
1. **Time Assessment**:
   - Available time and deadlines
   - Critical path identification
   - Buffer time allocation
   - Dependency mapping

2. **Priority Setting**:
   - Must-have vs nice-to-have features
   - Risk-based prioritization
   - Value-based prioritization
   - Effort-based prioritization

3. **Resource Optimization**:
   - Parallel work streams
   - Resource sharing opportunities
   - Automation possibilities
   - Scope reduction options

4. **Monitoring Strategy**:
   - Progress tracking methods
   - Early warning indicators
   - Course correction triggers
   - Stakeholder communication plan

## Task Decomposition

### Large Task Breakdown
1. **High-Level Phases**: Major components or stages
2. **Work Packages**: Deliverable-focused groups of tasks
3. **Individual Tasks**: Specific, actionable items
4. **Subtasks**: Detailed steps within tasks
5. **Dependencies**: Relationships between tasks

### Task Estimation
- **Time Estimation**: How long will each task take?
- **Effort Estimation**: How much work is required?
- **Resource Requirements**: What resources are needed?
- **Risk Factors**: What could cause delays?
- **Buffer Time**: Contingency for unexpected issues

## Implementation Plan

### Execution Strategy
1. **Task Sequencing**: Optimal order of execution
2. **Parallel Processing**: Tasks that can be done simultaneously
3. **Critical Path**: Tasks that cannot be delayed
4. **Quality Gates**: Review and approval points
5. **Milestone Reviews**: Progress evaluation points

### Progress Tracking
- **Status Updates**: Regular progress reporting
- **Metric Tracking**: Quantitative progress measures
- **Issue Identification**: Early problem detection
- **Course Correction**: Adjustment strategies
- **Stakeholder Communication**: Regular updates

### Risk Management
- **Risk Identification**: Potential problems and obstacles
- **Risk Assessment**: Probability and impact analysis
- **Mitigation Strategies**: Prevention and response plans
- **Contingency Plans**: Alternative approaches
- **Risk Monitoring**: Ongoing risk assessment

## Success Criteria and Validation

### Definition of Done
- **Functional Criteria**: Feature completeness and correctness
- **Quality Criteria**: Performance, security, usability standards
- **Documentation**: Required documentation and knowledge transfer
- **Testing**: Validation and verification requirements
- **Approval**: Stakeholder sign-off requirements

### Validation Plan
- **Testing Strategy**: How to verify it works
- **User Acceptance**: End user validation
- **Performance Validation**: Meets performance requirements
- **Security Validation**: Passes security requirements
- **Integration Validation**: Works with existing systems

Please create a detailed, actionable plan with specific tasks, timelines, and success criteria tailored to the complexity and urgency of this request.
```

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Create main custom-commands.md overview document", "status": "completed"}, {"id": "2", "content": "Write server-side implementation guide", "status": "completed"}, {"id": "3", "content": "Write TUI integration guide", "status": "completed"}, {"id": "4", "content": "Create user guide and examples", "status": "completed"}, {"id": "5", "content": "Write API reference documentation", "status": "in_progress"}]