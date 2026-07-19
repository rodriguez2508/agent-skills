import { Controller, Get, Post, Delete, Param, Query, Body, Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { ContextRepository } from '@modules/contexts/infrastructure/persistence/context.repository';
import { ContextType } from '@modules/contexts/domain/entities/context.entity';

@Controller('memory')
@UseGuards(AuthGuard)
export class MemoryController {
  private readonly logger = new Logger(MemoryController.name);

  constructor(private readonly contextRepository: ContextRepository) {}

  @Get(':projectId')
  async listByProject(@Param('projectId') projectId: string) {
    const entries = await this.contextRepository.findByProjectId(projectId, ContextType.MEMORY);
    return {
      success: true,
      data: {
        entries: entries.map(e => ({
          id: e.id,
          key: e.extractedInfo?.key || e.summary,
          content: e.extractedInfo?.content || '',
          category: e.extractedInfo?.category || 'context',
          tags: e.extractedInfo?.tags || [],
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        })),
        total: entries.length,
      },
    };
  }

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() body: { key: string; content: string; category?: string; tags?: string[] },
  ) {
    if (!body.key || !body.content) {
      return { success: false, error: 'key and content are required' };
    }

    const existing = await this.contextRepository.findByProjectId(projectId, ContextType.MEMORY);
    const duplicate = existing.find(e => e.extractedInfo?.key === body.key);

    if (duplicate) {
      await this.contextRepository.update(duplicate.id, {
        extractedInfo: {
          ...duplicate.extractedInfo,
          content: body.content,
          category: body.category || 'context',
          tags: body.tags || [],
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await this.contextRepository.create({
        projectId,
        type: ContextType.MEMORY,
        summary: body.key,
        extractedInfo: {
          type: 'memory',
          key: body.key,
          content: body.content,
          category: body.category || 'context',
          tags: body.tags || [],
          savedAt: new Date().toISOString(),
        },
      });
    }

    return { success: true, key: body.key };
  }

  @Delete(':projectId/:entryId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
  ) {
    const entries = await this.contextRepository.findByProjectId(projectId, ContextType.MEMORY);
    const target = entries.find(e => e.id === entryId);
    if (!target) {
      return { success: false, error: 'Entry not found' };
    }
    await this.contextRepository.deactivate(entryId);
    return { success: true };
  }

  @Get(':projectId/search')
  async search(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    if (!query) return { success: false, error: 'query (q) is required' };

    const entries = await this.contextRepository.findByProjectId(projectId, ContextType.MEMORY);
    const term = query.toLowerCase();
    const scored = entries.map(e => {
      const text = `${e.summary || ''} ${e.extractedInfo?.content || ''} ${(e.extractedInfo?.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      if (text.includes(term)) score += 0.5;
      for (const word of term.split(/\s+/)) {
        if (word.length < 2) continue;
        const matches = text.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
        if (matches) score += 0.1 * matches.length;
      }
      return { entry: e, score: Math.min(score, 1) };
    })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || 10);

    return {
      success: true,
      count: scored.length,
      results: scored.map(({ entry, score }) => ({
        id: entry.id,
        key: entry.extractedInfo?.key || entry.summary,
        content: entry.extractedInfo?.content || '',
        score,
        createdAt: entry.createdAt,
      })),
    };
  }
}
