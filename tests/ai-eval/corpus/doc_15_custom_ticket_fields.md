# Custom Field Definitions and Validation

Custom fields allow support teams to capture structured metadata specific to their product or industry.

## Supported Field Types

- Text: Single-line string for account IDs, error codes, or license numbers.
- Dropdown: Controlled single-select options (e.g. Operating System, Product Line).
- Checkbox: Boolean flags (e.g. Regression, Requires Developer Review).
- Date: Date picker for deadlines, contract renewals, or issue occurrence dates.
- Regex Validated: Text fields enforcing custom formats (e.g. Order ID matching `^ORD-[0-9]{8}$`).

Fields can be configured as **Required on Solve** to enforce data completeness before tickets can be closed.
