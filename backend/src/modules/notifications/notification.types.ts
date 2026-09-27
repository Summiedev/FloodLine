import type {
  DevicePlatform,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEndpointStatus,
  IncidentSeverity,
  NotificationState,
  NotificationType,
  PhoneVerificationPurpose,
  WhatsAppConnectionStatus,
} from '@prisma/client';

export interface NotificationPreferenceResponse {
  channel: NotificationChannel;
  enabled: boolean;
  available: boolean;
  reason?: string;
}

export interface NotificationPreferencesResponse {
  channels: NotificationPreferenceResponse[];
}

export interface NotificationPreferenceUpdateInput {
  appPushEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
}

export interface DeviceRegistrationResponse {
  id: string;
  platform: DevicePlatform;
  appVersion: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface DeviceRegistrationInput {
  token: string;
  platform: DevicePlatform;
  appVersion?: string;
}

export interface VerificationStartResponse {
  expiresAt: Date;
  destination: string;
  purpose: PhoneVerificationPurpose;
}

export interface MessagingDestinationState {
  id: string;
  phoneNumber: string;
  phoneVerifiedAt: Date | null;
  whatsappStatus: WhatsAppConnectionStatus;
  whatsappVerifiedAt: Date | null;
}

export interface NotificationEndpointRecord {
  id: string;
  userId: string;
  channel: NotificationChannel;
  destinationHash: string;
  status: NotificationEndpointStatus;
  verifiedAt: Date | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  incidentId: string | null;
  officialWarningId: string | null;
  savedPlaceId: string | null;
  notificationType: NotificationType;
  severity: IncidentSeverity;
  dedupeKey: string;
  triggerKey: string;
  escalationLevel: number;
  title: string;
  body: string;
  templateParameters: Record<string, unknown> | null;
  state: NotificationState;
  readAt: Date | null;
}

export interface NotificationDeliveryRecord {
  id: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  providerMessageId: string | null;
  title: string;
  body: string;
  incidentId: string | null;
  officialWarningId: string | null;
}

export interface AlertTarget {
  userId: string;
  savedPlaceId: string;
  savedPlaceLabel: string;
  distanceMeters: number;
  enabledChannels: NotificationChannel[];
  sourceId: string;
  sourceType: NotificationType;
  incidentType: string;
  severity: string;
  title: string;
  body: string;
}
