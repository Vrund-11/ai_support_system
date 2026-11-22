# Cryptographic Standards and Data Encryption

SupportPilot secures customer data at rest and in transit using industry-standard cryptography.

## In Transit

- All external and internal service-to-service communications mandate TLS 1.3 (with TLS 1.2 fallback).
- Insecure ciphers are disabled; Forward Secrecy (PFS) is enforced on all endpoints.

## At Rest

- Database volumes and object storage buckets are encrypted using AES-256 with AWS KMS or HashiCorp Vault managed keys.
- Encryption keys are automatically rotated every 365 days.
