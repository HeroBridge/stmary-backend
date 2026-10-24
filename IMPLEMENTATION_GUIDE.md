# Hero One Eleven Community OS — Implementation Guide

This is the working document for the team taking this codebase to the Apple App Store and Google Play. It covers what exists, the order of operations, store submission, and the privacy rules that are non-negotiable for this platform.

---

## 1. What's in this repository

```
community-platform/
├── src/                      Backend API (Node.js/Express, runs on ECS Fargate)
│   ├── db/                   Postgres + PostGIS schemas (3 phases) + migration runner
│   ├── middleware/auth.js    JWT auth + role guards
│   ├── routes/               auth, groups, feeds, resources, events, messages,
│   │                         codes (referral), profiles, governance (agents/consent)
│   └── services/             entitlements, journey (transcript), milestones, agents
├── mobile/                   React Native (Expo) app — the store deliverable
│   ├── App.js                Navigation: Login → Code Entry → Tabs
│   └── src/screens/          Feed (carousel), Resources (list+map), Events, Profile
├── infra/task-definition.json  ECS Fargate template
├── Dockerfile / docker-compose.yml
└── README.md
```

**The three layers:**
1. **Community layer** (users touch): entitlement-driven bespoke experience — referral codes, curated feed, GIS resources, events, messaging, profiles, badges, learning tracks.
2. **Agent layer** (staff/agents use): TILLY (person profiles), CORA (program patterns → change proposals), EDDI (evidence/velocity), RITA (operational tasks), MEERKAT (stakeholder report drafts). HERO is not a separate service — it *is* the journey transcript + record system.
3. **Governance layer** (keeps it safe): change proposals with mandatory admin approval, consent registry, data collection policies, guardian consent for minors.

**Structural guardrails already enforced in code:**
- Agents write only insights/tasks/drafts/proposals — never direct changes.
- The ONLY code path that changes the community framework is `POST /governance/proposals/:id/decide`, admin-only, whitelisted change types.
- `new_data_collection` proposals create a consent *ask*, never a data flow. Collection under a category only counts for users who opted in.
- TILLY/EDDI refuse to run on a user without active consent for the categories involved.
- MEERKAT reports are grounded in a stored `data_basis` and stay `draft` until human-approved. Aggregate-only language is required in its prompt.

---

## 2. Order of operations (realistic sequence)

**Stage A — Backend live (1–2 weeks of team time)**
1. Run locally: `cp .env.example .env && docker compose up --build`. Fix anything the first live run surfaces — this code has been syntax-checked but not executed against a database.
2. Provision AWS: RDS Postgres (enable PostGIS), ECR, ECS Fargate service behind an ALB (see README deploy steps), Secrets Manager for `DB_PASSWORD`/`JWT_SECRET`.
3. Point a domain (e.g. `api.herobridgela.org`) at the ALB with an ACM TLS certificate. **Both stores require HTTPS.**
4. Seed: create the org, admin user, initial groups/resources/tracks, data collection policies, and your first referral codes.

**Stage B — Mobile app to testable (2–4 weeks)**
1. `cd mobile && npx expo install` then `npx expo start` — test on your own phone with Expo Go immediately.
2. Set `API_BASE` in `mobile/src/api/client.js` to your deployed API.
3. Add app icon + splash to `mobile/assets/` (1024×1024 icon; use the robot or badge).
4. Build what's stubbed: messaging screen, in-app player for authenticated resources, push notifications (Expo Notifications), post composer.
5. Internal testing: `eas build` → TestFlight (iOS) and Play Internal Testing track (Android).

**Stage C — Store submission (1–2 weeks incl. review)**
See section 3.

**Stage D — Agent layer live (after launch is fine)**
1. Enable Bedrock model access in your AWS account (Anthropic Claude models); grant the ECS task role `bedrock:InvokeModel`.
2. Set `BEDROCK_MODEL_ID` env var. Without it the agents run in deterministic fallback mode — useful for testing the pipeline.
3. Schedule CORA/RITA/EDDI runs (EventBridge → API call or ECS scheduled task).
4. Build the admin dashboard for proposals/reports review (web; can be a simple internal tool first).

---

## 3. Store submission — the exact path

### Accounts (start these first; they take days)
- **Apple Developer Program**: $99/year. Enroll as an organization (requires a D-U-N-S number — free but can take 1–2 weeks). https://developer.apple.com/programs/
- **Google Play Console**: $25 one-time. https://play.google.com/console
- **Expo account** (free) + `npm install -g eas-cli` for builds.

