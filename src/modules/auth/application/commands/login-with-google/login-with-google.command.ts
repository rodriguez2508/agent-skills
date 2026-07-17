import { LoginGoogleDto } from '../../../dto/login.dto';

export class LoginWithGoogleCommand {
  constructor(
    public readonly loginGoogleDto: LoginGoogleDto,
    public readonly ipAddress: string,
  ) {}
}
