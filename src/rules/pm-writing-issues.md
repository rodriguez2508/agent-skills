---
title: Product Manager - Writing Issues from Business Perspective
impact: CRITICAL
impactDescription: "Los issues deben escribirse desde la perspectiva de negocio (QUÉ y POR QUÉ), NO desde la implementación técnica (CÓMO)"
tags: product-management, issues, user-stories, requirements, business
---

## Product Manager - Writing Issues from Business Perspective

**Impact: CRITICAL** — Los issues escritos correctamente enfocan al equipo en el **valor de negocio** y la **necesidad del usuario**, no en la solución técnica.

---

## 🎯 Rol del Product Manager (PM)

El PM es responsable de definir:
- ✅ **QUÉ** se va a construir (el problema/oportunidad)
- ✅ **POR QUÉ** es importante (valor de negocio)
- ✅ **PARA QUIÉN** es (usuarios objetivo)
- ✅ **CÓMO SABEMOS** que funcionó (métricas de éxito)

El PM **NO** define:
- ❌ **CÓMO** se va a implementar (eso es del equipo técnico)
- ❌ Qué tecnologías usar
- ❌ Decisiones de arquitectura
- ❌ Detalles de implementación

---

## 📋 Formato de Issue para PM

### ✅ CORRECTO (PM escribe esto):

```markdown
## Título
Autenticación con Google

## Problema del Usuario
Los usuarios pierden tiempo creando una nueva cuenta con email/password cuando ya tienen una cuenta de Google.

## Objetivo de Negocio
Reducir la fricción en el registro y aumentar la conversión de nuevos usuarios.

## Historia de Usuario
**Como** visitante del sitio
**Quiero** iniciar sesión con mi cuenta de Google
**Para** acceder rápidamente sin crear una nueva cuenta

## Criterios de Aceptación
- ✅ El usuario ve un botón "Iniciar con Google"
- ✅ Al hacer clic, se abre el popup de Google
- ✅ Después de autenticar, es redirigido a la página principal
- ✅ Su perfil se crea automáticamente con datos de Google

## Métricas de Éxito
- 📈 Aumento del 20% en registros completados
- 📈 Reducción del tiempo de registro a < 30 segundos
- 📈 40% de usuarios eligen Google login

## Prioridad
🔴 HIGH

## Labels
feature, authentication, conversion
```

### ❌ INCORRECTO (NO escribir esto):

```markdown
## Título
Implementar OAuth2 con Google API

## Descripción
Hay que usar passport-google-oauth20 para implementar OAuth2.

## Tareas Técnicas
- Instalar passport-google-oauth20
- Configurar Google OAuth credentials
- Crear estrategia en NestJS
- Implementar JWT tokens
- Guardar en MongoDB

## Implementación
```typescript
import { Strategy } from 'passport-google-oauth20';
// ... código técnico ...
```
```

---

## 🎨 Plantilla de Issue para PM

```markdown
## 🎯 Título
[Nombre del feature en lenguaje de negocio]

## 😓 Problema del Usuario
[Descripción del problema que tienen los usuarios]

## 💼 Objetivo de Negocio
[Qué buscamos lograr como negocio]

## 👥 Usuarios Afectados
[Quiénes son los usuarios objetivo]

## 😔 Punto de Dolor Actual
[Qué está mal con la situación actual]

## ✨ Resultado Esperado
[Cómo será la experiencia después del feature]

---

## 📖 Historia de Usuario

**Como** [rol del usuario]
**Quiero** [objetivo/acción]
**Para** [beneficio/valor]

---

## ✅ Criterios de Aceptación

### Escenario Principal
- **Dado que** [situación inicial]
- **Cuando** [acción del usuario]
- **Entonces** [resultado esperado]

### Escenarios Alternos
- [Listar otros escenarios]

---

## 📊 Métricas de Éxito

- [ ] Métrica 1 (ej: Aumento del X% en conversiones)
- [ ] Métrica 2 (ej: Reducción de tiempo de Y a Z)
- [ ] Métrica 3 (ej: NPS > X)

---

## 🎯 Prioridad

[ ] 🔴 HIGH - Impacto alto, urgente
[ ] 🟡 MEDIUM - Importante pero no urgente
[ ] 🟢 LOW - Nice to have

---

## 🏷️ Labels

[feature|bug|improvement], [area-affected], [priority]

---

## ❌ Fuera de Alcance

- Detalles de implementación técnica
- Decisiones de arquitectura
- Tecnologías específicas

> ⚠️ **Nota:** El equipo de desarrollo definirá la solución técnica durante el sprint planning.
```

---

## 🚫 Errores Comunes del PM

### ❌ INCORRECTO: Ser muy técnico

