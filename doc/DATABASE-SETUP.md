# Database Setup Guide

## 🚀 Quick Start

### 1. Start Database Services

```bash
# Start PostgreSQL, Redis, and ChromaDB
pnpm run docker:up

# Check status
docker-compose ps

# View logs
pnpm run docker:logs
```

### 2. Verify Connections

```bash
# PostgreSQL
docker exec -it agent_skills_db psql -U postgres -d agent_skills

# Redis
docker exec -it agent_skills_redis redis-cli ping

# ChromaDB
curl http://localhost:8000/api/v1/heartbeat
```

### 3. Start Application

```bash
pnpm run start:dev
```

---

## 📦 Services

| Service | Port | Username | Password | Database |
|---------|------|----------|----------|----------|
| **PostgreSQL** | 5432 | postgres | postgres | agent_skills |
| **Redis** | 6379 | - | - | - |
| **ChromaDB** | 8000 | - | - | - |
| **Adminer** | 8080 | postgres | postgres | agent_skills |

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=agent_skills
DB_SSL=false
DB_LOGGING=true
DB_SYNCHRONIZE=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ChromaDB
CHROMADB_URL=http://localhost:8000
```

---

## 📊 Database Schema

### Tables

#### `users`
- `id` (UUID, PK)
- `email` (string, unique)
- `name` (string, nullable)
- `avatar` (string, nullable)
- `active` (boolean, default: true)
- `preferences` (jsonb, nullable)
- `totalSessions` (int, default: 0)
- `totalSearches` (int, default: 0)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### `sessions`
- `id` (UUID, PK)
- `sessionId` (string, external ID)
- `userId` (UUID, FK → users)
- `status` (enum: active, ended)
- `title` (string, nullable)
- `metadata` (jsonb, nullable)
- `messageCount` (int, default: 0)
- `lastActivityAt` (timestamp, nullable)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### `chat_messages`
- `id` (UUID, PK)
- `sessionId` (UUID, FK → sessions)
- `role` (enum: user, assistant, system)
- `content` (text)
- `metadata` (jsonb, nullable)
- `parentMessageId` (UUID, nullable)
- `tokenCount` (int, default: 0)
- `createdAt` (timestamp)

---

## 🗂️ Available Scripts

```bash
# Docker
pnpm run docker:up          # Start all services
pnpm run docker:down         # Stop all services
pnpm run docker:logs         # View logs
pnpm run docker:restart      # Restart services

# Database Migrations
pnpm run db:migrate          # Run migrations
pnpm run db:migrate:revert   # Revert last migration
pnpm run db:generate         # Generate new migration
```

---

## 🔍 Accessing Databases

### PostgreSQL (psql)

```bash
# Docker
docker exec -it agent_skills_db psql -U postgres -d agent_skills

# Local (if installed)
psql -h localhost -U postgres -d agent_skills
```

### Redis CLI

```bash
# Docker
docker exec -it agent_skills_redis redis-cli

# Local (if installed)
redis-cli -h localhost -p 6379
```

### Adminer (Web UI)

1. Open http://localhost:8080
2. Login:
   - System: PostgreSQL
   - Server: postgres
   - Username: postgres
   - Password: postgres
   - Database: agent_skills

---

## 📝 Usage Examples

### SessionRepository

```typescript
import { SessionRepository } from '@infrastructure/persistence/repositories/session.repository';
import { MessageRole } from '@infrastructure/database/typeorm/entities/chat-message.entity';

// Create session
const session = await sessionRepository.create({
  sessionId: 'mcp-session-123',
  userId: 'user-uuid',
  title: 'Clean Architecture Discussion',
});

// Add message
await sessionRepository.addMessage({
  sessionId: 'mcp-session-123',
  role: MessageRole.USER,
  content: 'How do I implement CQRS?',
  metadata: {
    agentId: 'SearchAgent',
    searchQuery: 'CQRS',
    searchResults: 5,
  },
});

// Get messages
const messages = await sessionRepository.getMessages('mcp-session-123', 50);

// Close session
await sessionRepository.close('mcp-session-123');
```

### RedisService

```typescript
import { RedisService } from '@infrastructure/database/redis/redis.service';

// Cache
await redisService.cacheSet('search:clean_architecture', results, 3600);
const cached = await redisService.cacheGet('search:clean_architecture');

// Sessions
await redisService.setSession('session-123', data, 86400);
const session = await redisService.getSession('session-123');

// Rate Limiting
const limit = await redisService.incrementRateLimit('192.168.1.1', 60);
if (limit.remaining === 0) {
  throw new TooManyRequestsException();
}
```

---

## 🐛 Troubleshooting

### PostgreSQL Connection Error

```bash
# Check if container is running
docker ps | grep postgres

# Restart container
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Redis Connection Error

```bash
# Check if container is running
docker ps | grep redis

# Test connection
docker exec -it agent_skills_redis redis-cli ping
```

### Port Already in Use

```bash
# Find process using port 5432
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Database Not Created

```bash
# Stop containers
docker-compose down

# Remove volumes
docker volume rm agent-skills-api_postgres_data

# Start again
docker-compose up -d
```

---

## 📊 Health Checks

### PostgreSQL
```bash
docker exec agent_skills_db pg_isready -U postgres -d agent_skills
```

### Redis
```bash
docker exec agent_skills_redis redis-cli ping
```

### ChromaDB
```bash
curl http://localhost:8000/api/v1/heartbeat
```

---

## 🔐 Security Notes

- **Development**: Default credentials are for local development only
- **Production**: Change all passwords in `.env`
- **SSL**: Enable `DB_SSL=true` for production
- **Network**: Services are on isolated Docker network

---

## 📚 References

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [ChromaDB Documentation](https://docs.trychroma.com/)

---

**Last Updated**: 22 de marzo de 2026
**Author**: CodeMentor MCP
