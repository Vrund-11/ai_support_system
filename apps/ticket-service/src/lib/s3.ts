import { S3Client } from '@aws-sdk/client-s3';

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const endpoint = process.env['S3_ENDPOINT'];
  const region = process.env['S3_REGION'] ?? process.env['AWS_REGION'] ?? 'ap-south-1';
  const forcePathStyle =
    process.env['S3_FORCE_PATH_STYLE'] === 'true' ||
    process.env['S3_FORCE_PATH_STYLE'] === '1' ||
    Boolean(endpoint);

  s3ClientInstance = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test',
    },
  });

  return s3ClientInstance;
}

export function getS3BucketName(): string {
  return process.env['S3_BUCKET'] ?? 'supportpilot-files';
}

/** Override S3Client instance for tests */
export function setS3Client(client: S3Client | null): void {
  s3ClientInstance = client;
}
