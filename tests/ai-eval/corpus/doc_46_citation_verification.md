# Groundedness Citation Verification

To eliminate hallucinations, every claim in an AI-generated draft must be grounded in verified context.

## Groundedness Metric

Groundedness measures the percentage of generated sentences directly supported by cited knowledge base chunks:
$$\text{Groundedness} = \frac{\text{Supported Sentences}}{\text{Total Generated Sentences}}$$
SupportPilot enforces a minimum 0.85 groundedness score in automated evaluation runs. Sentences without sufficient token overlap are flagged or omitted.
