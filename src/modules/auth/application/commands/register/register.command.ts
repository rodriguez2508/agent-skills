import { RegisterDto } from '../../../dto/register.dto';

export class RegisterCommand {
  constructor(public readonly registerDto: RegisterDto) {}
}
