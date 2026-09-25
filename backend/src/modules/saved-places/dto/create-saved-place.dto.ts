import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';
import { SavedPlaceType } from '@prisma/client';

export class CreateSavedPlaceDto {
  @ApiProperty({ enum: SavedPlaceType })
  @IsEnum(SavedPlaceType)
  type!: SavedPlaceType;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  customLabel?: string;

  @ApiProperty({ description: 'WGS84 longitude, from -180 to 180' })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ description: 'WGS84 latitude, from -90 to 90' })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Length(1, 500)
  formattedAddress!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  providerPlaceId?: string;
}
