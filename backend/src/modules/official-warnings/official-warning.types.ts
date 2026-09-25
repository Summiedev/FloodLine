import type { IncidentSeverity, OfficialWarningStatus } from '@prisma/client';
import type { PaginatedResponse } from '../../common/pagination/pagination.dto';

export const OFFICIAL_WARNING_PROVIDER = Symbol('OFFICIAL_WARNING_PROVIDER');

export type OfficialWarningGeometryType =
  'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';

export interface OfficialWarningGeometry {
  type: OfficialWarningGeometryType;
  coordinates: unknown;
}

export interface OfficialWarningFeedItem {
  externalId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedGeometry: OfficialWarningGeometry;
  issuedAt: Date;
  effectiveAt: Date;
  expiresAt?: Date | null;
  sourceUrl?: string | null;
  rawProviderMetadata?: Record<string, unknown> | null;
  status?: OfficialWarningStatus;
}

export interface OfficialWarningProvider {
  readonly authority: string;
  fetchWarnings(): Promise<OfficialWarningFeedItem[]>;
}

export interface OfficialWarningUpsertInput extends OfficialWarningFeedItem {
  authority: string;
}

export interface OfficialWarningFilters {
  active?: boolean;
  status?: OfficialWarningStatus;
  longitude?: number;
  latitude?: number;
  radiusMeters?: number;
  issuedFrom?: Date;
  issuedTo?: Date;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  updatedSince?: Date;
  page: number;
  pageSize: number;
}

export interface OfficialWarningRecord {
  id: string;
  authority: string;
  externalId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: OfficialWarningStatus;
  affectedGeometry: OfficialWarningGeometry;
  issuedAt: Date;
  effectiveAt: Date;
  expiresAt: Date | null;
  sourceUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfficialWarningResponse extends OfficialWarningRecord {
  isActive: boolean;
}

export interface OfficialWarningUpsertResult {
  warning: OfficialWarningRecord;
  created: boolean;
  materiallyChanged: boolean;
  previousStatus: OfficialWarningStatus | null;
}

export type OfficialWarningListResponse = PaginatedResponse<OfficialWarningResponse>;
