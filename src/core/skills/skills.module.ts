import { Module, Global } from '@nestjs/common';
import { SkillFileService } from './services/skill-file.service';
import { SkillController } from './controllers/skill.controller';
import { SkillLearningService } from './services/skill-learning.service';
import { SkillResolverService } from './services/skill-resolver.service';
import { AgenciesModule } from '@modules/agencies/agencies.module';

@Global()
@Module({
  imports: [AgenciesModule],
  controllers: [SkillController],
  providers: [SkillFileService, SkillLearningService, SkillResolverService],
  exports: [SkillFileService, SkillLearningService, SkillResolverService],
})
export class SkillsModule {}