```
Issue: "Implementar JWT con refresh tokens usando bcrypt"
```

### ✅ CORRECTO: Enfocarse en el usuario

```
Issue: "Como usuario, quiero que mi sesión se mantenga activa para no tener que loguearme cada vez"
```

---

### ❌ INCORRECTO: Definir implementación

```
Issue: "Usar React Query para caching de datos"
```

### ✅ CORRECTO: Definir problema

```
Issue: "Como usuario, quiero que los datos carguen rápido incluso con conexión lenta"
```

---

### ❌ INCORRECTO: Sin contexto de negocio

```
Issue: "Agregar botón de exportar a CSV"
```

### ✅ CORRECTO: Con contexto de negocio

```
Issue: "Como analista, quiero exportar los datos a Excel para crear reportes para mi jefe"
```

---

## 💡 Tips para Escribir Buenos Issues

### 1. Empieza con el usuario
- ¿Quién tiene el problema?
- ¿Qué está intentando lograr?
- ¿Qué le impide lograrlo?

### 2. Define el valor de negocio
- ¿Por qué es importante?
- ¿Qué métrica mejora?
- ¿Qué pasa si NO lo hacemos?

### 3. Sé específico en aceptación
- ¿Cómo sabemos que está terminado?
- ¿Qué escenarios debe cubrir?
- ¿Qué NO debe hacer?

### 4. Deja libertad técnica
- No digas CÓMO hacerlo
- Define el QUÉ y el POR QUÉ
- Confía en el equipo técnico

---

## 📊 Ejemplos Reales

### Ejemplo 1: Autenticación

**❌ TÉCNICO:**
```
Implementar JWT authentication con refresh tokens
- Usar jsonwebtoken library
- Configurar expiration en 15min
- Implementar /refresh endpoint
```

**✅ PM:**
```
Como usuario registrado
Quiero que mi sesión se mantenga activa mientras uso la app
Para no tener que loguearme constantemente

Criterios:
- La sesión dura mientras estoy activo
- Después de 30 min sin actividad, pide login
- El logout cierra la sesión inmediatamente
```

---

### Ejemplo 2: Búsqueda

**❌ TÉCNICO:**
```
Implementar Elasticsearch con fuzzy search
- Configurar analyzer en español
- Indexar campos: title, description, tags
- Implementar debounce de 300ms
```

**✅ PM:**
```
Como usuario buscando contenido
Quiero encontrar lo que busco aunque tenga errores ortográficos
Para no frustrarme si no sé escribir bien el término

Criterios:
- Encuentra resultados aunque haya typos
- Muestra sugerencias de términos similares
- Funciona en menos de 1 segundo
```

---

### Ejemplo 3: Reportes

**❌ TÉCNICO:**
```
Crear endpoint GET /api/reports con cache Redis
- Usar Bull para background jobs
- Exportar a PDF con pdfkit
- Subir a S3 bucket
```

**✅ PM:**
```
Como gerente
Quiero descargar reportes mensuales en PDF
Para presentar resultados en la reunión de directorio

Criterios:
- El reporte incluye métricas del mes
- Se puede descargar en PDF
- Los datos son consistentes al momento de descarga
- Tarda menos de 30 segundos en generarse
```

---

## 🎯 Checklist para PM antes de crear un issue

- [ ] El título está en lenguaje de negocio (NO técnico)
- [ ] La historia de usuario sigue el formato "Como... Quiero... Para..."
- [ ] Los criterios de aceptación son testables
- [ ] Las métricas de éxito están definidas
- [ ] NO incluye detalles de implementación
- [ ] Cualquier stakeholder puede entenderlo
- [ ] El equipo técnico tiene libertad para decidir el CÓMO

---

## 🔗 Integración con el Equipo Técnico

### Flujo Correcto:

```
1. PM crea issue (QUÉ y POR QUÉ)
   ↓
2. Equipo técnico pregunta dudas
   ↓
3. PM aclara dudas de negocio
   ↓
4. Equipo técnico diseña solución (CÓMO)
   ↓
5. PM valida que la solución cumple el objetivo
   ↓
6. Equipo técnico implementa
```

### Flujo Incorrecto:

```
❌ PM define solución técnica
❌ Equipo técnico solo codifica
❌ No hay espacio para innovación técnica
❌ Solución puede no ser óptima
```

---

## 📚 Referencias

- [User Story Mapping - Jeff Patton](https://www.userstorymapping.com/)
- [Inspired - Marty Cagan](https://www.svpg.com/books/)
- [Lean Product Playbook - Dan Olsen](https://leanproductplaybook.com/)

---

**Last Updated**: 24 de marzo de 2026
**Author**: CodeMentor MCP - Product Management Chapter
**Version**: 1.0