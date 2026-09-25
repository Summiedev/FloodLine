import type { MediaStatus } from '@prisma/client';

export interface MediaResponseDto {
  id: string;
  reportId: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  status: MediaStatus;
  createdAt: Date;
  accessUrl?: string;
  accessUrlExpiresAt?: Date;
}

export interface MediaUploadAuthorizationResponse {
  media: MediaResponseDto;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: Date;
  };
}

export interface MediaPhotoSummary {
  id: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  accessUrl?: string;
  accessUrlExpiresAt?: Date;
}
