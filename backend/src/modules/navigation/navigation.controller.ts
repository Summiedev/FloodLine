import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CreateNavigationSessionDto } from './dto/create-navigation-session.dto';
import { NavigationService } from './navigation.service';

@Controller({ path: 'navigation/sessions', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Start an authenticated active-navigation session' })
  start(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateNavigationSessionDto) {
    return this.navigationService.start(user.userId, {
      origin: dto.origin,
      destination: dto.destination,
      travelMode: dto.travelMode,
      route: {
        id: dto.route.id,
        geometry: {
          type: dto.route.geometry.type,
          coordinates: dto.route.geometry.coordinates.map(
            (point) => [point[0], point[1]] as [number, number],
          ),
        },
        distanceMeters: dto.route.distanceMeters,
        durationSeconds: dto.route.durationSeconds,
      },
    });
  }

  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get an owned active-navigation session and route updates' })
  findById(@CurrentUser() user: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.navigationService.findOwned(user.userId, id);
  }

  @Delete(':id')
  @Version('1')
  @ApiOperation({ summary: 'Stop an owned active-navigation session' })
  async cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.navigationService.cancel(user.userId, id);
  }
}
