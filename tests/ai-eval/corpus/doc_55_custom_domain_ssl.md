# Custom Help Center Domains and SSL

Enterprise organizations can host their public help center under their own brand domain.

## Setup Instructions

1. In your DNS provider (Cloudflare, Route53, GoDaddy), create a CNAME record:
   - Host: `help.yourcompany.com`
   - Value: `custom.supportpilot.io`
2. In SupportPilot Admin Console, enter `help.yourcompany.com` under **Settings > Help Center > Custom Domain**.
3. SupportPilot automatically provisions and renews a free Let's Encrypt SSL/TLS certificate via HTTP-01 challenge verification within 15 minutes.