### Build & submit with EAS (handles signing for you)
```bash
cd mobile
eas login
eas build:configure          # creates eas.json
eas build --platform ios     # EAS manages certificates/profiles
eas build --platform android # produces an .aab
eas submit --platform ios    # uploads to App Store Connect
eas submit --platform android
```

### Store listings you must prepare
- App name, subtitle, description (adapt the 60-second script copy)
- Screenshots: 6.7" and 5.5" iPhone sizes; Android phone + 7"/10" tablet
- Privacy policy URL (required by BOTH stores — host it on herobridgela.org)
- **Apple "App Privacy" nutrition labels**: declare collection of contact info, user content, identifiers, usage data, and location. Location must be declared because of the GIS map.
- **Google Play Data Safety form**: same declarations, plus data-sharing and deletion info.
- Content rating questionnaires.

### Review realities for THIS app
- **Account deletion**: Apple requires in-app account deletion for apps with account creation. Build this before submitting (backend: add a delete endpoint that removes/anonymizes the user; mobile: a button in Profile).
- **Demo account**: reviewers need working credentials. Create a reviewer account preloaded via a referral code so they see the real experience.
- **Kids/education positioning**: do NOT market the app as "for children" in store metadata unless you intend to enter Apple's Kids Category / Google's Families program, which trigger much stricter rules. Position it as a program-management tool used by organizations serving families.
- Expect 1–3 rounds of review feedback on the first submission. This is normal.

---

## 4. Privacy & compliance requirements (non-negotiable)

This platform serves mentorship programs that may include minors and stores behavioral/educational records. That triggers real legal obligations. **Have a lawyer review before launch** — this section is an engineering checklist, not legal advice.

- **COPPA (US, under-13 users)**: verifiable parental consent before collecting personal info from children. The `guardianships` + `consents` tables implement the mechanism; your intake flow must actually route through it.
- **FERPA (if working with schools)**: education records shared by a school carry restrictions; your data-sharing agreements with schools must specify what enters the platform.
- **State privacy laws (e.g. CCPA/CPRA in California)**: right to access, delete, and correct. The journey transcript makes access easy; build the delete/anonymize path.
- **Data minimization**: the `data_collection_policies` table is your inventory. If a category isn't listed with a purpose and retention period, the platform shouldn't collect it. Resist "collect it because the model might use it" — that's precisely what the `new_data_collection` approval gate exists to stop.
- **Retention**: set `retention_days` on every policy; add a scheduled job that purges expired transcript events.
- **Access limits**: transcripts/insights are admin+mentor only in code. Keep mentor access scoped to *their* mentees when you build the mentor dashboard (currently org-wide for mentors — tighten this before launch).
- **AI transparency**: tell users, in plain language, that program data is analyzed to improve mentorship, and that staff-facing summaries are AI-assisted. The consent screen in ProfileScreen is where this lives.

**About accuracy claims**: RAG grounding dramatically reduces fabrication but does not eliminate it — avoid marketing language like "it doesn't hallucinate." The safer, true claim: every report is grounded in the program's actual records, and a human reviews it before it's sent. The `data_basis` field exists so any narrative claim can be traced to real numbers.

---

## 4b. Community Experience feature audit (client's feature list)

| Feature | Status | Where |
|---|---|---|
| Member profiles | ✅ | Profile screen: bio, badges, goals, tracks, saved, Impact Transcript |
| Community feed | ✅ | Curated merged feed + group carousel |
| Posts | ✅ | Composer with group picker; attachments_json for deep links |
| Comments / replies | ✅ | Threaded: parent_comment_id, one level of nesting returned |
| Reactions | ✅ | like/love/celebrate/support/idea, one per user per post |
| Topic channels | ✅ | groups.kind='channel' — reuses all group/entitlement machinery |
| Groups / subcommunities | ✅ | Full model with roles |
| Member directory | ✅ | /community/directory: opt-in, search, no email/username exposure |
| Private / semi-private spaces | ✅ | public/private/secret visibility + entitlements |
| Notifications | ✅ | Push (Expo) + in-app notification center (mirrored) |
| Announcements | ✅ | Org-wide posts now restricted to admin/mentor |
| Admin-created content | ✅ | Resources, announcements, codes, tracks |
| Mobile-friendly | ✅ | Native Expo app |
| Web access | ⚠️ | Expo web target runs the same app in browser (`npx expo start --web`); maps need react-native-web-maps or a fallback list view. Budget a polish pass. |
| Native / PWA capability | ✅ | Native via EAS; PWA achievable from the Expo web build |
| Moderation tools | ✅ | Reports queue, post/comment removal (author/moderator/admin), member suspension (blocks all access) |
| Community guidelines | ✅ | Org-level markdown + per-user acceptance timestamp |
| Member onboarding flows | ✅ | Code preview → redeem → arrival package (mentor DM, goals, track kickoff); add guidelines-acceptance step to mobile onboarding (backend ready) |

