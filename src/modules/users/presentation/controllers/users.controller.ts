import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { UserRepository } from '../../infrastructure/persistence/user.repository';
import { AuthGuard } from '../../../auth/guard/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly userRepository: UserRepository) {}

  @Get('search')
  @UseGuards(AuthGuard)
  async search(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    const users = await this.userRepository.searchByEmailOrName(query.trim());
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
    }));
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getUser(@Param('id') id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
  }
}
