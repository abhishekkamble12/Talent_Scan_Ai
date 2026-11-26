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
- hallucination_risk: 5 = zero hallucination / strictly grounded, 1 = fabricated resume facts not in context.

JSON structure:
{{"answer_relevance": 5, "groundedness": 5, "coherence": 5, "completeness": 5, "hallucination_risk": 5}}
"""


def evaluate_response(question: str, context: str, answer: str, api_key: str) -> dict:
    """
    Synchronously evaluates a RAG response using Gemini as judge.
    Returns dict with scores, or empty dict on failure.
    """
    if not api_key:
        return {}
    try:
        model = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_EVAL_MODEL", "gemini-2.5-flash"),
            google_api_key=api_key,
            max_output_tokens=256,
            max_retries=1,
            timeout=15,
        )
        prompt = EVAL_PROMPT.format(
            question=question[:500],
            context=context[:2500],
            answer=answer[:2500],
        )
        response = model.invoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        
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
        
        return valid
        
    except Exception as e:
        logging.warning(f"[AIOps] Auto-evaluation error: {e}")
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
