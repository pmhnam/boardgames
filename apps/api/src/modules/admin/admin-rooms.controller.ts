import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminRoomDto, Page } from '@bgp/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { roomListQuerySchema, type RoomListQuery } from './admin.schemas.js';

@Controller('admin/rooms')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminRoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(roomListQuerySchema)) query: RoomListQuery,
  ): Promise<Page<AdminRoomDto>> {
    const { limit, offset, ...filter } = query;
    return this.rooms.listForAdmin(filter, { limit, offset });
  }

  @Get(':roomId')
  get(@Param('roomId', ParseUUIDPipe) roomId: string): Promise<AdminRoomDto> {
    return this.rooms.getForAdmin(roomId);
  }

  @Post(':roomId/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<AdminRoomDto> {
    return this.rooms.adminClose(roomId, user.userId);
  }

  @Delete(':roomId/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
  ): Promise<AdminRoomDto> {
    return this.rooms.adminRemoveMember(roomId, memberUserId, user.userId);
  }
}
