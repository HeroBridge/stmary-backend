# The Formation Doctrine Layer

**Status: live-verified (34/34 in `npm run seed:tollelege`)**

A moral code for Hero, drawn from Catholic Social Doctrine, the *Confessions*, and
*City of God* — expressed as architecture rather than as quotations.

---

## The design decision that makes this safe

You said: *"I never want the technology to replace the human mentorship experience,
but Hero should be there to support it when it can."*

That sentence is itself a doctrine — it is **subsidiarity**, the CSD principle that a
matter belongs to the smallest competent authority closest to it, and that higher
structures *assist* without *absorbing*.

So subsidiarity is not merely one principle stored in the layer. **It is the layer's
architecture.** In this system, the most local competent authority over a person's
formation is the human mentor. Therefore the doctrine layer:

| It does | It never does |
|---|---|
| Constrains how agents *speak* | Speaks spiritual counsel to a member |
| *Briefs the mentor* with posture | Tells a mentor what to say |
| *Vetoes* automation of relationship | Substitutes itself for a guide |
| Learns which teaching serves when | Auto-applies what it learned |

The layer's highest function is to **protect the mentor's ground, not occupy it**.
Technology accompanies the accompaniers.

---

## Four mechanisms

### 1. Principles as data (`formation_principles`)
Sixteen seeded principles across three traditions. Each carries four fields, and the
four-field shape is the whole trick:

- `summary` — the principle in plain words
- `heuristic` — how it applies *behaviorally* in this community
- `mentor_cue` — a **posture** for the human guide (never a script)
- `agent_directive` — how it **constrains** agent language

**Catholic Social Doctrine:** human dignity, subsidiarity, solidarity, the common good,
preferential option for the poor, participation, accompaniment.
**Confessions:** the restless heart, take up and read, interiority, memory and the long
road, friendship as the road.
**City of God:** two cities, ordered love, peace as tranquillity of order, pilgrim
citizenship.

Because principles are *data*, an Order can revise its own moral scaffolding without a
code deploy — subsidiarity applied to the doctrine layer itself.

Sample of how a principle becomes behavior:

> **Interiority** (*Confessions*) — "The decisive movements happen inwardly, where no
> observer can see."
> → *heuristic:* never assume the visible record is the person.
> → *mentor cue:* "Ask what is happening inside, then be quiet long enough to hear it."
> → *agent directive:* **NEVER infer interior or emotional states from behavioral data.**

That last line is also, not coincidentally, the correct answer to the EU AI Act's
emotion-inference problem. The doctrine and the law agree.

> **Ordered love** (*City of God*) — "Disorder is loving a lesser good too much."
> → *agent directive:* **Never optimize for engagement as an end. Time-in-app is not a
> goal and must never be a target.**

A moral layer that forbids the growth-hacking of souls.

### 2. Moral context injected into every agent call
`moralContext(orgId)` loads all active `agent_directive`s and prepends them to **every
LLM system prompt** in the platform, followed by absolute prohibitions:

- No spiritual counsel, scripture interpretation, or pastoral advice to any member.
- No inference of interior, emotional, or spiritual states from behavior.
- No person described as a risk, a problem, or a failure.
- If a task would replace a human relationship rather than support it — refuse it.

### 3. Mentor briefing — the layer's primary output
`GET /mentorship/briefing/:menteeId` (mentor/admin only; **there is deliberately no
member-facing counterpart, and a member request returns 403 — verified**).

Returns:
- **stage** — inferred from formation data (arrival → early → middle → late → complete)
- **observed** — facts only: events, conversation partners, open requests, sessions
- **suggestions** — up to three principles, each with:
  - `because` — *the evidence that raised it*, so the mentor can reject the reasoning,
    not just the conclusion
  - `consider` — a **posture**, never a script
- **note** — stated every single time: *"These are postures to consider, not
  instructions. You know this person; the system does not. Ignore anything that does
  not fit."*

Signal weighting embodies the doctrine: isolation (solidarity) and unanswered requests
(preferential option for the poor) outrank everything. In the live run, Emma's briefing
surfaced *Preferential option for the poor* first — because she had an unanswered
support request. Attention flows to those with least of it.

### 4. The subsidiarity veto — a moral guard in code
Inside `POST /governance/proposals/:id/decide`, **before** any approval is recorded:

```
proposal → subsidiarityCheck() → refused (409) if it would automate relationship
```

Refused patterns include: automated replies/messages to members, replacing a mentor,
spiritual counsel by machine, re-engagement/nudge campaigns, emotion inference, and
ranking persons.

