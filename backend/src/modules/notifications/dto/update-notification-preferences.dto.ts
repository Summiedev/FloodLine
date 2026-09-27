import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Enable app/push notifications' })
  @IsOptional()
  @IsBoolean()
  appPushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable SMS notifications after phone verification' })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable WhatsApp notifications after connection verification',
  })
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;
}
