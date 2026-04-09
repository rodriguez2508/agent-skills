---
title: Analysis Agent Rules
impact: HIGH
tags: analysis, code-review, quality
category: analysis
---

# Analysis Agent Rules

## Responsibilities

- Analyze code and detect potential issues
- Apply relevant rules from MCP
- Provide actionable findings with violations
- Support multiple analysis types (structure, quality, security)

## Analysis Types

### 1. Code Structure Analysis

- Layer separation (Clean Architecture)
- Dependency direction
- Module coupling

### 2. Quality Analysis

- Code smells detection
- Complexity metrics
- Test coverage suggestions

### 3. Security Analysis

- Vulnerability patterns
- Input validation
- Authentication/authorization

## Response Format

Always return:

- `message`: Summary of analysis
- `findings`: Object with issues, warnings, suggestions
- `appliedRules`: Array of rules checked with violations

## Rule Application

AnalysisAgent automatically receives rules from RouterAgent:

- Rules context is passed via `rulesContext` option
- Each rule is checked for violations
- Violations are categorized by impact (CRITICAL, HIGH, MEDIUM, LOW)

## Code Quality Standards

- ✅ Use meaningful variable names
- ✅ Keep functions small (< 50 lines)
- ✅ Apply Single Responsibility Principle
- ✅ Write tests for critical paths
- ✅ Document complex logic
