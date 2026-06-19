# SnookerLLMTests
Single shot testing of LLMs to create a snooker scoring webapp

## Introduction
A variety of LLM models were tested with a single prompt to establish a checkpoint of performance. Scoring is coarse grain (A-F).

## Terminology
Existing terminology for language model size is:
SLM  <= 10B, 10B < MLM <=100B, LLM > 100B.

Given that we have 1T and larger models, it might be useful to break LLMs further: XLLM <=1T, XXLLM <= 10T, etc.

## Results
See [docs/index.html](docs/index.html) for the full results table with scores, size classes, and notes.

The data is maintained in [docs/results.json](docs/results.json) as the single source of truth.

