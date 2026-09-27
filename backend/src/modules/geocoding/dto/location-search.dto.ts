import { IsString, Length } from 'class-validator';

export class LocationSearchDto {
  @IsString()
  @Length(2, 200)
  q!: string;
}
