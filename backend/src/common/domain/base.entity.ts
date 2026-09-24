import { randomUUID } from 'node:crypto';

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseEntity implements Timestamped {
  readonly id: string;
  readonly createdAt: Date;
  updatedAt: Date;

  protected constructor(id = randomUUID(), createdAt = new Date(), updatedAt = createdAt) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export function newUuid(): string {
  return randomUUID();
}
