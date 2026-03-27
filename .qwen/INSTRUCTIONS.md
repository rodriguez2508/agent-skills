# Qwen Code - CodeMentor MCP Instructions

## 🎯 Instrucción Principal

**DEBES usar las herramientas del CodeMentor MCP en CADA interacción.**

Este proyecto tiene un MCP server especializado con agentes para:
- **Búsqueda de reglas de código** (Clean Architecture, CQRS, NestJS)
- **Generación de código** siguiendo mejores prácticas
- **Análisis de arquitectura** y validación de patrones
- **Product Management** (crear issues, user stories)
- **Métricas y tracking** de uso

### ⚠️ IMPORTANTE: Herramientas Prohibidas

**Configuración en `~/.qwen/settings.json`:**
```json
{
  "tools": {
    "exclude": ["web_fetch", "web_search"],
    "allowed": [
      "mcp__agent-skills-api__chat_with_agents",
      "mcp__agent-skills-api__auto_apply_rules",
      "mcp__agent-skills-api__search_rules"
    ]
  }
}
```

**NUNCA uses estas herramientas internas de Qwen:**
- ❌ `web_fetch` - Excluida explícitamente en configuración
- ❌ `web_search` - Excluida explícitamente en configuración

**SIEMPRE usa estas herramientas MCP:**
- ✅ `mcp__agent-skills-api__chat_with_agents` - Para TODAS las consultas
- ✅ `mcp__agent-skills-api__auto_apply_rules` - Para aplicar reglas automáticamente
- ✅ `mcp__agent-skills-api__search_rules` - Para buscar reglas específicas

---

## 📋 Configuración Esencial

### Idioma
- ✅ **ESPAÑOL**: Toda comunicación con el usuario
- ✅ **INGLÉS**: Solo comentarios en código y logs

### Imports
- ✅ `import { X } from '@modules/...'`
- ❌ `import { X } from '../../../...'`

### Git
- ✅ PRs hacia: `development`
- ✅ Comando issues: `gh issue view <N> --json title,body,labels,state`

---

## 🤖 Herramientas MCP Disponibles

| Herramienta | Cuándo Usar | Descripción |
|-------------|-------------|-------------|
| `mcp__agent-skills-api__chat_with_agents` | **SIEMPRE** para preguntas generales | Enruta automáticamente al agente especializado (PM, Code, Architecture, etc.) |
| `mcp__agent-skills-api__ask_agent` | Para preguntas directas | Alias de chat_with_agents |
| `mcp__agent-skills-api__auto_apply_rules` | En cada mensaje del usuario | Busca y aplica reglas relevantes automáticamente |
| `mcp__agent-skills-api__search_rules` | Para buscar reglas específicas | Búsqueda BM25 de reglas de código |
| `mcp__agent-skills-api__get_rule` | Para obtener una regla por ID | Devuelve una regla específica |
| `mcp__agent-skills-api__list_rules` | Para ver reglas disponibles | Lista todas las reglas o por categoría |

---

## 🔄 Flujo de Trabajo Principal

### Cuando el Usuario Escriba Algo...

**PASO 1:** Ejecuta automáticamente `mcp__agent-skills-api__auto_apply_rules` con la consulta del usuario

```
Herramienta: mcp__agent-skills-api__auto_apply_rules
Parámetro: userQuery = "<mensaje del usuario>"
```

**PASO 2:** Lee las reglas aplicadas y el contexto

**PASO 3:** Si necesitas más ayuda, ejecuta `mcp__agent-skills-api__chat_with_agents`

```
Herramienta: mcp__agent-skills-api__chat_with_agents
Parámetro: message = "<mensaje del usuario>"
```

**PASO 4:** Responde aplicando:
- Las reglas encontradas
- Las preferencias del usuario
- El formato del agente especializado

---

## 📖 Casos Especiales

### Cuando el Usuario Pida Leer un Issue de GitHub

**Ejemplo:** "Lee este issue: https://github.com/ThreefacesGroup/general/issues/7234"

**⚠️ PROHIBIDO:**
- ❌ `web_fetch` - Explícitamente excluido en configuración
- ❌ `web_search` - Explícitamente excluido en configuración
- ❌ GitHub API REST (`curl https://api.github.com/...`)
- ❌ Navegador web manual

**✅ MÉTODO OBLIGATORIO:**

1. **Extraer el número del issue** de la URL:
   - URL: `https://github.com/ThreefacesGroup/general/issues/7234`
   - Número: `7234`

2. **Ejecutar `mcp__agent-skills-api__auto_apply_rules`** con la consulta

3. **Ejecutar `mcp__agent-skills-api__chat_with_agents`** con el mensaje:
   ```
   Lee el issue #7234 usando gh CLI
   ```

4. **El agente especializado ejecutará EXCLUSIVAMENTE:**
   ```bash
   gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
   ```

5. **Parsear y mostrar** la información del issue

**Regla Aplicada:** `dev-read-github-issues` (Ver issue completo) - Impacto: CRITICAL

---

## 🧪 Ejemplos

### Ejemplo 1: Saludo

**Usuario:** "hola"

