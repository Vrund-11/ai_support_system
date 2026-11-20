"""Training, comparison, and evaluation pipeline for SupportPilot Classifier (AI-4).

Trains models on data/tickets_dataset.jsonl:
- Evaluates:
  1. Baseline: TF-IDF + LogisticRegression
  2. Tuned: Sublinear TF-IDF (1-2 grams) + LogisticRegression (balanced weights)
  3. Complement: TF-IDF + ComplementNB / SGDClassifier
- Computes: Accuracy, Macro-F1, Per-class Precision/Recall, and Confusion Matrix.
- Writes comparison report to reports/classifier.md.
- Exports best model pipeline with joblib to apps/ai-service/models/classifier-v1.0.0.joblib.
"""

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline

from src.classifier.model import SupportPilotTicketModel


def load_dataset(data_path: Path) -> list[dict]:
    data = []
    with data_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data


def format_confusion_matrix(cm: np.ndarray, labels: list[str]) -> str:
    """Formats confusion matrix into clean markdown table."""
    header = "| Actual \\ Predicted | " + " | ".join(labels) + " |"
    divider = "| --- | " + " | ".join(["---"] * len(labels)) + " |"
    rows = []
    for i, actual in enumerate(labels):
        cells = " | ".join(str(cm[i, j]) for j in range(len(labels)))
        row_str = f"| **{actual}** | {cells} |"
        rows.append(row_str)
    return "\n".join([header, divider, *rows])


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_DATA_PATH = REPO_ROOT / "data" / "tickets_dataset.jsonl"
DEFAULT_MODEL_PATH = REPO_ROOT / "apps" / "ai-service" / "models" / "classifier-v1.0.0.joblib"
DEFAULT_REPORT_PATH = REPO_ROOT / "reports" / "classifier.md"


