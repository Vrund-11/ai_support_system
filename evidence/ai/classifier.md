# SupportPilot Ticket Classifier Evaluation Report (AI-4)

Generated from `data/tickets_dataset.jsonl` (600 samples, 70/15/15 stratified split, random_state=42).

## Model Comparison

| Model Architecture                              | Priority Accuracy | Priority Macro-F1 | Category Accuracy | Category Macro-F1 | Overall Macro-F1 |
| ----------------------------------------------- | ----------------- | ----------------- | ----------------- | ----------------- | ---------------- |
| Baseline (TF-IDF + LogReg) **(Selected)**       | 92.22%            | 0.9220            | 100.00%           | 1.0000            | **0.9610**       |
| Tuned (Sublinear TF-IDF 1-2g + Balanced LogReg) | 91.11%            | 0.9105            | 100.00%           | 1.0000            | **0.9553**       |
| Alternative (TF-IDF + ComplementNB / SGD)       | 91.11%            | 0.9105            | 100.00%           | 1.0000            | **0.9553**       |

## Selected Production Model: `Baseline (TF-IDF + LogReg)`

Artifact: `apps/ai-service/models/classifier-v1.0.0.joblib`

### Priority Classification Report

```
              precision    recall  f1-score   support

         LOW       0.87      0.91      0.89        22
      MEDIUM       0.92      1.00      0.96        22
        HIGH       0.91      0.91      0.91        22
      URGENT       1.00      0.88      0.93        24

    accuracy                           0.92        90
   macro avg       0.92      0.92      0.92        90
weighted avg       0.93      0.92      0.92        90
```

### Priority Confusion Matrix

| Actual \ Predicted | LOW | MEDIUM | HIGH | URGENT |
| ------------------ | --- | ------ | ---- | ------ |
| **LOW**            | 20  | 0      | 2    | 0      |
| **MEDIUM**         | 0   | 22     | 0    | 0      |
| **HIGH**           | 1   | 1      | 20   | 0      |
| **URGENT**         | 2   | 1      | 0    | 21     |

### Category Classification Report

```
                 precision    recall  f1-score   support

        account       1.00      1.00      1.00        14
        billing       1.00      1.00      1.00        16
            bug       1.00      1.00      1.00        15
feature request       1.00      1.00      1.00        15
         how-to       1.00      1.00      1.00        14
          other       1.00      1.00      1.00        16

       accuracy                           1.00        90
      macro avg       1.00      1.00      1.00        90
   weighted avg       1.00      1.00      1.00        90
```

### Category Confusion Matrix

| Actual \ Predicted  | account | billing | bug | feature request | how-to | other |
| ------------------- | ------- | ------- | --- | --------------- | ------ | ----- |
| **account**         | 14      | 0       | 0   | 0               | 0      | 0     |
| **billing**         | 0       | 16      | 0   | 0               | 0      | 0     |
| **bug**             | 0       | 0       | 15  | 0               | 0      | 0     |
| **feature request** | 0       | 0       | 0   | 15              | 0      | 0     |
| **how-to**          | 0       | 0       | 0   | 0               | 14     | 0     |
| **other**           | 0       | 0       | 0   | 0               | 0      | 16    |
