import {
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  StorageProvider,
  StorageReadUrl,
  StorageUploadAuthorization,
  StorageUploadRequest,
  StoredObjectMetadata,
} from './storage-provider';

/**
 * Private S3-compatible object storage adapter. It works with Cloudflare R2
 * and other S3-compatible vendors while FloodLine owns every object key.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client | null;
  private readonly bucket?: string;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('media.s3.endpoint');
    this.bucket = configService.get<string>('media.s3.bucket');
    const accessKeyId = configService.get<string>('media.s3.accessKeyId');
    const secretAccessKey = configService.get<string>('media.s3.secretAccessKey');
    if (endpoint && this.bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        endpoint,
        region: configService.get<string>('media.s3.region') ?? 'auto',
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
    }
  }

  assertConfigured(): void {
    if (!this.client || !this.bucket)
      throw new Error('S3-compatible media storage is not configured');
  }

  async authorizeUpload(request: StorageUploadRequest): Promise<StorageUploadAuthorization> {
    this.assertConfigured();
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1_000);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: request.storageKey,
      ContentType: request.contentType,
    });
    const url = await getSignedUrl(this.client as S3Client, command, {
      expiresIn: request.expiresInSeconds,
      signableHeaders: new Set(['content-type']),
    });
    return {
      method: 'PUT',
      url,
      headers: { 'content-type': request.contentType },
      expiresAt,
    };
  }

  async inspectObject(storageKey: string): Promise<StoredObjectMetadata | null> {
    this.assertConfigured();
    try {
      const object = await (this.client as S3Client).send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      const byteSize = object.ContentLength;
      if (
        !object.ContentType ||
        typeof byteSize !== 'number' ||
        !Number.isInteger(byteSize) ||
        byteSize < 0
      ) {
        return null;
      }
      return { contentType: object.ContentType, byteSize };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async createReadUrl(storageKey: string, expiresInSeconds: number): Promise<StorageReadUrl> {
    this.assertConfigured();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000);
    const url = await getSignedUrl(
      this.client as S3Client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresAt };
  }
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } | null;
  return candidate?.name === 'NotFound' || candidate?.$metadata?.httpStatusCode === 404;
}