**This binds admins too.** In the live test, an admin attempted to approve *"automated
spiritual encouragement messages to quiet members"* and the system refused:

> *"Automating messages to members replaces the mentor's voice with the platform's."*

The proposal was recorded as rejected. Meanwhile a proposal that *supports* the mentor
("offer this reflection audio so the mentor can share it when it fits") passed and
applied. **The doctrine is not advice. It is a veto.**

---

## Learning when a teaching serves

The honest version of "know when a doctrine is most effective":

1. A mentor receives a briefing and **acts** — then records it
   (`POST /briefing/:menteeId/applied`, optionally with their own note).
2. Construct pulses (belonging, spiritual growth, discernment) are measured before and
   after via the existing polling engine.
3. `GET /principles/effectiveness` reports, per principle × stage: times applied and the
   average pulse delta in the 60 days after versus before.

And it says, in the payload itself:

> *"These are ASSOCIATIONS, not proof — mentors choose principles because of what they
> already perceive, so selection effects are large. Read as a conversation starter for
> formation directors, never as an instruction to the platform."*
>
> *"The system never auto-applies a principle based on this table. Any change to
> formation practice is a human decision."*

Over years this becomes real formation wisdom: *does accompaniment serve the middle of
the journey better than the arrival? Do returning Catholics need memory before they need
friendship?* But it becomes wisdom **for the formation director to weigh**, never a rule
the machine executes.

---

## What this deliberately does NOT do

- **No spiritual counsel to members.** No verse-of-the-day, no automated encouragement,
  no AI reflection on someone's prayer life. Not a missing feature — a refused one.
- **No scripts for mentors.** Posture only. A guide who is told what to say has been
  replaced by a teleprompter.
- **No interior inference.** The system will not guess at anyone's faith, doubt, or
  emotional state from click data. Ever.
- **No auto-application of learned patterns.** The effectiveness table informs humans;
  it never drives the platform.

---

## The mentor briefing screen (built)

`mobile/src/screens/MentorBriefingScreen.js` — the interface where the layer either
earns its keep or gets ignored. Four rules govern it, and each is a doctrine made visual:

1. **The posture is the largest text on the screen.** The metrics are small. The biggest
   thing a mentor reads is what a wise friend would say.
2. **The evidence sits beside the posture** ("She has an unanswered request"), so the
   mentor can reject the *reasoning*, not merely the conclusion. A suggestion that hides
   its basis is a command.
3. **"Doesn't fit her" is exactly as easy to tap as "I used this."** A suggestion you
   cannot decline is an instruction — and instructing a mentor is precisely what this
   layer refuses to do.
4. **No scripts, ever.** There is no "send this message" button and no drafted text. The
   guide speaks in their own voice or the tool has failed.

When every suggestion is dismissed, the screen does not argue or re-rank. It says:
*"Nothing to suggest. That is not a failure — it usually means she is well. Go and be
with her."*

Supporting: `MenteesScreen.js` lists the people a mentor walks with, **ordered by who
needs attention** — unanswered requests first, then isolation, then longest silence. The
sort order is the preferential option for the poor, expressed as SQL.

Endpoints: `GET /mentorship/mentees`, `GET /mentorship/briefing/:menteeId`,
`POST /mentorship/briefing/:menteeId/applied`. A member requesting any of them: **403**.

## Honest limits

1. **The veto is pattern-based.** `subsidiarityCheck()` uses regex over the proposal's
   rationale and spec. It catches the obvious and the careless; it will not catch a
   determined euphemism. It is a guardrail, not a conscience. The real safeguard remains
   the whitelist (agents can only propose from five change types) plus human review.
   *Recommendation:* have the Order review the refused-pattern list annually, and treat
   any attempt to route around it as a governance event worth discussing.
2. **Stage inference is crude.** It reads milestones, tenure, and activity — proxies for
   an interior reality the doctrine itself says is invisible. The briefing says so; the
   mentor should trust their own read over the label.
3. **Principle selection is heuristic, not learned.** Signals map to principles by rule.
   The effectiveness table may eventually inform better weightings — but a human should
   make that change deliberately, not a gradient.
4. **Spiritual direction is still not mentorship.** This layer does not solve the
   internal-forum problem flagged in `TOLLE_LEGE_CONFIG.md`. Certain conversations should
   be **structurally unloggable** — a configuration decision the Order must make, and one
   the doctrine layer supports rather than settles.

---

## Run it

```bash
npm run migrate && npm start
npm run seed:tollelege
```

Watch for the section titled *"The moral layer: doctrine as architecture"* — including
the live veto of an admin trying to automate spiritual encouragement.
