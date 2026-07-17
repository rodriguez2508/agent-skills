import { InstallationProfile } from '@modules/agency-agents/domain/entities/installation-profile.entity';

export class CreateBackupCommand {
  constructor(public readonly profile: InstallationProfile) {}
}
