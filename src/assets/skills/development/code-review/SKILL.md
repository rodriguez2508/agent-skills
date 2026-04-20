---
name: code-review
description: Perform comprehensive code review with security, performance and best practices checks
tags: [development, code-quality, review, security, best-practices]
---

# Code Review Skill

This skill performs thorough code reviews analyzing security, performance, architecture, and best practices.

## When to Use

Use this skill when the user asks to:
- Review code
- Analyze code quality
- Check for bugs or security issues
- Validate best practices
- Perform refactoring suggestions

## Review Process

### 1. Security Analysis
- Check for SQL injection vulnerabilities
- Validate input sanitization
- Check authentication/authorization patterns
- Look for exposed secrets or sensitive data
- Validate dependency security

### 2. Performance Review
- Identify N+1 query problems
- Check for memory leaks
- Validate caching strategies
- Check algorithmic complexity

### 3. Code Quality
- Check SOLID principles
- Validate naming conventions
- Check code duplication
- Verify documentation
- Check error handling

### 4. Architecture
- Verify separation of concerns
- Check dependency direction
- Validate abstraction levels
- Check coupling

## Output Format

Always provide review in this structure:

```
## 📋 Code Review: [filename]

### ✅ Passed
- [List of good practices found]

### ⚠️ Warnings
- [List of potential issues]
- Severity: [Low/Medium/High/Critical]

### ❌ Issues
- [List of problems to fix]
- Suggested fix: [Description]

### 💡 Suggestions
- [List of improvements]

### 📊 Metrics
- Lines of code: [N]
- Complexity: [Low/Medium/High]
- Test coverage: [N%]
```

## Example

User: "Review src/user.service.ts"

Response:
```
## 📋 Code Review: src/user.service.ts

### ✅ Passed
- Good use of dependency injection
- Proper error handling with try-catch

### ⚠️ Warnings
- Method `findByEmail` could benefit from indexing (Medium)
- Consider adding pagination to `findAll` (Low)

### ❌ Issues
- **SQL Injection Risk**: Line 45 uses string concatenation
  - Fix: Use parameterized queries
  
### 💡 Suggestions
- Extract validation to separate class
- Add unit tests for critical methods
```

## Key Principles

1. **Be constructive** - Focus on improvement, not criticism
2. **Prioritize** - Sort issues by severity
3. **Provide solutions** - Don't just point out problems
4. **Consider context** - Understand the codebase patterns
5. **Check tests** - Verify test coverage and quality