// Webhook Lambda handler stub — signed webhook delivery
// Implemented in Sprint 3 (S3-T12)
export const handler = async (_event: unknown) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'webhook-lambda stub' }) };
};
