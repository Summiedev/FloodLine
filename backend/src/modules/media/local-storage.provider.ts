import { Injectable } from '@nestjs/common';
import {
  StorageProvider,
  StorageReadUrl,
  StorageUploadAuthorization,
  StorageUploadRequest,
  StoredObjectMetadata,
} from './storage-provider';

/**
 * In-memory provider for local/test environments. It deliberately exposes no
 * arbitrary-key upload API; tests may seed an object through putObject after
 * receiving the server-generated key from an authorization response.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, StoredObjectMetadata>();

  authorizeUpload(request: StorageUploadRequest): Promise<StorageUploadAuthorization> {
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1_000);
    return Promise.resolve({
      method: 'PUT',
      url: `local://upload/${encodeURIComponent(request.storageKey)}?expiresAt=${expiresAt.getTime()}`,
      headers: {
        'content-type': request.contentType,
        'content-length': String(request.maxBytes),
      },
      expiresAt,
    });
  }

  inspectObject(storageKey: string): Promise<StoredObjectMetadata | null> {
    return Promise.resolve(this.objects.get(storageKey) ?? null);
  }

  createReadUrl(storageKey: string, expiresInSeconds: number): Promise<StorageReadUrl> {
    if (!this.objects.has(storageKey)) {
      throw new Error('Object does not exist');
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000);
    return Promise.resolve({
      url: `local://read/${encodeURIComponent(storageKey)}?expiresAt=${expiresAt.getTime()}`,
      expiresAt,
    });
  }

  putObject(storageKey: string, metadata: StoredObjectMetadata): void {
    this.objects.set(storageKey, metadata);
  }
}
