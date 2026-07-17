import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateClaudeMdCommand } from './update-claude-md.command';
import { ClaudeMdUpdaterService } from '@modules/agency-agents/application/services/claude-md-updater.service';
import { Logger } from '@nestjs/common';

@CommandHandler(UpdateClaudeMdCommand)
export class UpdateClaudeMdHandler implements ICommandHandler<UpdateClaudeMdCommand> {
  private readonly logger = new Logger(UpdateClaudeMdHandler.name);

  constructor(private readonly claudeMdUpdater: ClaudeMdUpdaterService) {}

  async execute(command: UpdateClaudeMdCommand) {
    const { targetPath } = command;
    this.logger.log(`Updating CLAUDE.md${targetPath ? ` at ${targetPath}` : ''}`);
    return this.claudeMdUpdater.update(targetPath);
  }
}
