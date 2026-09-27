import { Injectable } from '@nestjs/common';
import { CommunityImpactRepository } from './community-impact.repository';

@Injectable()
export class CommunityImpactService {
  constructor(private readonly repository: CommunityImpactRepository) {}

  getForUser(userId: string) {
    return this.repository.getForUser(userId);
  }
}
