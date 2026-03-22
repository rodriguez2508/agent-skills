# MCP Server Configuration for CodeMentor MCP

## ¿Qué es CodeMentor MCP?

CodeMentor MCP es un servidor MCP (Model Context Protocol) que proporciona acceso a reglas de código y buenas prácticas de programación. Todas las respuestas están formateadas con el prefijo **"Según CodeMentor MCP"**.

---

## 📋 Configuración por Agente

### Qwen Code

Edita `~/.qwen/settings.json`:

```json
{
  "mcpServers": {
    "codementor": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:3000"
      },
      "trust": true
    }
  }
}
```

### Cursor

Edita `.cursor/settings.json` en tu proyecto o `~/.cursor/settings.json`:

```json
{
  "mcp": {
    "codementor": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Claude Code

Crea `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "codementor": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Gemini CLI

Crea `~/.gemini/mcp.json`:

```json
{
  "mcpServers": {
    "codementor": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## 🛠️ Herramientas Disponibles

### 1. `search_rules`

Busca reglas de código usando BM25.

**Parámetros:**
- `query` (requerido): Término de búsqueda
- `category` (opcional): Filtrar por categoría
- `limit` (opcional): Número máximo de resultados (default: 5)

**Ejemplo de uso:**
```
Usuario: "¿Cómo creo un servicio en NestJS?"

Qwen + CodeMentor:
🎓 **Según CodeMentor MCP**: Encontré 2 regla(s) relevante(s):

### 1. Dependency Injection
**Categoría:** nestjs
**Relevancia:** 85.3%
**Tags:** dependency-injection, nestjs, providers

Usa el sistema de inyección de dependencias de NestJS...
```

### 2. `get_rule`

Obtiene una regla específica por ID.

**Parámetros:**
- `id` (requerido): ID de la regla

**Ejemplo de uso:**
```
Usuario: "Muéstrame la regla clean-architecture"

Qwen + CodeMentor:
🎓 **Según CodeMentor MCP**: Aquí está la regla solicitada:

# Clean Architecture con CQRS

**ID:** clean-architecture
**Categoría:** nestjs
**Impacto:** HIGH
**Tags:** clean-architecture, cqrs, nestjs

Implementa Clean Architecture combinada con CQRS...
```

### 3. `list_rules`

Lista todas las reglas disponibles.

**Parámetros:**
- `category` (opcional): Filtrar por categoría
- `limit` (opcional): Número máximo de resultados (default: 50)

**Ejemplo de uso:**
```
Usuario: "¿Qué reglas tienes disponibles?"

Qwen + CodeMentor:
🎓 **Según CodeMentor MCP**: Encontré 5 regla(s) disponible(s):

## 📁 NESTJS
1. **Clean Architecture** (`clean-architecture`)
2. **Dependency Injection** (`dependency-injection`)

## 📁 TYPESCRIPT
1. **Strict Types** (`strict-types`)
```

---

## 🚀 Inicio del Servidor MCP

### Opción 1: Manual

```bash
# Build del proyecto
pnpm run build

# Iniciar servidor MCP
node dist/mcp-server.js
```

### Opción 2: Script automático

```bash
# Crear script de inicio
echo '#!/bin/bash
pnpm run build && node dist/mcp-server.js' > start-mcp.sh
chmod +x start-mcp.sh

# Ejecutar
./start-mcp.sh
```

---

## ✅ Verificación

### Test de conexión

```bash
# Verificar que el servidor MCP responde
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/mcp-server.js
```

### Test desde el agente

En Qwen/Cursor/Claude, pregunta:

```
¿Qué herramientas MCP tienes disponibles?
```

Debería responder mostrando las 3 herramientas de CodeMentor MCP.

---

## 🔧 Troubleshooting

### El agente no detecta el MCP

1. Verifica la ruta del archivo `dist/mcp-server.js`
2. Asegúrate de haber hecho `pnpm run build`
3. Reinicia el agente de IA

### Error de conexión a la API

```json
{
  "env": {
    "API_URL": "http://localhost:3000"
  }
}
```

Asegúrate de que la API esté corriendo en el puerto 3000.

### Respuestas sin el prefijo

Verifica que el servidor MCP esté usando el archivo `mcp-server.ts` compilado, no la API REST directamente.

---

## 📝 Notas

- Todas las respuestas incluyen **🎓 Según CodeMentor MCP** como prefijo
- El servidor MCP usa **stdio transport** (comunicación local)
- La API REST debe estar corriendo en paralelo para que funcione
- Configurado para **trust: true** para permitir todas las operaciones

---

## 🎯 Ejemplo de Flujo Completo

```
1. Usuario instala CodeMentor MCP en Qwen
2. Usuario pregunta: "¿Cómo implemento CQRS en NestJS?"
3. Qwen llama a: search_rules({ query: "CQRS NestJS" })
4. CodeMentor MCP consulta la API REST
5. CodeMentor MCP formatea respuesta con prefijo
6. Qwen muestra:
   
   🎓 **Según CodeMentor MCP**: Encontré 1 regla(s) relevante(s):
   
   ### 1. Clean Architecture con CQRS
   **Categoría:** nestjs
   **Relevancia:** 92.5%
   
   Implementa Clean Architecture combinada con CQRS...
```
