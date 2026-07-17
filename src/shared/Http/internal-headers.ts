/**
 * Generates internal auth headers for inter-service traffic.
 * Uses service-specific secret if provided, otherwise falls back to INTERNAL_SECRET.
 */
export function getInternalHeaders(gatewayId: string): Record<string, string> {
  const envKey = `INTERNAL_SECRET_${gatewayId.toUpperCase()}`;
  const secret = process.env[envKey] ?? process.env.INTERNAL_SECRET;

  if (!secret) {
    throw new Error(
      `Missing internal secret: set ${envKey} or INTERNAL_SECRET`,
    );
  }

  return {
    'x-internal-secret': secret,
    'x-gateway-id': gatewayId,
  };
}
