import type { SavedPlaceType } from '@prisma/client';
import type { PaginatedResponse } from '../../common/pagination/pagination.dto';

export interface SavedPlaceRecord {
  id: string;
  userId: string;
  type: SavedPlaceType;
  customLabel: string | null;
  longitude: number;
  latitude: number;
  formattedAddress: string;
  providerPlaceId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedPlaceResponse {
  id: string;
  type: SavedPlaceType;
  customLabel: string | null;
  location: { longitude: number; latitude: number; srid: 4326 };
  formattedAddress: string;
  providerPlaceId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedPlaceFilters {
  userId: string;
  page: number;
  pageSize: number;
}

export interface SavedPlaceCreateInput {
  userId: string;
  type: SavedPlaceType;
  customLabel?: string | null;
  longitude: number;
  latitude: number;
  formattedAddress: string;
  providerPlaceId?: string | null;
}

export interface SavedPlaceUpdateInput {
  type?: SavedPlaceType;
  customLabel?: string | null;
  longitude?: number;
  latitude?: number;
  formattedAddress?: string;
  providerPlaceId?: string | null;
  isActive?: boolean;
}

export interface SavedPlaceMatch extends SavedPlaceRecord {
  distanceMeters: number;
}

export type SavedPlaceListResponse = PaginatedResponse<SavedPlaceResponse>;
