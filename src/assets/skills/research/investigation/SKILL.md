---
name: investigation
description: Research and investigate code patterns, libraries, APIs and technical solutions
tags: [research, investigation, documentation, learning]
---

# Research Skill

This skill handles research tasks including investigating code patterns, finding solutions, and gathering technical information.

## When to Use

Use this skill when the user asks to:
- Research a topic
- Investigate how something works
- Find documentation
- Compare alternatives
- Analyze existing implementations
- Explore codebases
- Find best practices
- Learn about a library or framework

## Research Process

### 1. Define the Question
Clarify what needs to be researched:
- What's the specific problem?
- What's the context?
- What constraints exist?

### 2. Gather Information
- Read existing code/documents
- Search documentation
- Check library APIs
- Look for examples
- Search for best practices

### 3. Analyze Alternatives
- Compare approaches
- Evaluate pros/cons
- Consider trade-offs
- Check community consensus

### 4. Synthesize Findings
- Summarize what was found
- Provide recommendations
- Include references/sources

## Output Format

Always provide research results in this structure:

```
## 🔍 Research: [Topic]

### Summary
[Brief 2-3 sentence summary]

### Context
[Why this research is needed]

### Findings

#### Option 1: [Name]
- **Pros**: [List]
- **Cons**: [List]
- **Use case**: [When to use]
- **Example**: [Code snippet if applicable]

#### Option 2: [Name]
- ...

### Recommendation
[Based on the context, recommend option X because...]

### References
- [Link 1]
- [Link 2]
- [Link 3]
```

## Example

User: "Research how to implement real-time notifications in NestJS"

Response:
```
## 🔍 Research: Real-time Notifications in NestJS

### Summary
Real-time notifications can be implemented in NestJS using WebSockets or Server-Sent Events (SSE).

### Context
Need to notify users instantly when certain events occur without page refresh.

### Findings

#### Option 1: WebSockets (Socket.io)
- **Pros**: 
  - Bidirectional communication
  - Room support for targeting users
  - Automatic reconnection
- **Cons**: 
  - More complex setup
  - Requires separate port or prefix
- **Use case**: Chat apps, real-time collab
- **Example**:
```typescript
@WebSocketGateway()
class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  notify(userId: string, message: string) {
    this.server.to(`user:${userId}`).emit('notification', message);
  }
}
```

#### Option 2: Server-Sent Events (SSE)
- **Pros**:
  - Simple HTTP-based
  - Works with load balancers
  - Automatic reconnection
- **Cons**:
  - One-way (server → client only)
  - Browser limits connections
- **Use case**: Notifications, live updates
- **Example**:
```typescript
@Get('events')
sse(): Observable<MessageEvent> {
  return this.notificationsService.getEvents();
}
```

### Recommendation
Use **SSE** for notifications because:
1. Simpler to implement
2. Works with existing infrastructure
3. Unidirectional fits the use case
4. Better for mobile/complex networks

### References
- NestJS Docs: WebSockets
- MDN: Using Server-Sent Events
- Socket.io Documentation
```

## Investigation Process

For deeper investigation:

1. **Map the codebase** - Understand structure
2. **Trace the flow** - Follow data/execution
3. **Identify patterns** - Find recurring solutions
4. **Document findings** - Record discoveries

## Best Practices

1. **Be thorough** - Don't assume, verify
2. **Cite sources** - Reference documentation
3. **Consider trade-offs** - No perfect solution
4. **Provide examples** - Code snippets help
5. **Make recommendations** - Guide decision making