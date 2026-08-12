"""Helpers to inspect semantic score distributions on a golden set.

Run after embeddings exist for eval documents::

    cd backend
    uv run python -m tests.eval.score_histogram --help

Does not set a default ``semantic_min_score``; operators choose a threshold
from the printed histogram for their embedding model.
"""

from __future__ import annotations

import argparse
from collections import Counter


def bucket_scores(scores: list[float], *, width: float = 0.05) -> list[tuple[str, int]]:
    """Return histogram buckets for cosine similarity scores."""
    counts: Counter[str] = Counter()
    for score in scores:
        # Clamp display range to [-0.05, 1.05] for embedding cosine sims.
        clamped = max(-0.05, min(1.05, score))
        start = width * int(clamped / width)
        if clamped < 0 and start == 0 and clamped != 0:
            start = -width
        label = f"{start:.2f}..{start + width:.2f}"
        counts[label] += 1
    return sorted(counts.items(), key=lambda item: item[0])


def recommend_floor_stub(scores: list[float]) -> float | None:
    """Placeholder — do not auto-enable a floor without human review."""
    del scores
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--scores",
        nargs="*",
        type=float,
        default=[],
        help="Optional sample scores to histogram (offline / CI smoke).",
    )
    args = parser.parse_args()
    scores = args.scores or [0.12, 0.18, 0.41, 0.55, 0.62, 0.71]
    print("score_histogram:")
    for label, count in bucket_scores(scores):
        print(f"  {label}: {count}")
    print(f"recommended_floor: {recommend_floor_stub(scores)}")


if __name__ == "__main__":
    main()
