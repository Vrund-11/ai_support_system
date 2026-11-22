# AI Confidence Scoring and Draft Generation

SupportPilot assesses retrieval quality before presenting automated draft responses to agents.

## Confidence Calculation

- Calculated based on top chunk similarity scores and token coverage across retrieved context chunks.
- **Threshold = 0.55**: If confidence is $\ge 0.55$, the AI generates a suggested draft response with cited document IDs and sections.
- If confidence falls below 0.55, the draft is marked with a low-confidence warning and recommended for manual agent composition.