## 4c. Resource & Content Library feature audit

| Feature | Status | Where |
|---|---|---|
| Resource pages | ✅ | body_md + thumbnail + GET /resources/:id returns full page w/ progress, feedback stats, sequence membership |
| Educational content | ✅ | resource_type: course, video, audio, document, form, page |
| Downloadable documents | ✅ | content_url + /open (logs view, starts progress); S3 presign hook noted for authenticated files |
| Video/audio/media embedding | ✅ backend | audio type + duration_minutes added; mobile in-app player still on gap list |
| Course-like learning sequences | ✅ | milestones.resource_id links tracks to resources; ordered by position |
| Tagged resource categories | ✅ | tags[] with GIN index + /resources/tags for filter chips (legacy category kept) |
| Featured resources | ✅ | is_featured + featured_rank; ?featured=true returns the curated shelf |
| Search | ✅ | Postgres full-text (title+description+body), entitlement-scoped, ?q= |
| Saved resources | ✅ | save/unsave + Profile display (pre-existing) |
| Resource completion tracking | ✅ | resource_progress (pct, monotonic); completion CASCADES into linked milestones -> auto-graduation grants + badges fire |
| Resource usefulness feedback | ✅ | useful + 1-5 rating + comment, one per user (updatable); aggregates on the resource page; feeds Impact Transcript + CORA |

**Design note:** search, tags, featured, and pages are all entitlement-scoped — a member cannot search or browse their way into content their code/milestones haven't granted. The library is curated per person by construction.

## 4d. Impact & Communications + Data & Analytics audit

### Impact & Communications
| Feature | Status | Where |
|---|---|---|
| Story collection | ✅ | stories: member/mentor submission, subject consent for external use, admin approval |
| Impact updates | ✅ | composeCommunication(comm_type='impact_update') — claims-first pipeline |
| Newsletters | ✅ | comm_type='newsletter', same verified pipeline |
| Donor-facing reporting | ✅ | comm_type='donor_report' + polled preferences (depth/topics/frequency) |
| Program updates | ✅ | comm_type='program_update' |
| Recognition posts | ✅ | story_kind='recognition' + comm_type='recognition' |
| Success stories | ✅ | story_kind='success', consent-gated for external citation |
| Stakeholder communications | ✅ | stakeholders + comm_preferences (polled), engagement tracking per send |
| Campaign-specific content | ✅ | campaigns table; communications carry campaign_id |

### The three structural mechanisms
1. **Claims Ledger** — every communication decomposes into claims; each claim carries recomputable evidence (metric/story/poll). The approval endpoint RE-VERIFIES live and refuses (HTTP 409) if any claim fails. Verification is the data model, not a checkbox.
2. **Gap Engine** — unverifiable evidence files a data_gap with a suggested collection action (small sample → widen/poll; unconsented story → consent request; stale preferences → re-poll; cold construct → pulse). `POST /impact/gaps/sweep` runs proactive staleness checks. The system's ignorance is a work queue.
3. **One polling engine, three jobs** — polls/questions/responses, questions tagged with ontology constructs, serves: communication-preference polling, readiness pulses (incl. AI adoption), and intervention outcome measurement.

### Data & Analytics
| Feature | Status | Where |
|---|---|---|
| Event-level logging | ✅ | journey_events (pre-existing spine) |
| Individual/relationship/group/community slicing | ✅ | /analytics/activity?scope=user|match|group|org |
| Ontology-based tagging | ✅ | ontology_terms (8 seeded constructs) + ontology_tags on any object; construct filter in slicing |
| Real-time field maps | ✅ | /analytics/field-map: geo pins weighted by engagement volume |
| Engagement trend analysis | ✅ | /analytics/trends: weekly actives with deltas |
| Mentorship effectiveness | ✅ | /analytics/mentorship-effectiveness — explicitly labeled correlational |
| Donor resonance tracking | ✅ | /analytics/resonance — transparent proxy score (open=1, engage=3, gave_after=6) |
| AI adoption readiness | ✅ | /analytics/readiness — construct pulse averages over time, low-sample flagged |
| Intervention outcome measurement | ✅ | /analytics/interventions — 14-day before/after deltas, confounds disclosed in output |
| Predictive model readiness | ✅ | /analytics/model-readiness — data-sufficiency audit (consent, labels, span, features) with explicit collection roadmap |

