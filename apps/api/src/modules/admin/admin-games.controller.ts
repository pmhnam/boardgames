import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminGameConfigDto,
  AdminGameDto,
  ConfigReplayImpactDto,
  GameConfigDocumentDto,
  GameConfigSummaryDto,
  Page,
} from '@bgp/shared-types';
import type { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { GameConfigService } from '../games/game-config.service.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  pageQuerySchema,
  publishConfigSchema,
  restoreConfigSchema,
  validateConfigSchema,
  type PageQuery,
} from './admin.schemas.js';

@Controller('admin/games')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminGamesController {
  constructor(
    private readonly configs: GameConfigService,
    private readonly matches: MatchesService,
  ) {}

  @Get()
  list(): Promise<AdminGameDto[]> {
    return this.configs.listForAdmin();
  }

  @Get(':gameType/configs')
  listVersions(
    @Param('gameType') gameType: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) page: PageQuery,
  ): Promise<Page<GameConfigSummaryDto>> {
    return this.configs.listVersions(gameType, page);
  }

  @Get(':gameType/configs/:version')
  getVersion(
    @Param('gameType') gameType: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<AdminGameConfigDto> {
    return this.configs.getVersion(gameType, version);
  }

  @Get(':gameType/config-default')
  getDefault(@Param('gameType') gameType: string): GameConfigDocumentDto {
    return this.configs.getDefault(gameType);
  }

  @Get(':gameType/replay-impact')
  replayImpact(@Param('gameType') gameType: string): Promise<ConfigReplayImpactDto> {
    return this.matches.replayImpact(gameType);
  }

  @Post(':gameType/configs/validate')
  @HttpCode(200)
  validate(
    @Param('gameType') gameType: string,
    @Body(new ZodValidationPipe(validateConfigSchema)) body: z.infer<typeof validateConfigSchema>,
  ): GameConfigDocumentDto {
    return this.configs.validate(gameType, body.config);
  }

  @Post(':gameType/configs')
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameType') gameType: string,
    @Body(new ZodValidationPipe(publishConfigSchema)) body: z.infer<typeof publishConfigSchema>,
  ): Promise<AdminGameConfigDto> {
    return this.configs.publish(gameType, body.config, {
      note: body.note || null,
      expectedVersion: body.expectedVersion,
      authorId: user.userId,
    });
  }

  @Post(':gameType/configs/:version/restore')
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameType') gameType: string,
    @Param('version', ParseIntPipe) version: number,
    @Body(new ZodValidationPipe(restoreConfigSchema)) body: z.infer<typeof restoreConfigSchema>,
  ): Promise<AdminGameConfigDto> {
    return this.configs.restore(gameType, version, {
      note: body.note || null,
      expectedVersion: body.expectedVersion,
      authorId: user.userId,
    });
  }
}
