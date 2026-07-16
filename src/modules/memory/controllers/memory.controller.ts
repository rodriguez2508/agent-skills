import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MemoryFileService } from '../services/memory-file.service';
import { MemorySearchService } from '../services/memory-search.service';

@ApiTags('memory')
@Controller('memory')
export class MemoryController {
  private readonly logger = new Logger(MemoryController.name);

  constructor(
    private readonly memoryFileService: MemoryFileService,
    private readonly memorySearchService: MemorySearchService,
  ) {}

  @Get('l1')
  @ApiOperation({ summary: 'Obtiene toda la memoria L1 (MEMORY.md + USER.md) inyectada' })
  async getL1Memory() {
    const context = await this.memoryFileService.buildInjectedContext();
    const memory = await this.memoryFileService.getMemory();
    const user = await this.memoryFileService.getUser();
    return {
      success: true,
      context,
      memory: { entries: memory.entries.length },
      user: { entries: user.entries.length },
    };
  }

  @Post('l1/memory')
  @ApiOperation({ summary: 'Agrega una entrada a MEMORY.md (conocimiento del proyecto)' })
  async addMemoryEntry(
    @Body()
    body: {
      key: string;
      content: string;
      category?: string;
      tags?: string[];
    },
  ) {
    if (!body.key || !body.content) {
      return { success: false, error: 'key and content are required' };
    }
    const doc = await this.memoryFileService.addMemoryEntry({
      key: body.key,
      content: body.content,
      category: body.category || 'context',
      tags: body.tags || [],
    });
    return {
      success: true,
      entryCount: doc.entries.length,
      key: body.key,
    };
  }

  @Post('l1/user')
  @ApiOperation({ summary: 'Agrega una entrada a USER.md (preferencias del usuario)' })
  async addUserEntry(
    @Body()
    body: {
      key: string;
      content: string;
      category?: string;
      tags?: string[];
    },
  ) {
    if (!body.key || !body.content) {
      return { success: false, error: 'key and content are required' };
    }
    const doc = await this.memoryFileService.addUserEntry({
      key: body.key,
      content: body.content,
      category: body.category || 'preference',
      tags: body.tags || [],
    });
    return {
      success: true,
      entryCount: doc.entries.length,
      key: body.key,
    };
  }

  @Post('l1/remove')
  @ApiOperation({ summary: 'Elimina una entrada de MEMORY.md o USER.md por key' })
  async removeEntry(
    @Body() body: { key: string; file: 'memory' | 'user' },
  ) {
    if (!body.key) return { success: false, error: 'key is required' };
    if (body.file === 'user') {
      await this.memoryFileService.removeUserEntry(body.key);
    } else {
      await this.memoryFileService.removeMemoryEntry(body.key);
    }
    return { success: true, key: body.key };
  }

  @Get('l2/search')
  @ApiOperation({ summary: 'Busca en el historial completo de conversaciones (L2)' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @Query('sessionId') sessionId?: string,
  ) {
    if (!query) return { success: false, error: 'query (q) is required' };
    const results = await this.memorySearchService.search(query, {
      limit: limit || 10,
      sessionId,
    });
    return { success: true, count: results.length, results };
  }

  @Get('inject')
  @ApiOperation({ summary: 'Obtiene el contexto de memoria L1 para inyección en prompts' })
  async getInjectionContext() {
    const context = await this.memoryFileService.buildInjectedContext();
    return { success: true, context, hasContent: context.length > 0 };
  }
}
