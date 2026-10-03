import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { RoomDto, StartRoomResponse } from '@bgp/shared-types';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RoomsService } from './rooms.service.js';

const createRoomSchema = z.object({
  gameType: z.string().min(1),
  visibility: z.enum(['private', 'public']).default('private'),
});

const setReadySchema = z.object({ ready: z.boolean() });

@Controller('rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRoomSchema)) body: z.infer<typeof createRoomSchema>,
  ): Promise<RoomDto> {
    return this.rooms.create(user.userId, body);
  }

  @Get('by-code/:code')
  getByCode(@Param('code') code: string): Promise<RoomDto> {
    return this.rooms.getByCode(code);
  }

  @Get(':roomId')
  get(@Param('roomId', ParseUUIDPipe) roomId: string): Promise<RoomDto> {
    return this.rooms.getDto(roomId);
  }

  @Post(':roomId/join')
  @HttpCode(200)
  join(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomDto> {
    return this.rooms.join(roomId, user.userId);
  }

  @Post(':roomId/leave')
  @HttpCode(200)
  leave(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomDto> {
    return this.rooms.leave(roomId, user.userId);
  }

  @Post(':roomId/ready')
  @HttpCode(200)
  setReady(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(setReadySchema)) body: z.infer<typeof setReadySchema>,
  ): Promise<RoomDto> {
    return this.rooms.setReady(roomId, user.userId, body.ready);
  }

  @Post(':roomId/start')
  @HttpCode(200)
  start(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StartRoomResponse> {
    return this.rooms.start(roomId, user.userId);
  }
}
