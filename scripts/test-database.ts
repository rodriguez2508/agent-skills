/**
 * Database Integration Test Script
 * 
 * Tests PostgreSQL and Redis integration.
 * 
 * Usage:
 *   pnpm ts-node scripts/test-database.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SessionRepository } from '../src/infrastructure/persistence/repositories/session.repository';
import { RedisService } from '../src/infrastructure/database/redis/redis.service';
import { MessageRole } from '../src/infrastructure/database/typeorm/entities/chat-message.entity';

async function bootstrap() {
  console.log('🧪 Starting Database Integration Tests...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const sessionRepository = app.get(SessionRepository);
  const redisService = app.get(RedisService);
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // ========== Test 1: Redis Connection ==========
  try {
    console.log('📦 Test 1: Redis Connection...');
    const health = await redisService.healthCheck();
    
    if (health.status === 'healthy') {
      console.log(`✅ Redis: ${health.status} (latency: ${health.latency}ms)\n`);
      testsPassed++;
    } else {
      console.log(`❌ Redis: ${health.status}\n`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Redis Error: ${error.message}\n`);
    testsFailed++;
  }
  
  // ========== Test 2: Create Session ==========
  try {
    console.log('📦 Test 2: Create Session...');
    const session = await sessionRepository.create({
      sessionId: `test-session-${Date.now()}`,
      title: 'Test Session',
      metadata: { test: true },
    });
    
    console.log(`✅ Session created: ${session.id}`);
    console.log(`   Session ID: ${session.sessionId}\n`);
    testsPassed++;
    
    // ========== Test 3: Add Message ==========
    console.log('📦 Test 3: Add Message to Session...');
    const message = await sessionRepository.addMessage({
      sessionId: session.sessionId,
      role: MessageRole.USER,
      content: 'Hello, this is a test message!',
      metadata: { test: true },
      tokenCount: 10,
    });
    
    console.log(`✅ Message created: ${message.id}`);
    console.log(`   Role: ${message.role}`);
    console.log(`   Content: ${message.content}\n`);
    testsPassed++;
    
    // ========== Test 4: Get Messages ==========
    console.log('📦 Test 4: Get Session Messages...');
    const messages = await sessionRepository.getMessages(session.sessionId);
    
    if (messages.length === 1) {
      console.log(`✅ Retrieved ${messages.length} message(s)\n`);
      testsPassed++;
    } else {
      console.log(`❌ Expected 1 message, got ${messages.length}\n`);
      testsFailed++;
    }
    
    // ========== Test 5: Close Session ==========
    console.log('📦 Test 5: Close Session...');
    const closedSession = await sessionRepository.close(session.sessionId);
    
    console.log(`✅ Session status: ${closedSession.status}\n`);
    testsPassed++;
    
    // ========== Test 6: Redis Cache ==========
    console.log('📦 Test 6: Redis Cache Operations...');
    await redisService.cacheSet('test:key', { foo: 'bar' }, 60);
    const cached = await redisService.cacheGet<{ foo: string }>('test:key');
    
    if (cached && cached.foo === 'bar') {
      console.log(`✅ Cache set/get working\n`);
      testsPassed++;
    } else {
      console.log(`❌ Cache failed\n`);
      testsFailed++;
    }
    
    // ========== Test 7: Redis Session ==========
    console.log('📦 Test 7: Redis Session Storage...');
    await redisService.setSession('test-session-123', { userId: 'user-1', data: 'test' }, 3600);
    const storedSession = await redisService.getSession('test-session-123');
    
    if (storedSession.userId === 'user-1') {
      console.log(`✅ Session storage working\n`);
      testsPassed++;
    } else {
      console.log(`❌ Session storage failed\n`);
      testsFailed++;
    }
    
    // ========== Test 8: Rate Limiting ==========
    console.log('📦 Test 8: Redis Rate Limiting...');
    const limit1 = await redisService.incrementRateLimit('test-ip-123', 60);
    const limit2 = await redisService.incrementRateLimit('test-ip-123', 60);
    
    if (limit1.count === 1 && limit2.count === 2) {
      console.log(`✅ Rate limiting working (count: ${limit2.count})\n`);
      testsPassed++;
    } else {
      console.log(`❌ Rate limiting failed\n`);
      testsFailed++;
    }
    
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await sessionRepository.delete(session.sessionId);
    await redisService.cacheDelete('test:key');
    await redisService.deleteSession('test-session-123');
    await redisService.resetRateLimit('test-ip-123');
    console.log('✅ Cleanup complete\n');
    
  } catch (error) {
    console.log(`❌ Session Test Error: ${error.message}\n`);
    testsFailed++;
  }
  
  // ========== Summary ==========
  console.log('═══════════════════════════════════════');
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('═══════════════════════════════════════');
  
  await app.close();
  process.exit(testsFailed > 0 ? 1 : 0);
}

bootstrap().catch(err => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
