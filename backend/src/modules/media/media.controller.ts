import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { AuthorizeMediaUploadDto } from './dto/authorize-media-upload.dto';
import { MediaService } from './media.service';

const MEDIA_RATE_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@Controller({ path: 'media', version: '1' })
@ApiTags('media')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(MEDIA_RATE_LIMIT)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Authorize a direct image upload for an owned flood report' })
  authorizeUpload(@CurrentUser() user: AuthPrincipal, @Body() dto: AuthorizeMediaUploadDto) {
    return this.mediaService.authorizeUpload(user.userId, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an uploaded image and make it available on the report' })
  completeUpload(@CurrentUser() user: AuthPrincipal, @Param('id') mediaId: string) {
    return this.mediaService.completeUpload(user.userId, mediaId);
  }
}
