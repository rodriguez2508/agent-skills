---
name: create-user-stories
description: Create user stories, tasks and manage project workflow with Agile methodology
tags: [pm, project-management, agile, user-stories, tasks]
---

# Project Management Skill

This skill handles project management tasks including user stories, tasks, issues, and Agile workflows.

## When to Use

Use this skill when the user asks to:
- Create user stories
- Create tasks or todos
- Manage project workflow
- Plan sprints
- Estimate effort
- Create requirements
- Track progress

## User Story Template

Always use this structure for user stories:

```
## 📝 User Story: [Title]

### ID
[PROJECT]-[N]

### Description
As a [role], I want to [feature] so that [benefit].

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Technical Notes
- [Technical considerations]

### Dependencies
- [Related stories/tasks]

### Priority
- [ ] Critical
- [ ] High
- [ ] Medium
- [ ] Low

### Estimation
- Story Points: [1/2/3/5/8/13]
```

## Task Template

```
## ✅ Task: [Title]

### ID
[PROJECT]-TASK-[N]

### Description
[What needs to be done]

### Checklist
- [ ] Subtask 1
- [ ] Subtask 2

### Assigned To
[Developer/Team]

### Due Date
[Date]

### Status
- [ ] To Do
- [ ] In Progress
- [ ] Blocked
- [ ] Done
```

## Workflow Management

### Status Flow
```
To Do → In Progress → In Review → Done
              ↓
         Blocked (→ To Do when unblocked)
```

### Priority Matrix
| Priority | Description | Response Time |
|----------|-------------|---------------|
| Critical | Blocker, production down | Immediate |
| High | Major feature, deadline | 24h |
| Medium | Normal work | 1 week |
| Low | Nice to have | Backlog |

## Example

User: "Create a user story for user authentication"

Response:
```
## 📝 User Story: User Authentication

### ID
MYAPP-101

### Description
As a user, I want to log in with email and password so that I can access my secure account.

### Acceptance Criteria
- [ ] User can register with email/password
- [ ] User can log in with credentials
- [ ] User receives confirmation email
- [ ] User can reset password
- [ ] Session expires after 30 minutes of inactivity

### Technical Notes
- Use JWT tokens
- Store password hashed with bcrypt
- Implement rate limiting on login

### Dependencies
- None ( foundational story)

### Priority
- [x] Critical

### Estimation
- Story Points: 8
```

## Commands

- Create issue: Use issue tracker
- List tasks: Show pending items
- Update status: Mark progress
- Estimate: Assign story points

## Best Practices

1. **INVEST** - Independent, Negotiable, Valuable, Estimable, Small, Testable
2. **Acceptance Criteria** - Clear, testable, verifiable
3. **Small Stories** - Split large stories
4. **Early Delivery** - Prioritize delivering value
5. **Refine Regularly** - Keep backlog groomed