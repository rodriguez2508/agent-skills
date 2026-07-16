import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryFileService } from './services/memory-file.service';
import { MemorySearchService } from './services/memory-search.service';
import { MemoryController } from './controllers/memory.controller';
import { ChatMessage } from '@modules/sessions/domain/entities/chat-message.entity';
import { Context } from '@modules/contexts/domain/entities/context.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, Context])],
  controllers: [MemoryController],
  providers: [MemoryFileService, MemorySearchService],
  exports: [MemoryFileService, MemorySearchService],
})
export class MemoryModule {}
