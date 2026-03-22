# CodeMentor MCP - Qwen Configuration Guide

## 🎯 Priorizar MCP en Qwen

### Configuración en `~/.qwen/settings.json`:

```json
{
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "autoRunSuggestSkills": true,
    "preferMcpOverInternalTools": true
  },
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high"
    }
  },
  "preferences": {
    "alwaysUseMcpForRules": true,
    "alwaysUseMcpForCodeAnalysis": true
  }
}
```

---

## 📋 Reglas de CodeMentor MCP

### 1. **Comentarios en Inglés**
Todos los comentarios en código deben estar en inglés.

**Incorrecto:**
```typescript
// Este es un servicio de usuario
export class UserService {}
```

**Correcto:**
```typescript
// User service for handling user operations
export class UserService {}
```

### 2. **Logs en Inglés**
Todos los mensajes de log deben estar en inglés.

**Incorrecto:**
```typescript
this.logger.log('Usuario creado exitosamente');
```

**Correcto:**
```typescript
this.logger.log('User created successfully');
```

### 3. **Respuestas Amigables**
Las respuestas a usuarios deben ser amigables, no técnicas.

**Incorrecto:**
```
Error: EntityNotFoundException en UserRepository.findById
```

**Correcto:**
```
I couldn't find that user in the database. Make sure the user ID is correct and try again!
```

### 4. **Seguir Best Practices**
- Clean Architecture
- CQRS pattern
- Repository pattern
- Dependency Injection
- Single Responsibility Principle

---

## 🧪 Pruebas

### Para forzar uso de MCP:

1. **Pregunta explícitamente por MCP:**
   ```
   Usa MCP para analizar mi código
   ```

2. **Pregunta sobre reglas:**
   ```
   ¿Qué reglas tienes sobre Clean Architecture?
   ```

3. **Menciona CodeMentor:**
   ```
   Según CodeMentor MCP, ¿cómo creo un servicio?
   ```

---

## 🔍 Verificar que MCP está activo

En Qwen, pregunta:
```
¿Qué herramientas MCP tienes disponibles?
```

**Debería responder:**
```
Tengo disponibles estas herramientas MCP:
- mcp__agent-skills-api__search_rules
- mcp__agent-skills-api__get_rule
- mcp__agent-skills-api__list_rules
```

---

## 🛠️ Troubleshooting

### Qwen no usa MCP

1. Verifica que el servidor esté corriendo:
   ```bash
   curl http://localhost:8004/mcp/message
   ```

2. Reinicia Qwen completamente

3. Verifica logs del servidor:
   ```
   🔌 MCP: Nuevo cliente SSE conectado
   ✅ MCP: Sesión creada: <uuid>
   ```

### MCP conectado pero no responde

1. Verifica que las reglas estén cargadas:
   ```
   Lista las reglas disponibles
   ```

2. Revisa la configuración en `~/.qwen/settings.json`

3. Asegúrate de que `autoActivateSkills: true`
