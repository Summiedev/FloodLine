export interface StorageUploadRequest {
  storageKey: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
}

export interface StorageUploadAuthorization {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObjectMetadata {
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export interface StorageReadUrl {
  url: string;
  expiresAt: Date;
}

/**
 * Provider boundary for direct-to-object-storage media uploads.
 * An S3-compatible adapter can implement this interface without leaking SDK
 * types into the media domain.
 */
export interface StorageProvider {
  authorizeUpload(request: StorageUploadRequest): Promise<StorageUploadAuthorization>;
  inspectObject(storageKey: string): Promise<StoredObjectMetadata | null>;
  createReadUrl(storageKey: string, expiresInSeconds: number): Promise<StorageReadUrl>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
