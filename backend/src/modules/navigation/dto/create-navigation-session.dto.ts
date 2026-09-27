import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { RouteCoordinateDto } from '../../routing/dto/route-preview.dto';
import { TravelMode } from '../../routing/routing.types';

export class NavigationRouteGeometryDto {
  @ApiProperty({ enum: ['LineString'], example: 'LineString' })
  @IsIn(['LineString'])
  type!: 'LineString';

  @ApiProperty({
    description: 'GeoJSON coordinate pairs in longitude, latitude order',
    example: [
      [3.4, 6.4],
      [3.5, 6.5],
    ],
    type: 'array',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10_000)
  @IsArray({ each: true })
  coordinates!: number[][];
}

export class SelectedNavigationRouteDto {
  @ApiPropertyOptional({ description: 'Opaque route ID returned by the route preview API' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  id?: string;

  @ApiProperty({ type: NavigationRouteGeometryDto })
  @ValidateNested()
  @Type(() => NavigationRouteGeometryDto)
  geometry!: NavigationRouteGeometryDto;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMeters!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds!: number;
}

export class CreateNavigationSessionDto {
  @ApiProperty({ type: RouteCoordinateDto })
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  origin!: RouteCoordinateDto;

  @ApiProperty({ type: RouteCoordinateDto })
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  destination!: RouteCoordinateDto;

  @ApiProperty({ enum: TravelMode })
  @IsEnum(TravelMode)
  travelMode!: TravelMode;

  @ApiProperty({ type: SelectedNavigationRouteDto })
  @ValidateNested()
  @Type(() => SelectedNavigationRouteDto)
  route!: SelectedNavigationRouteDto;
}
