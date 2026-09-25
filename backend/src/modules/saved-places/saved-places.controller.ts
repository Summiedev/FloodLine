import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CreateSavedPlaceDto } from './dto/create-saved-place.dto';
import { SavedPlaceQueryDto } from './dto/saved-place-query.dto';
import { UpdateSavedPlaceDto } from './dto/update-saved-place.dto';
import { SavedPlacesService } from './saved-places.service';

@Controller({ path: 'saved-places', version: '1' })
@ApiTags('saved-places')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class SavedPlacesController {
  constructor(private readonly savedPlacesService: SavedPlacesService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List the current user saved places' })
  list(@CurrentUser() user: AuthPrincipal, @Query() query: SavedPlaceQueryDto) {
    return this.savedPlacesService.list(user.userId, query.page, query.pageSize);
  }

  @Post()
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a saved place' })
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateSavedPlaceDto) {
    return this.savedPlacesService.create({
      userId: user.userId,
      type: dto.type,
      customLabel: dto.customLabel,
      longitude: dto.longitude,
      latitude: dto.latitude,
      formattedAddress: dto.formattedAddress,
      providerPlaceId: dto.providerPlaceId,
    });
  }

  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get one of the current user saved places' })
  findById(@CurrentUser() user: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.savedPlacesService.findById(id, user.userId);
  }

  @Patch(':id')
  @Version('1')
  @ApiOperation({ summary: 'Update one of the current user saved places' })
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedPlaceDto,
  ) {
    return this.savedPlacesService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the current user saved places' })
  async delete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.savedPlacesService.delete(id, user.userId);
  }
}
