# Gemini CLI - Instrucciones para Agent Skills MCP

## 🤖 Configuración del Agente

Este archivo configura el comportamiento de Gemini CLI cuando se conecta al servidor MCP de Agent Skills API.

---

## 📋 Configuración MCP

Para conectar Gemini con Agent Skills API, usa la siguiente configuración en `~/.gemini/mcp.json`:

```json
{
  "mcpServers": {
    "agent-skills-api": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "PORT": "8004",
        "AUTO_DETECT_PROJECT": "true"
      },
      "trust": true
    }
  }
}
```

---

## 🎯 Comportamiento Esperado

### 1. Uso de Herramientas MCP

Cuando el usuario haga preguntas sobre:
- **Reglas de código**: "¿Cómo creo un servicio en NestJS?"
- **Buenas prácticas**: "¿Cuál es la mejor forma de manejar errores?"
- **Arquitectura**: "¿Cómo implemento CQRS?"
- **Documentación de librerías**: "¿Cómo uso React hooks?"

**Debes usar las herramientas MCP disponibles:**
- `search_rules`: Para buscar reglas de código relevantes
- `get_rule`: Para obtener una regla específica por ID
- `list_rules`: Para listar todas las reglas disponibles
- `context7_docs`: Para documentación de librerías

### 2. Formato de Respuestas

Todas las respuestas que usen herramientas MCP deben incluir el prefijo:

```
🎓 **Según CodeMentor MCP**: [respuesta]
```

### 3. Prioridad de Herramientas

1. **Alta**: `search_rules`, `context7_docs`
2. **Media**: `get_rule`
3. **Baja**: `list_rules`

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Pregunta sobre reglas de código

**Usuario**: "¿Cómo implemento inyección de dependencias en NestJS?"

**Gemini**:
```
🎓 **Según CodeMentor MCP**: Encontré 2 regla(s) relevante(s):

### 1. Dependency Injection
**Categoría:** nestjs
**Relevancia:** 95.2%
**Tags:** dependency-injection, nestjs, providers

Usa el sistema de inyección de dependencias de NestJS...
```

### Ejemplo 2: Documentación de librería

**Usuario**: "¿Cómo uso React useEffect?"

**Gemini**:
```
🎓 **Según CodeMentor MCP**: Aquí está la documentación de React useEffect:

[Documentación actualizada de React useEffect...]
```

---

## 🔧 Troubleshooting

### El servidor MCP no responde

1. Verifica que el servidor esté corriendo: `pnpm run start:mcp`
2. Comprueba el build: `pnpm run build`
3. Revisa los logs del servidor MCP

### Configuración no se carga

1. Verifica que `~/.gemini/mcp.json` existe y tiene la configuración correcta
2. Asegúrate de que la ruta al archivo `dist/mcp-server.js` es correcta
3. Reinicia Gemini CLI

---

## 📚 Recursos Adicionales

- **Documentación principal**: [README.md](../doc/README.md)
- **Arquitectura**: [ARCHITECTURE.md](../doc/ARCHITECTURE.md)
- **Configuración MCP**: [MCP-CONFIG.md](../doc/MCP-CONFIG.md)

---

## ✅ Checklist de Verificación

- [ ] Gemini CLI instalado y configurado
- [ ] Archivo `~/.gemini/mcp.json` creado con la configuración correcta
- [ ] Servidor MCP corriendo (`pnpm run start:mcp`)
- [ ] Build del proyecto actualizado (`pnpm run build`)
- [ ] Las herramientas MCP responden correctamente

---

**Nota**: Esta configuración es similar a la de Qwen Code y otros agentes compatibles con MCP.
