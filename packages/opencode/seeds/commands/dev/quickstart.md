---
description: "Interactive project setup and initialization"
argument-hint: "[template] [--name project-name]"
examples:
  - "/dev:quickstart"
  - "/dev:quickstart react --name my-app"
  - "/dev:quickstart node --name api-server"
tags: ["development", "setup", "initialization"]
author: "OpenCode Team"
---

# Project Quickstart

Please help me set up a new project with the following requirements: $ARGUMENTS

## Quickstart Framework

### 1. Project Analysis
- **Project Type**: Identify the type of project (web app, API, library, etc.)
- **Technology Stack**: Determine appropriate technologies based on requirements
- **Project Structure**: Recommend optimal project organization
- **Dependencies**: Identify required packages and tools

### 2. Template Selection

#### React Application
- Create React app with modern tooling (Vite, TypeScript)
- Set up ESLint, Prettier, and testing framework
- Configure routing, state management if needed
- Include responsive design starter templates

#### Node.js API
- Express or Fastify server setup
- Database integration (PostgreSQL, MongoDB, etc.)
- Authentication and authorization setup
- API documentation with OpenAPI/Swagger
- Testing framework configuration

#### Python Project
- Virtual environment setup
- Flask/Django/FastAPI framework selection
- Database ORM configuration
- Testing framework setup (pytest, unittest)
- Docker containerization

#### Go Application
- Module initialization and structure
- Framework selection (Gin, Fiber, Echo)
- Database integration
- Testing setup
- Build and deployment configuration

#### Rust Project
- Cargo project initialization
- Framework selection (Axum, Warp, Actix)
- Database integration
- Testing and benchmarking setup
- Cross-compilation configuration

### 3. Project Setup Process

1. **Initialize Project Structure**
   ```bash
   mkdir $PROJECT_NAME
   cd $PROJECT_NAME
   ```

2. **Configure Package Management**
   - Initialize package.json, Cargo.toml, requirements.txt, etc.
   - Set up dependency management
   - Configure build scripts

3. **Development Environment**
   - Set up code formatting (Prettier, rustfmt, black)
   - Configure linting (ESLint, clippy, flake8)
   - Set up pre-commit hooks
   - Configure IDE/editor settings

4. **Testing Framework**
   - Unit testing setup
   - Integration testing configuration
   - Test coverage reporting
   - Continuous integration preparation

5. **Documentation**
   - README.md with project overview
   - API documentation setup
   - Code documentation standards
   - Contributing guidelines

### 4. Best Practices Implementation

#### Code Quality
- Set up automated code formatting
- Configure comprehensive linting rules
- Implement type checking where applicable
- Set up automated testing

#### Security
- Configure security linting (ESLint security, bandit, etc.)
- Set up dependency vulnerability scanning
- Implement secure defaults
- Configure environment variable management

#### Performance
- Set up performance monitoring
- Configure build optimization
- Implement caching strategies
- Set up performance testing

#### Deployment
- Container configuration (Docker)
- CI/CD pipeline setup
- Environment configuration
- Health check implementation

## Project Templates

### Web Application Starter
- Modern frontend framework (React, Vue, Svelte)
- TypeScript configuration
- Build tooling (Vite, Webpack, Rollup)
- CSS framework or styling solution
- Testing framework (Jest, Vitest, Cypress)

### API Server Starter
- RESTful API framework
- Database integration
- Authentication middleware
- API documentation
- Error handling and logging

### Full-Stack Application
- Frontend and backend integration
- Database setup and migrations
- Authentication system
- API client generation
- Deployment configuration

### Library/Package Starter
- Package configuration
- TypeScript/type definitions
- Documentation generation
- Testing framework
- Publishing configuration

## Implementation Checklist

- [ ] Project directory created
- [ ] Package management configured
- [ ] Development environment set up
- [ ] Code quality tools configured
- [ ] Testing framework installed
- [ ] Documentation structure created
- [ ] Version control initialized
- [ ] Build process configured
- [ ] Deployment preparation complete

Please provide a step-by-step setup process for my specific project requirements, including all necessary commands and configuration files.