**Epistemic stance (deliberate):** analytics endpoints embed their own caveats in responses — correlational labels, sample floors (n<5 flagged), proxy-score formulas disclosed. MEERKAT can only cite what re-verifies. This is the defensible version of "data verified": the marketing can quote the product.

## 4e-i. Mentorship & Support + Community Management audit (ALL LIVE-VERIFIED)

Every item below passes in the live smoke suite (63 checks total), not just code review:

| Mentorship & Support | Proof (live check) |
|---|---|
| Mentor / mentee profiles | specialties/capacity/availability set; mentor directory shows load |
| Mentor matching | code-based pool match (arrival package) + admin propose |
| Support requests | file → route by audience → claim → resolve, push-notified |
| Peer-to-peer support | 'peer' audience visible to champions; messaging + directory |
| Group mentorship pods | kind='pod' rides all group/entitlement machinery |
| Mentor check-ins | session_type='check_in' with mood |
| Mentor session logging | private notes + mentee_visible_summary |
| Support history | requests + sessions + steps, permission-scoped |
| Recommended next steps | mentor suggests (resource-linked); blended w/ track + goals; member completes |
| Peer champion functionality | admin grant; champions see/claim peer queue |

| Community Management | Proof (live check) |
|---|---|
| Admin dashboard | /admin/dashboard aggregates (7 live counters) |
| Member management | search, role change, activity summary (last_active, events_30d) |
| Role-based permissions | member hitting admin route → 403 (negative test) |
| Group creation | groups + channels + pods, visibility levels |
| Content moderation | author/moderator/admin removal; suspension blocks ALL access (verified 403 → reinstate) |
| Flagged content review | report queue WITH content preview; resolve/dismiss |
| Broadcast messaging | org/group push + optional announcement post (email via SES when creds present) |
| Email/push notifications | push + in-app center (unread counts, mark-read verified) |
| Engagement reporting | /admin/reports/engagement + effectiveness (correlational-labeled) |
| Member activity summaries | per-member metrics + full admin transcript |

Key privacy behavior verified live: mentee session view NEVER includes the
mentor's private notes — only mentee_visible_summary and mood.

