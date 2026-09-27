export interface CommunityImpactResponse {
  /** Accepted or pending reports authored by the user; rejected reports are excluded. */
  reportsSubmitted: number;
  /** Unique valid incident confirmations recorded for the user. */
  confirmationsMade: number;
  /** Distinct recipients represented by generated in-app alerts from contributed incidents. */
  peopleHelped: number;
  /** Distinct incident/recipient attribution pairs, deduplicated for repeated alerts. */
  alertRecipientsFromContributedIncidents: number;
}
