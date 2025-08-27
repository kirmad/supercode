# Code Review Prompt

Please review the following {{language}} code for {{focus}}:

## Code to Review

```{{language}}
{{code}}
```

## Context
{{context}}

## Review Requirements

Focus Areas:
{{#if focus_security}}- 🔒 **Security**: Look for potential vulnerabilities, input validation, and secure coding practices{{/if}}
{{#if focus_performance}}- ⚡ **Performance**: Identify bottlenecks and optimization opportunities{{/if}}
{{#if focus_maintainability}}- 🔧 **Maintainability**: Check code organization, readability, and documentation{{/if}}
{{#if focus_testing}}- 🧪 **Testing**: Evaluate test coverage and quality{{/if}}

## Please Provide

1. **Overall Assessment**: Brief summary of code quality (1-2 sentences)
2. **Issues Found**: List any problems with severity levels (Critical/High/Medium/Low)
3. **Recommendations**: Specific suggestions for improvement
4. **Positive Notes**: What's well done in the code

Review Style: {{style}}

---

**Variables:**
- `language`: Programming language (default: typescript)
- `code`: Code to review (required)
- `focus`: Review focus area
- `context`: Additional context about the code
- `focus_security`: Focus on security (boolean, default: true)
- `focus_performance`: Focus on performance (boolean, default: true) 
- `focus_maintainability`: Focus on maintainability (boolean, default: true)
- `focus_testing`: Focus on testing (boolean, default: false)
- `style`: Review style (gentle/balanced/thorough/strict, default: balanced)