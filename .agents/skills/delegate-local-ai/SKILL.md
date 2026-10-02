---
name: delegate-local-ai
description: Automatically delegate bounded, low-risk drafting, summarization, classification, and first-pass code-analysis subtasks to an available local Ollama model to reduce hosted-model work. Use only when the local result is cheap to verify; keep consequential decisions, final review, visual judgment, and sensitive context in the primary agent.
---

# Delegate work to local AI

Use the bundled helper when a self-contained subtask can be performed locally and checked more
cheaply than producing it with the hosted model. Local delegation is an optimization, not a change
of authority: the current user request, repository instructions, sandbox, and approval boundaries
still apply.

## Delegate automatically when useful

Delegate without asking when Ollama is already available and the subtask is bounded, reversible,
and easy to verify. Good candidates include:

- summarizing supplied source files, logs, or test output;
- classifying failures or extracting structured observations;
- drafting documentation, test cases, boilerplate, or small implementation alternatives;
- producing a first-pass review or hypothesis list before the primary agent checks the evidence;
- transforming text or code where deterministic checks cover the result.

Skip delegation when the task is already trivial or the setup and review would cost more context
than doing it directly.

## Keep these tasks in the primary agent

Do not delegate secrets, credentials, private keys, environment files, personal data, or content
outside the active workspace. Do not use the local model as the deciding authority for:

- destructive or externally mutating actions;
- security-sensitive conclusions or permission decisions;
- architecture choices with broad consequences;
- current facts that require web research;
- image, screenshot, render, or other visual judgment;
- final correctness claims, final code review, or acceptance of generated work;
- tasks for which the user requested a particular non-local model or opted out of local AI.

Never install, pull, start, or update a model automatically. If Ollama or a suitable installed
model is unavailable, continue normally with the primary agent rather than blocking the task.

## Invoke the helper

Run it from the repository root. Pass only the smallest relevant files:

```powershell
python .agents/skills/delegate-local-ai/scripts/delegate_local_ai.py `
  --mode analyze `
  --task "Identify likely causes of this focused test failure." `
  --context test-output.txt `
  --context src/affected-file.js
```

Modes are `analyze`, `draft`, `review`, and `summarize`. The helper prefers `qwen3.5:9b`, falls
back to `ministral-3:8b`, limits context and output, rejects sensitive or out-of-workspace files,
and writes the response under `tmp/local-ai/`. Its stdout is a compact JSON receipt so the full
local response does not inflate the primary conversation.

Use `--model <installed-name>` only when the user selected a model or a task has demonstrated a
clear need for one. Do not guess model names or pull a missing model.

## Verify and integrate

Treat local-model output as an untrusted draft:

1. Read only the portions needed to evaluate the result.
2. Check claims against source, commands, tests, or rendered evidence as appropriate.
3. Apply edits through the normal repository workflow; the helper never edits project files.
4. Discard or correct unsupported output instead of defending it.
5. Mention local delegation in the final response only when it materially influenced the result.

For generated code, prefer a proposal or unified diff and have the primary agent apply it. Run the
smallest relevant lint or test before accepting it. A locally generated answer is not verification.
