"""
AIOps LLM Evaluator — Uses Gemini to score RAG outputs.
========================================================
Runs asynchronously after each query to rate answer quality
across 5 dimensions without blocking the user response.
"""

import os
import json
import logging
import threading
from langchain_google_genai import ChatGoogleGenerativeAI

EVAL_PROMPT = """You are an objective AI evaluator for a talent screening RAG system. 
Rate the following AI-generated answer on each criterion strictly from 1 (worst) to 5 (best).
Return ONLY valid JSON with no markdown wrapping or preamble.

## Question
{question}

## Retrieved Context (from resumes vector DB)
{context}

## AI-Generated Answer
{answer}

## Criteria:
- answer_relevance: Does the response directly address what was asked? (1-5)
- groundedness: Are the candidate details, skills, and qualifications factually supported by the context? (1-5)
- coherence: Is the output structured, clear, and easy for an HR recruiter to read? (1-5)
- completeness: Does it provide complete candidate coverage or note gaps objectively? (1-5)
- hallucination_risk: 5 = zero hallucination / strictly grounded in context, 1 = fabricated resume facts not in context. If candidate details exist in the context, hallucination_risk MUST be 5.
- eval_reasoning: A concise 1-sentence explanation of the scores.

JSON structure:
{{"answer_relevance": 5, "groundedness": 5, "coherence": 5, "completeness": 5, "hallucination_risk": 5, "eval_reasoning": "Well-grounded analysis matching context."}}
"""


def evaluate_response(question: str, context: str, answer: str, api_key: str) -> dict:
    """
    Synchronously evaluates a RAG response using Gemini as judge.
    Returns dict with scores and eval_reasoning, or empty dict on failure.
    """
    if not api_key:
        return {}
    candidate_models = list(dict.fromkeys([
        os.getenv("GEMINI_EVAL_MODEL", "gemini-3.5-flash-lite"),
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
    ]))
    prompt = EVAL_PROMPT.format(
        question=question[:600],
        context=context[:12000],
        answer=answer[:4000],
    )

    last_err = None
    for m_name in candidate_models:
        try:
            model = ChatGoogleGenerativeAI(
                model=m_name,
                google_api_key=api_key,
                max_output_tokens=300,
                max_retries=1,
                timeout=15,
            )
            response = model.invoke(prompt)
            raw_content = response.content if hasattr(response, "content") else str(response)
            if isinstance(raw_content, list):
                parts = [
                    item["text"] if isinstance(item, dict) and "text" in item else getattr(item, "text", str(item))
                    for item in raw_content
                ]
                raw = "\n".join(parts)
            else:
                raw = str(raw_content)

            # Clean potential markdown block formatting
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
            raw = raw.strip()

            scores = json.loads(raw)

            valid = {}
            for key in ["answer_relevance", "groundedness", "coherence", "completeness", "hallucination_risk"]:
                val = scores.get(key, 0)
                try:
                    valid[key] = max(1, min(5, int(val))) if val else 0
                except (ValueError, TypeError):
                    valid[key] = 0

            valid["eval_reasoning"] = str(scores.get("eval_reasoning", "")).strip()[:200]
            return valid

        except Exception as e:
            last_err = e
            logging.warning(f"[AIOps] Eval model {m_name} failed: {e}")

    logging.warning(f"[AIOps] Auto-evaluation failed across all models: {last_err}")
    return {}


def evaluate_async(query_id: str, question: str, context: str, answer: str, api_key: str, callback=None):
    """
    Runs evaluation in a background thread so it doesn't block the user response.
    """
    def _run():
        scores = evaluate_response(question, context, answer, api_key)
        if callback and scores:
            try:
                callback(query_id, scores)
            except Exception as cb_err:
                logging.error(f"[AIOps] Callback error after evaluation: {cb_err}")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread
