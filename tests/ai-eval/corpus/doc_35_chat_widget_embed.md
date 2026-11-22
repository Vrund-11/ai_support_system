# Embeddable Chat Widget and Shadow DOM

The SupportPilot live chat widget embeds on any web application with minimal performance overhead.

## Embed Script

Add the following asynchronous script tag before the closing `</body>` tag:

```html
<script
  src="https://static.supportpilot.io/widget/v1/widget.js"
  data-tenant-id="YOUR_TENANT_ID"
  async
></script>
```

## Shadow DOM Isolation

The widget encapsulates all UI components within a closed Shadow Root (`attachShadow({ mode: 'closed' })`). This guarantees that your host website's CSS stylesheets and CSS resets cannot alter widget styling, and widget styles cannot leak into the parent page.