def train_and_evaluate(
    data_path: Path = DEFAULT_DATA_PATH,
    output_model_path: Path = DEFAULT_MODEL_PATH,
    report_path: Path = DEFAULT_REPORT_PATH,
) -> dict[str, Any]:
    dataset = load_dataset(data_path)
    texts = [f"{d['subject']} {d.get('description', '')}".strip() for d in dataset]
    categories = [d["category"] for d in dataset]
    priorities = [d["priority"] for d in dataset]

    # Combined target for stratified splitting
    combined_labels = [f"{c}_{p}" for c, p in zip(categories, priorities, strict=False)]

    # 70% Train, 15% Val, 15% Test
    idx = list(range(len(texts)))
    train_idx, temp_idx = train_test_split(
        idx,
        test_size=0.30,
        random_state=42,
        stratify=combined_labels,
    )

    temp_combined = [combined_labels[i] for i in temp_idx]
    _val_idx, test_idx = train_test_split(
        temp_idx,
        test_size=0.50,
        random_state=42,
        stratify=temp_combined,
    )

    train_x = [texts[i] for i in train_idx]
    test_x = [texts[i] for i in test_idx]

    y_cat_train = [categories[i] for i in train_idx]
    y_cat_test = [categories[i] for i in test_idx]

    y_prio_train = [priorities[i] for i in train_idx]
    y_prio_test = [priorities[i] for i in test_idx]

    models_config = {
        "Baseline (TF-IDF + LogReg)": {
            "prio": Pipeline(
                [
                    ("tfidf", TfidfVectorizer(ngram_range=(1, 1), max_features=3000)),
                    ("clf", LogisticRegression(max_iter=1000, random_state=42)),
                ]
            ),
            "cat": Pipeline(
                [
                    ("tfidf", TfidfVectorizer(ngram_range=(1, 1), max_features=3000)),
                    ("clf", LogisticRegression(max_iter=1000, random_state=42)),
                ]
            ),
        },
        "Tuned (Sublinear TF-IDF 1-2g + Balanced LogReg)": {
            "prio": Pipeline(
                [
                    (
                        "tfidf",
                        TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, max_features=5000),
                    ),
                    (
                        "clf",
                        LogisticRegression(
                            C=1.5, class_weight="balanced", max_iter=1000, random_state=42
                        ),
                    ),
                ]
            ),
            "cat": Pipeline(
                [
                    (
                        "tfidf",
                        TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, max_features=5000),
                    ),
                    (
                        "clf",
                        LogisticRegression(
                            C=1.5, class_weight="balanced", max_iter=1000, random_state=42
                        ),
                    ),
                ]
            ),
        },
        "Alternative (TF-IDF + ComplementNB / SGD)": {
            "prio": Pipeline(
                [
                    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
                    ("clf", SGDClassifier(loss="log_loss", penalty="l2", random_state=42)),
                ]
            ),
            "cat": Pipeline(
                [
                    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
                    ("clf", ComplementNB()),
                ]
            ),
        },
    }

    results: dict[str, dict[str, Any]] = {}

    for name, pipes in models_config.items():
        # Train Priority
        pipes["prio"].fit(train_x, y_prio_train)
        prio_pred = pipes["prio"].predict(test_x)
        prio_acc = accuracy_score(y_prio_test, prio_pred)
        prio_f1 = f1_score(y_prio_test, prio_pred, average="macro")

        # Train Category
        pipes["cat"].fit(train_x, y_cat_train)
        cat_pred = pipes["cat"].predict(test_x)
        cat_acc = accuracy_score(y_cat_test, cat_pred)
        cat_f1 = f1_score(y_cat_test, cat_pred, average="macro")

        results[name] = {
            "prio_acc": prio_acc,
            "prio_f1": prio_f1,
            "cat_acc": cat_acc,
            "cat_f1": cat_f1,
            "overall_macro_f1": (prio_f1 + cat_f1) / 2.0,
            "prio_pred": prio_pred,
            "cat_pred": cat_pred,
        }

    # Best model selection based on overall_macro_f1
    best_name = max(results.keys(), key=lambda k: results[k]["overall_macro_f1"])
    best_prio_pipe = models_config[best_name]["prio"]
    best_cat_pipe = models_config[best_name]["cat"]

    # Export Model Artifact
    output_model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "version": "1.0.0",
        "name": best_name,
        "sample_count": len(dataset),
        "train_samples": len(train_x),
        "test_samples": len(test_x),
        "prio_accuracy": results[best_name]["prio_acc"],
        "prio_macro_f1": results[best_name]["prio_f1"],
        "cat_accuracy": results[best_name]["cat_acc"],
        "cat_macro_f1": results[best_name]["cat_f1"],
    }
    artifact = SupportPilotTicketModel(best_prio_pipe, best_cat_pipe, metadata)
    joblib.dump(artifact, output_model_path)

    # Detailed metrics for best model
    prio_labels = ["LOW", "MEDIUM", "HIGH", "URGENT"]
    prio_cm = confusion_matrix(y_prio_test, results[best_name]["prio_pred"], labels=prio_labels)
    prio_rep = classification_report(
        y_prio_test, results[best_name]["prio_pred"], labels=prio_labels
    )

    cat_labels = sorted(list(set(categories)))
    cat_cm = confusion_matrix(y_cat_test, results[best_name]["cat_pred"], labels=cat_labels)
    cat_rep = classification_report(y_cat_test, results[best_name]["cat_pred"], labels=cat_labels)

    # Generate Markdown Report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_content = (
        "# SupportPilot Ticket Classifier Evaluation Report (AI-4)\n\n"
        "Generated from `data/tickets_dataset.jsonl` (600 samples, 70/15/15 stratified split, "
        "random_state=42).\n\n"
        "## Model Comparison\n\n"
        "| Model Architecture | Priority Accuracy | Priority Macro-F1 | "
        "Category Accuracy | Category Macro-F1 | Overall Macro-F1 |\n"
        "| --- | --- | --- | --- | --- | --- |\n"
    )
    for m_name, res in results.items():
        is_best = " **(Selected)**" if m_name == best_name else ""
        report_content += (
            f"| {m_name}{is_best} | {res['prio_acc']:.2%} | {res['prio_f1']:.4f} | "
            f"{res['cat_acc']:.2%} | {res['cat_f1']:.4f} | **{res['overall_macro_f1']:.4f}** |\n"
        )

    report_content += f"""
## Selected Production Model: `{best_name}`
Artifact: `apps/ai-service/models/classifier-v1.0.0.joblib`

### Priority Classification Report
```
{prio_rep}
```

### Priority Confusion Matrix
{format_confusion_matrix(prio_cm, prio_labels)}

### Category Classification Report
```
{cat_rep}
```

### Category Confusion Matrix
{format_confusion_matrix(cat_cm, cat_labels)}
"""
    report_path.write_text(report_content, encoding="utf-8")
    print(f"Report written to {report_path}")
    print(f"Model exported to {output_model_path}")
    return metadata


if __name__ == "__main__":
    train_and_evaluate()
