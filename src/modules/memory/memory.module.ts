import { Module, Global } from '@nestjs/common';
import { MemoryController } from './controllers/memory.controller';
import { ContextsModule } from '@modules/contexts/contexts.module';
import { AuthModule } from '@modules/auth/auth.module';

@Global()
@Module({
  imports: [ContextsModule, AuthModule],
  controllers: [MemoryController],
  exports: [],
})
export class MemoryModule {}
