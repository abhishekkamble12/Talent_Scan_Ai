"""
TalentScan AI: Feedback-Weighted Reranker (Smart Rerank)
========================================================
Learns recruiter preferences based on shortlist vs. reject decisions
within a job workspace. Trains a lightweight L2-regularized logistic
classifier over candidate feature vectors and blends probability with
the baseline fit_score to provide an adaptive ranking.
"""

import math
from typing import List, Dict, Any, Tuple


def _extract_features(cand: Dict[str, Any]) -> List[float]:
    """Extracts a normalized 5-dimensional feature vector for a candidate."""
    m_met = float(cand.get("must_haves_met") or 0)
    m_tot = float(cand.get("must_haves_total") or 1)
    must_ratio = min(max(m_met / max(m_tot, 1.0), 0.0), 1.0)

    n_met = float(cand.get("nice_to_haves_met") or 0)
    n_tot = float(cand.get("nice_to_haves_total") or 1)
    nice_ratio = min(max(n_met / max(n_tot, 1.0), 0.0), 1.0)

    years = float(cand.get("years_exp") or 0.0)
    years_norm = min(max(years / 10.0, 0.0), 1.0)

    risks = cand.get("risk_flags") or []
    risk_count = len(risks) if isinstance(risks, list) else 0
    risk_norm = min(max(risk_count / 5.0, 0.0), 1.0)

    score = float(cand.get("fit_score") or 0)
    score_norm = min(max(score / 100.0, 0.0), 1.0)

    return [must_ratio, nice_ratio, years_norm, risk_norm, score_norm]


def _sigmoid(z: float) -> float:
    z_clamped = max(-20.0, min(20.0, z))
    return 1.0 / (1.0 + math.exp(-z_clamped))


def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def train_reranker(training_examples: List[Tuple[List[float], float]]) -> Tuple[List[float], float, bool]:
    """
    Trains an L2-regularized logistic regression model.
    training_examples: list of (features_vector, label) where label is 1.0 (shortlisted) or 0.0 (rejected).
    Returns (weights, bias, trained_flag).
    """
    if len(training_examples) < 2:
        return [0.0] * 5, 0.0, False

    labels = [y for _, y in training_examples]
    has_pos = any(y > 0.5 for y in labels)
    has_neg = any(y < 0.5 for y in labels)
    if not (has_pos and has_neg):
        return [0.0] * 5, 0.0, False

    dim = len(training_examples[0][0])
    weights = [0.0] * dim
    bias = 0.0
    lr = 0.15
    reg = 0.05
    epochs = 120
    n = float(len(training_examples))

    for _ in range(epochs):
        dw = [0.0] * dim
        db = 0.0
        for x, y in training_examples:
            pred = _sigmoid(_dot(weights, x) + bias)
            err = pred - y
            for i in range(dim):
                dw[i] += err * x[i]
            db += err

        for i in range(dim):
            weights[i] -= lr * ((dw[i] / n) + (reg * weights[i]))
        bias -= lr * (db / n)

    return weights, bias, True


def apply_smart_rerank(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Applies feedback-weighted reranking to a list of candidates in a job.
    Uses 'shortlisted' as positive signal and 'rejected' as negative signal.
    """
    if not candidates:
        return {
            "candidates": [],
            "model_trained": False,
            "training_decisions_count": 0,
            "feedback_signal": "Need at least 1 shortlist and 1 rejection to train smart rerank."
        }

    # Collect training set
    training_data = []
    shortlisted_count = 0
    rejected_count = 0

    for c in candidates:
        st = c.get("status")
        feats = _extract_features(c)
        if st == "shortlisted":
            training_data.append((feats, 1.0))
            shortlisted_count += 1
        elif st == "rejected":
            training_data.append((feats, 0.0))
            rejected_count += 1

    weights, bias, is_trained = train_reranker(training_data)

    reranked = []
    for c in candidates:
        c_copy = dict(c)
        base_score = int(c.get("fit_score") or 0)
        if is_trained:
            feats = _extract_features(c)
            prob = _sigmoid(_dot(weights, feats) + bias)
            learned_score = int(round(prob * 100))
            # Blend 45% base fit_score + 55% learned preference
            smart_score = int(round(0.45 * base_score + 0.55 * learned_score))
            smart_score = max(0, min(100, smart_score))
            smart_boost = smart_score - base_score
        else:
            smart_score = base_score
            smart_boost = 0

        c_copy["smart_score"] = smart_score
        c_copy["smart_boost"] = smart_boost
        reranked.append(c_copy)

    # Sort primarily by smart_score DESC, then base fit_score DESC
    reranked.sort(key=lambda x: (x["smart_score"], x.get("fit_score", 0)), reverse=True)

    feedback_msg = (
        f"Smart model active! Trained on {shortlisted_count} shortlists and {rejected_count} rejections."
        if is_trained else
        f"Awaiting recruiter feedback ({shortlisted_count} shortlists, {rejected_count} rejections so far; needs at least 1 of each to activate adaptive weights)."
    )

    return {
        "candidates": reranked,
        "model_trained": is_trained,
        "training_decisions_count": len(training_data),
        "shortlisted_samples": shortlisted_count,
        "rejected_samples": rejected_count,
        "feedback_signal": feedback_msg
    }
