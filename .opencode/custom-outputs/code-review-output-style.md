### For Hunks (Inside review-result)
- Group related changes together
- A hunk is a logical unit of change (might span multiple diff hunks)
- Mark `needs-attention="yes"` for problematic hunks
- Categories: feature, bugfix, refactor, security-fix, performance, test

### For Comments (Inside review-result)
- Be specific with line ranges
- One issue per comment
- Only provide fix code for high severity issues
- Keep messages clear and actionable# Code Review Output Style

Follow this exact format for code reviews. Output insights as you read, then provide hunk analysis and comments.

## Output Structure

Your review has two parts:
1. **Multiple `<review-insight>` tags** - Output these immediately as you read
2. **Single `<review-result>` tag** - Contains hunks and comments after analysis

**CRITICAL**: Review insights must be streamed in real-time as separate tags, NOT collected and output together.

## Part 1: Stream Review Insights (Output immediately as you read)

```xml
<review-insight type="[security|bug|performance|quality|pattern]" severity="[high|medium|low]">
[What you notice as you read through the diff]
</review-insight>

<review-insight type="[type]" severity="[severity]">
[Another observation]
</review-insight>

<!-- Output these immediately as you analyze, don't wait -->
```

## Part 2: Review Results (After analysis)

```xml
<review-result>

<hunks>

<hunk file="[path/to/file.ext]" start="[start-line]" end="[end-line]">
<category>[feature|bugfix|refactor|security-fix|performance|test]</category>
<risk>[high|medium|low]</risk>
<description>[What this hunk does in one sentence]</description>
<needs-attention>[yes|no]</needs-attention>
</hunk>

<!-- Continue for each significant hunk -->

</hunks>
```

## Part 3: Line Comments (Specific feedback)

```xml
<comments>

<comment>
<file>[path/to/file.ext]</file>
<lines start="[start-line]" end="[end-line]"/>
<type>[issue|suggestion|praise]</type>
<severity>[high|medium|low]</severity>
<message>[Clear explanation of the issue/suggestion/praise]</message>
<fix-code>
```[language]
[Suggested fix - only for high severity issues]
```
</fix-code>
</comment>

<!-- Continue for all comments -->

</comments>
```

## Simple Rules

### For Insights (Stream immediately)
- Output each `<review-insight>` AS SOON AS you notice something
- Don't collect them first - stream them one by one
- Keep each insight to 1-2 sentences
- Focus on your immediate observations
- Types: security, bug, performance, quality, pattern

### For Review Result (After reading everything)
- Create ONE `<review-result>` tag containing both hunks and comments
- Hunks group related changes together
- Comments provide specific line feedback
- Only provide fix code for high severity issues

### Hunk Guidelines
- Group related changes together
- A hunk is a logical unit of change (might span multiple diff hunks)
- Mark `needs-attention="yes"` for problematic hunks
- Categories: feature, bugfix, refactor, security-fix, performance, test

### Comment Guidelines
- Be specific with line ranges
- One issue per comment
- Only provide fix code for high severity issues
- Keep messages clear and actionable

## Line Numbering

- Use positive numbers for new lines (additions)
- Use negative numbers for old lines (deletions): `-42`
- For ranges, use start and end: `start="10" end="15"`

## Complete Example

```xml
<review-insight type="security" severity="high">
SQL query uses string concatenation with user input on line 42
</review-insight>

<review-insight type="performance" severity="medium">
Database queries inside a loop detected in processOrders function
</review-insight>

<review-insight type="quality" severity="low">
Good error handling pattern in the authentication module
</review-insight>

<review-insight type="bug" severity="high">
Missing null check before accessing user properties
</review-insight>

<review-insight type="pattern" severity="low">
Consistent use of async/await throughout the changes
</review-insight>

<review-result>

<hunks>

<hunk file="src/api/users.js" start="40" end="55">
<category>bugfix</category>
<risk>high</risk>
<description>Fixes SQL injection vulnerability in user query</description>
<needs-attention>yes</needs-attention>
</hunk>

<hunk file="src/api/users.js" start="60" end="75">
<category>feature</category>
<risk>low</risk>
<description>Adds new user validation logic</description>
<needs-attention>no</needs-attention>
</hunk>

<hunk file="src/services/order.js" start="20" end="35">
<category>performance</category>
<risk>medium</risk>
<description>Optimizes order processing with batch queries</description>
<needs-attention>yes</needs-attention>
</hunk>

</hunks>

<comments>

<comment>
<file>src/api/users.js</file>
<lines start="42" end="42"/>
<type>issue</type>
<severity>high</severity>
<message>SQL injection vulnerability. User input is directly concatenated into the query string, allowing attackers to manipulate the SQL.</message>
<fix-code>
```javascript
const user = await db.query(
  'SELECT * FROM users WHERE id = ?',
  [req.params.id]
);
```
</fix-code>
</comment>

<comment>
<file>src/api/users.js</file>
<lines start="48" end="48"/>
<type>issue</type>
<severity>medium</severity>
<message>Missing null check. If user is not found, accessing user.email will throw an error.</message>
<fix-code></fix-code>
</comment>

<comment>
<file>src/services/order.js</file>
<lines start="25" end="30"/>
<type>suggestion</type>
<severity>medium</severity>
<message>Consider using Promise.all() for parallel processing instead of sequential await in loop.</message>
<fix-code></fix-code>
</comment>

<comment>
<file>src/api/users.js</file>
<lines start="65" end="72"/>
<type>praise</type>
<severity>low</severity>
<message>Excellent error handling with proper logging and specific error types.</message>
<fix-code></fix-code>
</comment>

</comments>

</review-result>
```

## Priority Guide

### High Severity (Must Fix)
- SQL injection, XSS, command injection
- Exposed secrets (passwords, API keys)
- Data loss risks
- Security vulnerabilities
- Critical logic errors

### Medium Severity (Should Fix)
- Missing error handling
- Performance problems (N+1 queries)
- Missing null checks
- Memory leaks
- Complex code needing refactoring

### Low Severity (Nice to Fix)
- Code style issues
- Minor improvements
- Documentation gaps
- Test coverage improvements

## What to Look For

1. **Security First**: SQL injection, XSS, exposed secrets
2. **Bugs Next**: Null errors, logic issues, missing error handling
3. **Then Performance**: N+1 queries, memory leaks, inefficient algorithms
4. **Finally Quality**: Duplication, complexity, naming

## Keep It Simple

- Don't nest XML deeply
- Use simple categories, don't overthink
- Focus on actionable feedback
- Only provide fixes for critical issues
- Be specific about line numbers