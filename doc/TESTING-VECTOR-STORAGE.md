# 🧪 Testing Vector Storage Implementation with Qwen

## ✅ Quick Test Guide

### 1. Start the Application

```bash
cd /home/aajcr/PROYECTOS/agent-skills-api

# Type check first (new rule!)
pnpm run typecheck

# Build
pnpm run build

# Start development server
pnpm run start:dev
```

The application will start on **http://localhost:8004**

---

### 2. Verify Health Check

```bash
curl http://localhost:8004/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

### 3. Test Vector Storage via API

#### A. Test Rules Endpoint (with hybrid search)

```bash
# Search for rules about "Clean Architecture"
curl "http://localhost:8004/rules/search?q=Clean%20Architecture&limit=5"
```

Expected response includes:
```json
{
  "message": "Great! I found 5 rules that might help you:",
  "query": "Clean Architecture",
  "results": [...],
  "metadata": {
    "bm25Results": 3,
    "vectorResults": 3,
    "mergedResults": 5
  }
}
```

**Key indicator**: The `metadata` field shows both BM25 and Vector results!

---

### 4. Test with Qwen Code (MCP Integration)

#### A. Configure Qwen MCP Settings

Your `qwen-mcp-config.json` should have:

```json
{
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high"
    }
  }
}
```

#### B. Restart Qwen Code

1. Close Qwen Code completely
2. Reopen Qwen Code
3. Qwen will automatically connect to the MCP server

#### C. Test with Natural Language Queries

In Qwen Code chat, try these queries:

**Test 1: Basic Rule Search**
```
Busca reglas sobre Clean Architecture
```

**Expected Qwen Response:**
- Should use `search_rules` MCP tool
- Returns rules about Clean Architecture
- Shows relevance scores

**Test 2: Vector Search (Semantic)**
```
¿Cómo organizo los módulos en NestJS?
```

**Expected Qwen Response:**
- Uses hybrid search (BM25 + Vector)
- Finds related rules even without exact keyword match
- Shows metadata with both search results

**Test 3: Category-Specific Search**
```
Busca reglas de typescript sobre tipos estrictos
```

**Expected Qwen Response:**
- Filters by category "typescript"
- Returns rules about strict types

---

### 5. Test MCP Tools Directly

#### Available MCP Tools:

| Tool | Description | Example |
|------|-------------|---------|
| `search_rules` | Search rules with hybrid search | `search_rules(query="CQRS", category="nestjs", limit=5)` |
| `get_rule` | Get specific rule by ID | `get_rule(id="clean-architecture-001")` |
| `list_rules` | List all rules | `list_rules(category="nestjs", limit=10)` |

#### Example MCP Tool Call:

```
search_rules({
  "query": "repository pattern",
  "category": "nestjs",
  "limit": 5
})
```

---

### 6. Verify Vector Storage is Working

#### Check Logs

When search is performed, you should see logs like:

```
🔍 [SEARCH] Iniciando búsqueda híbrida (BM25 + Vector)
📚 [SEARCH] Indexando reglas...
✅ [SEARCH] Indexación BM25 completada: X reglas
🧠 [SEARCH] Vector store initialized (InMemory)
📚 [SEARCH] Indexing X rules for vector search...
✅ [SEARCH] Vector indexing completed: X rules
🧮 [SEARCH] Ejecutando BM25...
✅ [BM25] Búsqueda completada: X resultados
🧠 [SEARCH] Ejecutando Vector Search...
✅ [VectorSearch] Búsqueda completada: X resultados
📦 [SEARCH] Resultados formateados
```

**Key indicators:**
- `🧠 [SEARCH] Vector store initialized` = Vector store is working
- `✅ [VectorSearch]` = Vector search executed
- `metadata: { bm25Results, vectorResults, mergedResults }` = Hybrid search active

---

### 7. Test Vector Storage Health

```bash
# Check if vector store is healthy (via application logs)
# Look for health check in logs or add a health endpoint
```

---

### 8. Compare BM25 vs Hybrid Search

#### Test BM25 Only (keyword match):
```bash
curl "http://localhost:8004/rules/search?q=repository%20pattern"
```

#### Test Hybrid Search (semantic + keyword):
Same query, but now you should see:
- More relevant results
- Better ranking
- Metadata showing both sources

---

## 🎯 Success Criteria

### ✅ Vector Storage is Working If:

1. **Logs show vector initialization**
   - `🧠 [SEARCH] Vector store initialized (InMemory)`

2. **Search returns metadata with both result types**
   ```json
   {
     "metadata": {
       "bm25Results": 3,
       "vectorResults": 3,
       "mergedResults": 5
     }
   }
   ```

3. **Semantic search works**
   - Query: "cómo organizar código" finds "Clean Architecture" rules
   - Even without exact keyword match

4. **Qwen uses MCP tools**
   - Qwen calls `search_rules` tool automatically
   - Returns formatted results from API

---

## 🐛 Troubleshooting

### Issue: Qwen doesn't connect to MCP

**Solution:**
```bash
# Check if server is running
curl http://localhost:8004/health

# Check MCP endpoint
curl http://localhost:8004/mcp/sse

# Restart Qwen Code
# Verify qwen-mcp-config.json is correct
```

### Issue: No vector results in metadata

**Solution:**
```bash
# Check application logs for errors
# Look for: ⚠️ [VectorSearch] or ❌ [SEARCH]

# Verify VectorStorageModule is imported in app.module.ts
```

### Issue: Type errors

**Solution:**
```bash
# Run type check
pnpm run typecheck

# Fix any TypeScript errors before running
```

---

## 📊 Expected Performance

| Metric | Expected Value |
|--------|---------------|
| Type Check | < 5 seconds |
| Build | < 30 seconds |
| Search (BM25 only) | < 10ms |
| Search (Hybrid) | < 50ms |
| Vector Indexing | < 1 second (for 20 rules) |

---

## 🎓 Example Qwen Conversation

**User:**
```
Necesito implementar un repositorio en NestJS siguiendo Clean Architecture
```

**Qwen (with MCP):**
```
🔍 Searching for relevant rules...

Great! I found 5 rules that might help you:

1. **Repository Pattern** (nestjs) - 95% relevance
   Implements repository pattern with Clean Architecture...

2. **Clean Architecture** (nestjs) - 92% relevance
   Module structure following Clean Architecture...

[... more results ...]

Would you like me to show you the full content of any rule?
```

---

## 📝 Summary

### How to Verify It Works:

1. **Start server**: `pnpm run start:dev`
2. **Check logs**: Look for `🧠 Vector store initialized`
3. **Test API**: `curl http://localhost:8004/rules/search?q=Clean%20Architecture`
4. **Check metadata**: Should show `bm25Results`, `vectorResults`, `mergedResults`
5. **Test with Qwen**: Ask about code architecture, repository pattern, etc.
6. **Verify Qwen uses MCP tools**: Watch for tool calls in Qwen logs

---

**Last Updated**: 21 de marzo de 2026
**Author**: CodeMentor MCP
