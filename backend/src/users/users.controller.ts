import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const user = (req as any).user;
    const userWithAssistant = await this.userService.getUserWithAssistant(
      user.id,
    );

    if (!userWithAssistant) {
      return {
        status: true,
        user: user,
      };
    }

    return {
      status: true,
      user: userWithAssistant.user,
      default_assistant: userWithAssistant.default_assistant,
    };
  }
}
