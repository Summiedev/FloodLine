import type { ContributorStatus } from '@prisma/client';

export const CONTRIBUTOR_TRUST_PROVIDER = Symbol('CONTRIBUTOR_TRUST_PROVIDER');

export interface ContributorTrustProvider {
  getIncidentTrustedContributorWeight(
    database: ContributorTrustDatabase,
    incidentId: string,
  ): Promise<number>;
}

export type ContributorTrustDatabase = {
  $queryRaw<T>(query: unknown): Promise<T>;
};

export interface ContributorStatusResponse {
  status: ContributorStatus;
}

export interface ContributorStatusAssignmentResponse extends ContributorStatusResponse {
  userId: string;
  assignedAt: Date;
  assignedBy: string;
  reason: string | null;
}