Bug caught this round: route whitelist coerced kind='pod' to 'group' (DB
allowed pods; route didn't). Session-merge audit also restored two lost
patches (moderation content preview, SES dependency).

## 4e. LIVE VERIFICATION — first full run (63 checks passing)

The platform has now been executed against a real PostgreSQL 16 + PostGIS
database. `npm run smoke` (scripts/seed-and-smoke.js) seeds a demo org and
walks the complete loop over HTTP:

referral code w/ arrival package → pseudonymous member redeems → mentor
auto-matched + welcome DM + starter goals + track kickoff → entitlement-scoped
library/search/featured → resource completion → milestone cascade → badge +
secret-group auto-graduation → construct-tagged pulse poll → story submission
→ consent enforcement (non-subject rejected 403) → stakeholder w/ polled
preferences → claims-first communication composition → **approval gate refuses
409 on unverified claims** → gap engine files small-sample collection tasks →
analytics slicing, field map, model-readiness (correctly reports "not ready"
with roadmap) → admin dashboard.

**Bugs the live run caught (all fixed):**
1. *Stale JWT after redemption* — redemption sets org/role in the DB but the
   caller's token predated it, silently emptying every entitlement-scoped
   query. Fix: /codes/redeem returns a refreshed token; mobile AuthContext
   adopts it.
2. *Async route errors crashed the process* — Express 4 doesn't catch async
   rejections; one SQL error killed the server. Fix: express-async-errors →
   central error handler. (Production-critical.)
3. *SQL parameter mismatch* in /analytics/field-map events query.
4. *Migration/route wiring drift* across sessions — migrate.js rewritten as an
   explicit ordered phase list; server.js mounts verified (14 routers).

Run it yourself: start Postgres+PostGIS, `npm run migrate`, `npm start`,
then `npm run smoke`. The script doubles as the funder demo narrative.

## 4f. Branding & Design Control Panel (live-verified, 68 checks total)

Branding is org-level DATA, not code. `organizations.branding` (JSONB, versioned)
holds: app_name, tagline, colors (primary/accent/light/surface/success), and
image slots (logo_url, login_background_url, mascot_url).

- **Fetch**: GET /community/branding (any member) — org values merged over defaults.
- **Edit**: PUT /admin/branding (admin only; hex + https validation; version bump).
- **Mobile**: ThemeContext fetches at login, caches offline; ALL seven screens +
  navigation refactored from hardcoded hex to theme tokens (zero brand hex
  literals remain in screens).
- **Design Studio** (admin-only tab): identity fields, logo preview, palette
  presets, per-color editors with swatches, live preview card, one-tap
  "Apply to whole community" → refresh() re-themes every screen instantly.

Live checks: member fetch, member-edit rejected 403, invalid hex rejected 400,
version bump, merged propagation.

Notes: images are https URLs (host on S3/your site; in-app upload is on the gap
list). Custom fonts need bundled font files via expo-font — slot not included
yet by design. Contrast is the admin's responsibility; the Studio preview shows
dark-on-light before saving.

## 4g. Official brand applied (live-verified)

Colors were sampled from the actual brand files (not guessed):
- **Primary** `#12123D` — badge navy (headers, nav, dark surfaces)
- **Accent** `#E43024` — badge center + one-pager band (the true brand red)
- **Light** `#F4F4F8` — badge field off-white (backgrounds)
- **Success** `#2FA84F` — accessible green (replaced the mascot's neon screen-green,
  which failed contrast as a UI color)

Applied to: backend DEFAULT_BRANDING, mobile DEFAULT_THEME, and the Design
Studio 'Hero Official' preset. Smoke assertions updated (68/68).

**Generated Expo store assets** (mobile/assets/, from the badge + mascot):
- icon.png 1024×1024 (badge on light field)
- adaptive-icon.png 1024×1024 (mascot foreground, Android safe zone)
- splash.png 1284×2778 (badge on navy)
- favicon.png 48×48, logo.png 512×512 (bundled login logo)
app.json wired: splash bg #12123D, adaptive bg #F4F4F8, primaryColor #E43024.
Login screen falls back to the bundled logo when no themed logo_url is set.

**Contrast (WCAG):** navy/light pairings are 16:1+ (excellent). White-on-red
buttons are 4.03:1 — passes AA for large/bold text (which buttons use); keep
button labels bold. Flagged so no small red-background body text is introduced.

Brand source files live in mobile/assets/brand/ for re-export.

## 5. Honest gaps to close before v1.0

**Completed since last revision:** account deletion (endpoint + Profile UI, Apple requirement met), messaging UI (conversation list + chat), push notifications (Expo, wired to REST and WebSocket message paths), text post composer with group picker, and the self-facing **Impact Transcript** view in Profile — users can now see their own record, making the not-surveillance claim concrete.

| Gap | Where | Priority |
|---|---|---|
| Image upload for posts (S3) | mobile + backend (text composer DONE) | High |
| Guidelines acceptance screen in mobile onboarding | mobile (backend ready) | High |
| Notification center screen + badge | mobile (backend ready) | Medium |
| Reaction picker UI (long-press) | mobile (backend ready) | Medium |
| Admin-assisted password reset (pseudonymous accounts) | backend + admin tool | Before launch |
| Web polish pass (Expo web, maps fallback) | mobile | Medium |
| In-app image upload for branding (S3 presign) | backend + Studio | Medium |
| Font slot via expo-font (bundled font files) | mobile | Low |
| Poll-answering UI in mobile (backend: /impact/polls/open) | mobile | High |
| Story submission + consent UI in mobile | mobile | High |
| Email open/click tracking to auto-feed communication_engagement (SES event destinations) | backend | Medium |
| Scheduled sweeps: gaps/sweep + RITA on EventBridge | infra | Medium |
| Library UI pass: search bar, tag chips, featured shelf, resource page screen w/ progress + feedback | mobile (backend ready) | High |
| In-app player for authenticated resources | mobile; backend `/open` returns the flag | Medium |
| Redis pub/sub for multi-task WebSockets | backend | Before scaling |
| Mentor access scoping to own mentees | governance routes | Before launch |
| Admin web dashboard (codes, proposals, reports) | new web app | Medium |
| Retention purge job | scheduled task | Before launch |
| Rate limiting + refresh tokens | backend | Before launch |
| Real predictive modeling (beyond EDDI heuristics) | data warehouse + ML pipeline | Post-launch |

The predictive layer deserves a note: EDDI currently uses transparent heuristics (activity trends, milestone velocity). Genuine outcome prediction needs months of real program data first — launch, accumulate transcripts, then model. That's the honest order; anyone who tells you otherwise is selling you a model trained on nothing.
