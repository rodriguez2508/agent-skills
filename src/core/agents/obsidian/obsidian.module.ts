import { Module } from '@nestjs/common';
import { ObsidianAgent } from './obsidian.agent';
import { ObsidianVaultService } from './obsidian-vault.service';

@Module({
  providers: [ObsidianAgent, ObsidianVaultService],
  exports: [ObsidianAgent],
})
export class ObsidianModule {}
