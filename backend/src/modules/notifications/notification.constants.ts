export const ALERT_EVALUATE_INCIDENT_JOB = 'alert-evaluation.incident';
export const ALERT_EVALUATE_OFFICIAL_WARNING_JOB = 'alert-evaluation.official-warning';
export const NOTIFICATION_DELIVERY_JOB = 'notification.delivery';

export const NOTIFICATION_RATE_LIMIT = {
  default: { limit: 30, ttl: 60_000 },
};

export const VERIFICATION_RATE_LIMIT = {
  default: { limit: 3, ttl: 60_000 },
};
