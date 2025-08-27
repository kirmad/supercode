---
description: "Streamlined git workflow with conventional commits"
argument-hint: "[type] [message] [--scope] [--push]"
examples:
  - "/dev:gitflow feat: add user authentication"
  - "/dev:gitflow fix(api): handle null response data"
  - "/dev:gitflow docs: update README with setup instructions"
tags: ["git", "workflow", "conventional-commits"]
author: "OpenCode Team"
---

# Git Workflow Helper

Please help me execute a streamlined git workflow for: $ARGUMENTS

## Git Workflow Framework

### 1. Conventional Commits

Follow the conventional commits specification for consistent, semantic commit messages:

#### Commit Types
- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Documentation changes
- **style**: Changes that do not affect the meaning of the code (formatting, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, auxiliary tools, libraries, etc.

#### Commit Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 2. Pre-Commit Workflow

#### Code Quality Checks
1. **Lint Check**: Run linters (ESLint, Prettier, etc.)
2. **Type Check**: TypeScript compilation check
3. **Test Suite**: Run relevant tests
4. **Build Check**: Ensure project builds successfully
5. **Security Scan**: Check for security vulnerabilities

#### Git Operations
1. **Stage Changes**: Add files to staging area
2. **Pre-commit Hooks**: Run automated checks
3. **Commit Creation**: Create commit with conventional message
4. **Push Option**: Optionally push to remote repository

### 3. Workflow Execution

#### Standard Workflow
```bash
# 1. Stage changes
git add .

# 2. Run pre-commit checks
npm run lint
npm run test
npm run build

# 3. Create conventional commit
git commit -m "feat(auth): add JWT token validation"

# 4. Push to remote (if specified)
git push origin HEAD
```

#### Advanced Workflow
```bash
# 1. Check current branch and status
git status
git branch --show-current

# 2. Create feature branch if needed
git checkout -b feature/user-auth

# 3. Stage specific files
git add src/auth/ tests/auth/

# 4. Run targeted tests
npm test -- --grep="auth"

# 5. Commit with detailed message
git commit -m "feat(auth): implement JWT authentication

- Add JWT token generation and validation
- Include middleware for protected routes
- Add comprehensive test suite for auth flows
- Update API documentation with auth requirements"

# 6. Push feature branch
git push -u origin feature/user-auth
```

### 4. Branch Management

#### Branch Naming Conventions
- **Feature branches**: `feature/short-description`
- **Bug fix branches**: `fix/issue-description`
- **Hotfix branches**: `hotfix/critical-fix`
- **Release branches**: `release/version-number`
- **Documentation**: `docs/update-description`

#### Branch Workflow
1. **Create Branch**: From main/develop branch
2. **Work on Feature**: Make changes and commits
3. **Keep Updated**: Regularly merge from main/develop
4. **Test Thoroughly**: Ensure all tests pass
5. **Create PR/MR**: Submit for review
6. **Merge Strategy**: Squash merge or rebase merge

### 5. Quality Gates

#### Pre-Commit Validation
- [ ] Code follows project style guidelines
- [ ] All linting rules pass
- [ ] TypeScript compilation successful
- [ ] Unit tests pass with adequate coverage
- [ ] Integration tests pass
- [ ] Security scan shows no new vulnerabilities
- [ ] Build process completes successfully
- [ ] Documentation updated if needed

#### Commit Message Validation
- [ ] Follows conventional commit format
- [ ] Type is appropriate for the change
- [ ] Description is clear and concise
- [ ] Scope is accurate (if used)
- [ ] Breaking changes noted in footer (if applicable)

### 6. Automation Options

#### Git Hooks
```bash
# Install pre-commit hooks
npm install --save-dev husky lint-staged

# Configure pre-commit
npx husky add .husky/pre-commit "npm run pre-commit"

# Configure lint-staged
{
  "lint-staged": {
    "*.{js,ts}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"],
    "*.ts": ["tsc --noEmit"]
  }
}
```

#### CI/CD Integration
- Automated testing on push
- Build verification
- Security scanning
- Code coverage reporting
- Automated deployment on merge

### 7. Workflow Templates

#### Feature Development
```bash
# 1. Create and switch to feature branch
git checkout -b feature/new-dashboard

# 2. Make changes and test iteratively
# ... development work ...

# 3. Commit with conventional format
git add .
git commit -m "feat(dashboard): add user analytics dashboard

- Implement real-time metrics display
- Add filtering and date range selection
- Include export functionality
- Add responsive mobile layout"

# 4. Push and create PR
git push -u origin feature/new-dashboard
```

#### Bug Fix Workflow
```bash
# 1. Create bug fix branch
git checkout -b fix/login-validation

# 2. Implement fix
# ... bug fixing work ...

# 3. Add regression tests
# ... test creation ...

# 4. Commit fix with reference
git commit -m "fix(auth): resolve login validation edge case

- Handle empty email validation correctly
- Add comprehensive input validation tests
- Update error messages for clarity

Fixes #123"

# 5. Push for review
git push -u origin fix/login-validation
```

#### Hotfix Workflow
```bash
# 1. Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/security-patch

# 2. Apply critical fix
# ... hotfix implementation ...

# 3. Test thoroughly
npm run test:all
npm run security:scan

# 4. Commit with urgency marker
git commit -m "fix!: patch critical authentication vulnerability

BREAKING CHANGE: Updates authentication middleware
- Fixes token validation bypass
- Requires re-authentication for existing sessions
- Updates API version to v2.1.1"

# 5. Fast-track to production
git push -u origin hotfix/security-patch
```

## Implementation Steps

Based on your requirements, I'll help you:

1. **Analyze Current State**
   - Check git status and current branch
   - Identify changed files and their scope
   - Determine appropriate commit type

2. **Run Quality Checks**
   - Execute linting and formatting
   - Run relevant test suites
   - Verify build process

3. **Create Conventional Commit**
   - Format commit message properly
   - Include scope if applicable
   - Add detailed description if needed

4. **Push Changes**
   - Push to appropriate branch
   - Create PR/MR if needed
   - Update tracking issues

Please provide the specific changes you want to commit, and I'll guide you through the complete workflow process.