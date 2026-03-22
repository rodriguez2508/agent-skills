# Database Migrations Guide

## 🚀 Quick Start

### 1. Create Database

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE agent_skills;

-- Enable UUID extension
\c agent_skills
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE session_status AS ENUM ('active', 'ended');
```

### 2. Run Migrations

```bash
# Run all pending migrations
pnpm run db:migrate

# Check migration status
docker exec -it agent_skills_db psql -U postgres -d agent_skills -c "SELECT * FROM migrations ORDER BY id;"
```

---

## 📦 Available Commands

```bash
# Generate new migration
pnpm run db:generate -- src/infrastructure/database/typeorm/migrations/CreateUsersTable

# Run migrations
pnpm run db:migrate

# Revert last migration
pnpm run db:migrate:revert

# Manual migration with ts-node
npx typeorm-ts-node-commonjs migration:run -d src/infrastructure/database/typeorm/data-source.ts
```

---

## 📝 Migration Files Structure

```
src/infrastructure/database/typeorm/
├── migrations/
│   ├── 1711152000000-CreateTables.ts          # Initial schema
│   ├── 1711152000001-AddUserRoles.ts          # Example: Add user roles
│   └── ...
├── entities/
│   ├── user.entity.ts
│   ├── session.entity.ts
│   └── chat-message.entity.ts
├── data-source.ts                              # CLI configuration
└── typeorm.config.ts                           # Runtime configuration
```

---

## 🔧 Creating a New Migration

### Step 1: Generate Migration

```bash
# Option A: Auto-generate from entity changes
pnpm run db:generate -- src/infrastructure/database/typeorm/migrations/AddUserAvatar

# Option B: Create manually
touch src/infrastructure/database/typeorm/migrations/1711152000001-AddUserAvatar.ts
```

### Step 2: Edit Migration

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserAvatar1711152000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'avatar_url',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'avatar_url');
  }
}
```

### Step 3: Run Migration

```bash
pnpm run db:migrate
```

---

## 🐛 Troubleshooting

### Migration Already Exists

```bash
# Check migrations table
docker exec -it agent_skills_db psql -U postgres -d agent_skills -c "SELECT * FROM migrations;"

# Remove migration from table (if needed)
docker exec -it agent_skills_db psql -U postgres -d agent_skills -c "DELETE FROM migrations WHERE name = 'CreateTables1711152000000';"
```

### Migration Failed

```bash
# Check error logs
docker-compose logs postgres

# Revert last migration
pnpm run db:migrate:revert

# Fix migration file and run again
pnpm run db:migrate
```

### Database Not Found

```bash
# Create database manually
docker exec -it agent_skills_db psql -U postgres -c "CREATE DATABASE agent_skills;"

# Or restart with init script
docker-compose down -v
docker-compose up -d
```

---

## 📊 Current Migrations

| Timestamp | Name | Status |
|-----------|------|--------|
| 1711152000000 | CreateTables | ✅ Applied |

---

## 🔍 Useful SQL Queries

### Check Migrations

```sql
SELECT id, timestamp, name 
FROM migrations 
ORDER BY timestamp DESC;
```

### Check Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

### Check Indexes

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public';
```

### Check Foreign Keys

```sql
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

---

## 🎯 Best Practices

1. **Never edit applied migrations** - Create new ones instead
2. **Use timestamps in filenames** - Ensures correct order
3. **Always implement `down()`** - For rollback capability
4. **Test migrations locally** - Before deploying
5. **Backup before migrating** - In production

---

## 📚 References

- [TypeORM Migrations](https://typeorm.io/migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Last Updated**: 22 de marzo de 2026
**Author**: CodeMentor MCP
