import { CompleteRegistrationDto } from '../../../dto/complete-registration.dto';

export class CompleteRegistrationCommand {
  constructor(
    public readonly dto: CompleteRegistrationDto,
    public readonly ipAddress: string,
  ) {}
}
