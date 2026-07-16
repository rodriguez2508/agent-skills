import { Module, Global } from '@nestjs/common';
import { SkillFileService } from './services/skill-file.service';
import { SkillController } from './controllers/skill.controller';
import { SkillLearningService } from './services/skill-learning.service';

@Global()
@Module({
  controllers: [SkillController],
  providers: [SkillFileService, SkillLearningService],
  exports: [SkillFileService, SkillLearningService],
})
export class SkillsModule {}
