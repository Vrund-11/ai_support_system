# Stripe Payment Processing and Vaulting

SupportPilot integrates with Stripe to provide secure, PCI-DSS compliant credit card processing.

## Payment Flow

- Card details are entered via Stripe Elements directly into Stripe's tokenization vault. SupportPilot servers never touch raw credit card numbers or CVV codes.
- Supports Visa, Mastercard, American Express, and Discover.
- In 3D Secure regions (such as the EU under PSD2 Strong Customer Authentication), users are redirected to complete bank two-factor challenges.
- In the event of a card expiration or payment failure, Smart Retries run up to four times over a 14-day grace period before subscription pause.
