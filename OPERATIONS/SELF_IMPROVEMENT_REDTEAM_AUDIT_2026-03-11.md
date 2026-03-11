# Self-Improvement Red-Team Audit

Date: 2026-03-11 17:47:15 GMT

## Scope

This audit evaluates the current Mission Control learning/self-improvement loop as implemented in:

- `apps/mission-control/src/lib/learning.ts`
- `apps/mission-control/src/lib/memory/packet.ts`
- `apps/mission-control/src/lib/lead-orchestrator.ts`
- `apps/mission-control/scripts/self-improvement-redteam.ts`

The goal was to answer four questions:

1. What pipeline does the current self-improvement model follow?
2. Can the scorer be broken with adversarial answers?
3. Does failure actually change the system's future behavior?
4. What should be improved next?

## Current Learning Pipeline

The implemented pipeline is:

1. Lead writes operational decisions into `lead_decision_logs`.
2. The learning service reads the latest decision and generates one question using a small template set.
3. The question is stored in `learning_questions` with an expected-answer JSON spec:
   - `key_points`
   - `tradeoff`
   - `risk_if_changed`
   - `concept`
4. The operator submits an answer.
5. The scorer grades the answer heuristically using keyword overlap:
   - key-point keyword hits
   - tradeoff keyword hit
   - risk keyword hit
6. The result is stored in `learning_answers`.
7. `getLearningSignal()` aggregates recent answers and derives:
   - `avg_score`
   - good/partial/wrong rates
   - trend
   - `delegation_mode` = `conservative` / `balanced` / `exploratory`
8. Charlie consumes that signal through the memory packet and adjusts delegation weighting.

## Important Architectural Reality

This is not a full self-improvement loop yet.

What it does today:

- Improves Charlie's decision context if learning results are trustworthy.
- Changes delegation behavior based on answer-history aggregates.

What it does not do:

- Rewrite prompts or question strategy after failure.
- Build a better rubric from prior mistakes.
- Distinguish true understanding from keyword mimicry.
- Learn at the scoring layer itself.

So the current system is better described as:

`learning-informed delegation tuning`

not

`closed-loop self-improving reasoning`

## Red-Team Method

The audit used a deterministic harness:

- `apps/mission-control/scripts/self-improvement-redteam.ts`

It created temporary workspaces and ran adversarial cases against both delegation and approval questions.

Tested answer types:

- good reasoned answer
- shallow literal answer
- keyword soup
- reversed logic with matching keywords
- partial answer

## Measured Results

### Delegation Question

Question generated:

`Charlie delegated Task rt-delegation. Explain why delegation should use specialization + load + reliability (not random assignment), and what failure mode this avoids.`

Results:

| Case | Expected | Actual | Score | Outcome |
| --- | --- | --- | --- | --- |
| good_reasoned_answer | good | good | 100 | correct |
| literal_but_shallow | wrong | partial | 60 | false positive |
| keyword_soup | wrong | good | 100 | severe false positive |
| reversed_reasoning_with_keywords | wrong | partial | 60 | false positive |
| partial_answer | partial | partial | 60 | correct |

### Approval Question

Question generated:

`Why is approval mediation mandatory in Task rt-approval, and what risk appears if workers can bypass Lead approval?`

Results:

| Case | Expected | Actual | Score | Outcome |
| --- | --- | --- | --- | --- |
| good_approval_answer | good | good | 100 | correct |
| keyword_only_approval | wrong | good | 100 | severe false positive |

## Key Findings

### 1. The scorer is vulnerable to keyword stuffing

This is the biggest issue.

Answers that merely repeat rubric phrases without coherent reasoning can receive `good` with a score of `100`.

That means the current scorer measures:

`phrase overlap`

more than

`understanding of architectural tradeoff`

### 2. Contradictory reasoning is not reliably detected

An answer that says random assignment is better, while still mentioning some expected terms, was graded `partial` instead of `wrong`.

The scorer currently has no contradiction detection.

### 3. Shallow answers are over-scored

A literal restatement with low reasoning depth still reached `partial (60)`.

This means the current grade thresholds are too permissive for portfolio/interview-quality learning.

### 4. Failure does not reliably improve the system if scoring is wrong

This was the most important test.

The red-team harness intentionally submitted four bad answers in a row and then checked the derived learning signal.

Observed result after those failures:

- `avg_score: 100`
- `good_rate: 1`
- `delegation_mode: exploratory`

This is the opposite of the intended outcome.

Because the scorer mislabeled bad answers as good, the downstream "improvement" layer learned the wrong lesson and made Charlie more exploratory instead of more conservative.

### 5. Question generation does not adapt after failure

After failure, the next generated question remained template-equivalent.

Current question generation is driven by latest decision log, not by:

- previous incorrect concepts
- repeated misunderstanding patterns
- rubric weak spots

So the learning loop currently has:

- stateful scoring output
- no adaptive remediation strategy

## Verdict

The current self-improvement model is **not yet reliable enough to trust as a true improvement mechanism**.

It is useful as:

- a lightweight architecture quiz system
- a delegation tuning signal if manually supervised

It is not yet safe as:

- an autonomous measure of operator understanding
- a robust driver of Charlie behavior without guardrails

## Recommended Hardening Order

### Priority 1: Fix the scorer

Add checks for:

- contradiction / negation
- minimum causal structure (`because`, `so that`, `tradeoff`, `risk`, etc.)
- answer coherence instead of keyword-only matches
- penalty for keyword-dense but low-structure responses

### Priority 2: Separate lexical overlap from reasoning score

Use at least two subscores:

- coverage score
- reasoning quality score

Do not allow `good` unless both pass threshold.

### Priority 3: Add failure-aware remediation

After `wrong` or repeated `partial`:

- generate follow-up question on the exact missing concept
- keep concept state
- avoid counting repeated failed answers as evidence of understanding

### Priority 4: Guard the delegation mode signal

Do not let learning history alter Charlie behavior unless:

- sample count is sufficient
- wrong-rate is trustworthy
- scorer confidence is above threshold

### Priority 5: Add red-team regression tests to CI/verifier flow

The exact adversarial cases from this audit should become permanent regression gates.

## Suggested Next Task

Create `EXP-010i`:

`Harden learning scorer against keyword stuffing, contradiction, and shallow restatement before allowing learning-driven delegation tuning to influence Charlie aggressively.`

## Reproduction

Run:

```bash
npm run mc:self-improvement:redteam
```

This prints the adversarial audit results as JSON using a temporary SQLite database.
