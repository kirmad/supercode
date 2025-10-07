---
description: "Implement features, components, and code functionality with expert guidance"
argument-hint: "[feature-description] [--type component|api|service|feature] [--framework react|vue|express]"
output-style: "explanatory"
examples:
  - "/sc:implement user authentication system --type service --framework express"
  - "/sc:implement data visualization dashboard --type component --framework react --with-tests"
---

# Feature Implementation: $ARGUMENTS

I'll help you implement this feature with a systematic and thorough approach.

## 1. Requirements Analysis

Let me analyze what needs to be implemented:

- Feature description: `$ARGUMENTS`
- Type: `!`echo "$ARGUMENTS" | grep -o "\-\-type \w\+" | sed "s/--type //" || echo "Not specified"`
- Framework: `!`echo "$ARGUMENTS" | grep -o "\-\-framework \w\+" | sed "s/--framework //" || echo "Not specified"`

## 2. Design Approach

I'll design a solution that is:
!`if echo "$ARGUMENTS" | grep -q "\-\-safe"; then echo "- Conservative and proven (--safe flag detected)"; else echo "- Optimal for your use case"; fi`
!`if echo "$ARGUMENTS" | grep -q "\-\-iterative"; then echo "- Implemented iteratively with validation steps (--iterative flag detected)"; fi`
!`if echo "$ARGUMENTS" | grep -q "\-\-with-tests"; then echo "- Includes comprehensive tests (--with-tests flag detected)"; fi`
!`if echo "$ARGUMENTS" | grep -q "\-\-documentation"; then echo "- Includes documentation (--documentation flag detected)"; fi`

## 3. Implementation Plan

Here's my implementation approach:

1. **Setup & Prerequisites**
   - Identify necessary dependencies and environment setup
   - Determine integration points with existing codebase

2. **Core Implementation**
   - Structure code following best practices
   - Implement core functionality
   - Handle edge cases and error conditions

3. **Quality Assurance**
   - Implement validation logic
   - Consider performance implications
   - Ensure security best practices

4. **Integration**
   - Connect with existing systems
   - Ensure backward compatibility
   - Minimize potential disruptions

## 4. Execution

Let me now implement the requested functionality:

```
// Implementation code will appear here based on the requested feature
```

## 5. Next Steps

- Review the implementation for correctness
- Run tests to validate behavior
- Deploy to development environment
- Monitor for any issues

Let me know if you'd like me to make any adjustments to this implementation approach.
