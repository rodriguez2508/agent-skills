import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { User } from '@modules/auth/decorators/user.decorator';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { ChatMessagesService } from '@modules/sessions/application/services/chat-messages.service';
import { ProjectsService } from '@modules/projects/application/services/projects.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectChatController {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly chatMessagesService: ChatMessagesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get(':id/sessions')
  @HttpCode(HttpStatus.OK)
  async getProjectSessions(
    @Param('id') id: string,
    @User('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const sessions = await this.sessionRepo.findByProjectId(id, parseInt(limit || '20', 10));

    const sessionsWithCounts = await Promise.all(
      sessions.map(async (s) => {
        const messageCount = await this.chatMessagesService.getMessageCount(s.sessionId);
        return { ...s, redisMessageCount: messageCount };
      }),
    );

    return {
      success: true,
      data: { sessions: sessionsWithCounts, total: sessionsWithCounts.length },
    };
  }

  @Get(':id/sessions/:sessionId/messages')
  @HttpCode(HttpStatus.OK)
  async getSessionMessages(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @User('id') userId: string,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const messages = await this.chatMessagesService.getMessages(sessionId);
    return {
      success: true,
      data: { messages, total: messages.length },
    };
  }
}
