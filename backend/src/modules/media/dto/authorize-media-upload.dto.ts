import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { MAX_REQUESTED_MEDIA_BYTES, SUPPORTED_IMAGE_CONTENT_TYPES } from '../media.constants';

export class AuthorizeMediaUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  reportId!: string;

  @ApiProperty({ enum: SUPPORTED_IMAGE_CONTENT_TYPES })
  @IsString()
  @IsIn(SUPPORTED_IMAGE_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({ description: 'Expected image size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REQUESTED_MEDIA_BYTES)
  byteSize!: number;
}