**Tú:**
1. Ejecutas `mcp__agent-skills-api__auto_apply_rules` con "hola"
2. Lees las reglas disponibles
3. Respondes en **español**

**Respuesta esperada:**
```
¡Hola! ¿En qué puedo ayudarte hoy?

Tengo disponibles estos agentes especializados:
- SearchAgent: Búsqueda de reglas de código
- CodeAgent: Generación de código
- ArchitectureAgent: Validación de arquitectura
- PMAgent: Creación de issues y user stories

¿En qué trabajas actualmente?
```

### Ejemplo 2: Issue

**Usuario:** "quiero crear un issue para implementar autenticación"

**Tú:**
1. Ejecutas `mcp__agent-skills-api__chat_with_agents` con el mensaje
2. El PMAgent se activa automáticamente
3. Se crea el issue en la base de datos
4. Respondes en español con los detalles

**Respuesta esperada:**
```
¡Perfecto! He creado el issue para implementar autenticación.

📋 **Issue Creado:**
- **ID:** ISSUE-123
- **Título:** Implementar autenticación con JWT
- **Historia de Usuario:** Como usuario, quiero autenticarme...
- **Criterios de Aceptación:** ...

¿Quieres que continúe con la implementación?
```

### Ejemplo 3: Buscar Reglas

**Usuario:** "¿Cómo creo un servicio en NestJS?"

**Tú:**
1. Ejecutas `mcp__agent-skills-api__search_rules` con query="servicio NestJS"
2. Lees las reglas encontradas
3. Respondes aplicando las reglas

**Respuesta esperada:**
```
🎓 **Según CodeMentor MCP**: Encontré 2 regla(s) relevante(s):

### 1. Dependency Injection
**Categoría:** nestjs
**Relevancia:** 85.3%

Usa el sistema de inyección de dependencias de NestJS...

### 2. Service Layer Pattern
**Categoría:** nestjs
**Relevancia:** 78.1%

Los servicios deben contener la lógica de negocio...
```

### Ejemplo 4: Crear Código

**Usuario:** "crea un componente para usuarios"

**Tú:**
1. Ejecutas `mcp__agent-skills-api__auto_apply_rules` con la consulta
2. Ejecutas `mcp__agent-skills-api__chat_with_agents` para generar código
3. El CodeAgent se activa con las reglas aplicadas
4. Respondes en español con código (comentarios en inglés)

**Respuesta esperada:**
```
¡Claro! Voy a crear un componente de Angular siguiendo las reglas de CodeMentor MCP.

```typescript
// User list component with signal-based state management
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class UserListComponent {
  // Signal-based state
  users = signal<User[]>([]);
}
```

¿Quieres que complete el template?
```

---

## ⚠️ Reglas Críticas

1. **SIEMPRE** ejecuta `mcp__agent-skills-api__auto_apply_rules` al recibir un mensaje
2. **SIEMPRE** usa `mcp__agent-skills-api__chat_with_agents` para preguntas generales
3. **SIEMPRE** aplica las preferencias del usuario (desde MCP)
4. **SIEMPRE** habla en español con el usuario
5. **SIEMPRE** usa aliases en imports (@modules/...)
6. **SIEMPRE** PRs hacia `development`
7. **SIEMPRE** usa `gh issue view --json` para issues
8. **NUNCA uses `web_fetch` o `web_search`** - Son herramientas internas de Qwen. Usa SIEMPRE las herramientas MCP (`mcp__agent-skills-api__*`)
9. **Para issues de GitHub**: Usa `mcp__agent-skills-api__chat_with_agents` con el mensaje "Lee el issue: <URL>" - El agente especializado usará `gh issue view` o la API correcta

---

## 📁 Agentes Disponibles

| Agente | Responsabilidad |
|--------|----------------|
| **RouterAgent** | Orquestador principal, detecta intención |
| **SearchAgent** | Búsqueda BM25 de reglas |
| **IdentityAgent** | Gestiona identidad MCP y prefijos |
| **RulesAgent** | Listado y gestión de reglas |
| **CodeAgent** | Generación de código |
| **ArchitectureAgent** | Validación arquitectónica |
| **AnalysisAgent** | Análisis de código |
| **MetricsAgent** | Métricas y tracking |
| **PMAgent** | Product management (issues, user stories) |

---

## 🔍 Verificar que MCP está activo

En Qwen, pregunta:
```
¿Qué herramientas MCP tienes disponibles?
```

**Debería responder:**
```
Tengo disponibles estas herramientas MCP:
- mcp__agent-skills-api__chat_with_agents
- mcp__agent-skills-api__auto_apply_rules
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
   mcp__agent-skills-api__list_rules
   ```

2. Revisa la configuración en `~/.qwen/settings.json`

3. Asegúrate de que `autoActivateSkills: true`

---

## 📝 Notas Importantes

- **NO uses** `web_fetch` para issues de GitHub privados
- **NO uses** `web_search` para búsquedas de código local
- **SIEMPRE** usa las herramientas `mcp__agent-skills-api__*` para este proyecto
- El MCP server corre en `http://localhost:8004/mcp/sse`
