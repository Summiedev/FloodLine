import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    if (!passwordHash) {
      // Preserve a password-hash-sized delay for unknown identities without
      // persisting or exposing anything derived from the supplied password.
      await this.hash(password);
      return false;
    }

    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
