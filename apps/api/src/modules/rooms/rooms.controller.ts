import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
  // The envelope only; the game's engine decides what is valid inside.
  settings: z.record(z.string(), z.unknown()).optional(),
});

const setReadySchema = z.object({ ready: z.boolean() });

const updateSettingsSchema = z.object({ settings: z.record(z.string(), z.unknown()) });

const addBotSchema = z.object({ level: z.enum(['easy', 'normal', 'hard']) });

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

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RoomDto[]> {
    return this.rooms.listForLobby(user.userId);
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

  @Delete(':roomId/members/:memberUserId')
  kick(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('memberUserId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomDto> {
    return this.rooms.kick(roomId, user.userId, memberUserId);
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

  @Put(':roomId/settings')
  updateSettings(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: z.infer<typeof updateSettingsSchema>,
  ): Promise<RoomDto> {
    return this.rooms.updateSettings(roomId, user.userId, body.settings);
  }

  @Post(':roomId/bots')
  @HttpCode(200)
  addBot(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addBotSchema)) body: z.infer<typeof addBotSchema>,
  ): Promise<RoomDto> {
    return this.rooms.addBot(roomId, user.userId, body.level);
  }

  @Delete(':roomId/bots/:botUserId')
  removeBot(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('botUserId', ParseUUIDPipe) botUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomDto> {
    return this.rooms.removeBot(roomId, user.userId, botUserId);
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
