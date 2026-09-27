import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { TravelMode } from '../routing.types';

export class RouteCoordinateDto {
  @ApiProperty({ description: 'WGS84 longitude; longitude is the first coordinate' })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ description: 'WGS84 latitude; distance units are meters' })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude!: number;
}

export class RoutePreviewDto {
  @ApiProperty({ type: RouteCoordinateDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  origin!: RouteCoordinateDto;

  @ApiProperty({ type: RouteCoordinateDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  destination!: RouteCoordinateDto;

  @ApiProperty({ enum: TravelMode })
  @IsEnum(TravelMode)
  travelMode!: TravelMode;

  @ApiPropertyOptional({ type: RouteCoordinateDto, isArray: true, maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RouteCoordinateDto)
  waypoints?: RouteCoordinateDto[];
}
