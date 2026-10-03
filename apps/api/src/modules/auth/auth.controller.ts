import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthSessionDto, UserDto } from '@bgp/shared-types';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

const guestLoginSchema = z.object({
  displayName: z.string().trim().min(1).max(32),
});

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/guest')
  loginAsGuest(
    @Body(new ZodValidationPipe(guestLoginSchema)) body: z.infer<typeof guestLoginSchema>,
  ): Promise<AuthSessionDto> {
    return this.auth.loginAsGuest(body.displayName);
  }

  @Get('users/me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.auth.getUser(user.userId);
  }
}
