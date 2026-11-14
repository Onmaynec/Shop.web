-- Maintenance, not automatically scheduled.
-- Run during quiet hours after checking retention requirements.
DELETE FROM "RateLimitBucket" WHERE "resetAt" < NOW() - INTERVAL '7 days';
DELETE FROM "Session"
WHERE "expiresAt" < NOW() - INTERVAL '30 days'
   OR "revokedAt" < NOW() - INTERVAL '30 days';
-- Deliberately DO NOT delete AuditLog or PaymentEvent automatically.
