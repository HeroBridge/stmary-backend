# Tolle Lege / Restless Pilgrim
## An Augustinian formation community, built on Hero One Eleven

**Status: live-verified, 22/22 checks passing** (`node scripts/seed-tolle-lege.js`)

The central finding: this required **no new platform features**. Every element of the
Tolle Lege vision is an existing, tested primitive under a different name. What follows
is the mapping — and it's worth reading, because it's also the argument for why this
platform can serve a Catholic order and a foster-youth program from one codebase.

---

## The mapping

| Infographic concept | Platform primitive | Already tested? |
|---|---|---|
| "Groups by faith journey" (Seeker / New / Returning) | Referral code per journey → grant bundle | ✅ |
| "Private, moderated community" | Group visibility: public / private / secret | ✅ |
| "Guided by Augustinian brothers & sisters" | Mentor pool match (least-loaded) at redemption | ✅ |
| "Guided reading cohort" | Group `kind='pod'` | ✅ |
| "Tolle Lege Perspectives" (curated readings) | Learning track + resource-linked milestones | ✅ |
| "From reading to pilgrimage to vocation" | Milestone auto-graduation chain | ✅ |
| "Restless Pilgrim" retreats/pilgrimage | Secret group + resources, granted on reading completion | ✅ |
| "Vocational discernment" | Secret group, granted on pilgrimage completion | ✅ |
| Parishes, retreat centers, holy sites | PostGIS geolocated resources (`show_on_map`) | ✅ |
| "Measurable Outcomes" (spiritual growth, belonging…) | Ontology constructs + pulse polls | ✅ |
| "Human-centered learning & reporting" | Claims-verified stakeholder communications | ✅ |
| "Replicable worldwide" (parishes, schools, orders) | Multi-org: each community is its own org + branding | ✅ |

---

## The four doors (referral codes)

The heart of the design. **The code is the journey.** Four people download the same
app, enter different codes, and land in genuinely different worlds:

- **SEEKER** — "You do not need to have it figured out to belong here."
  → Seekers group, reading cohort, Confessions + the Rule, retreat house on the map.
- **NEWCATHOLIC** — "Welcome home. We will walk the first steps with you."
  → New Catholics group, reading cohort, same foundational library.
- **RETURNING** — "However long you have been away, there is a place set for you."
  → Returning Catholics group — and *never* sees the New Catholics space, or vice versa.
- **DISCERNING** — "A restless heart is not a problem to solve."
  → Starts already inside Restless Pilgrim; pilgrimage resources granted at entry.

Every code carries: cohort groups, the formation track, the reading library, an
**Augustinian guide matched from the friar/sister pool**, a welcome message written in
that journey's voice, and starter goals. All applied in one transaction on redemption.

**Pseudonymous entry is a pastoral feature here, not just a technical one.** A returning
Catholic who is not ready to give a parish their email can join with a username and a
code. The code carries the context; the person keeps their privacy until they choose
otherwise. (Verified live: Emma joins with no email.)

---

## The formation chain (auto-graduation)

```
Read "Tolle Lege" (Confessions VIII)
   → completing it grants:  Restless Pilgrim group
                            + pilgrimage course
                            + Chapel of the Restless Heart (map pin)
                            + badge: "Tolle Lege"

Complete the pilgrimage
   → grants:  Discernment: Augustinian Life (secret group)
              + "Discerning a Call" course
              + badge: "Restless Pilgrim"

Study the Rule
   → grants:  Lay Leaders in Formation
              + badge: "Of One Mind and Heart"
```

This is the infographic's "from click to calling" arc, implemented as data. Nobody
hand-promotes anyone. The moment Emma finishes the reading, the pilgrimage appears —
group, course, and a new pin on her map. **Verified live**, including the negative case:
a Seeker who hasn't read cannot see the chapel.

---

## The GIS layer, in a faith context

Three kinds of pin, three visibility levels:
- **St. Augustine Priory** (public) — any member sees it. Daily Mass, open to all.
- **Villanova Retreat House** (private) — granted by code. Augustinian-led silence.
- **Chapel of the Restless Heart** (secret) — appears only after the reading milestone.
  A pilgrimage terminus you reach by walking the journey, not by browsing.

The map is not a directory. It is a picture of where *this person* is welcome right now.

---

## Measuring formation honestly

The infographic promises outcomes: spiritual growth, belonging, participation, vocation
discernment. The platform measures these as **ontology constructs** with pulse polls —
not as attendance counts.

Seeded constructs: `spiritual_growth`, `belonging`, `participation`, `discernment`
(alongside the platform defaults: trust, clarity, capability, resilience, readiness, agency).

A pulse question — "I feel I belong in this community" — is tagged to `belonging`, so
belonging becomes a tracked series over time, sliceable by journey cohort. Leadership can
finally answer: *do returning Catholics report more belonging after the reading cohort
than before?*

And the **claims ledger applies unchanged**: a report to a benefactor or the Provincial
cannot be approved unless every claim re-verifies against live data. If only three people
answered the pulse, the system files a gap rather than letting the number be published.

---

## What still needs deciding (honest gaps)

1. **Minors and safeguarding.** Youth ministry means minors. The consent + guardianship
   architecture exists, but a diocese/order will have its own safeguarding policy
   (VIRTUS, background checks, two-adult rules for messaging). That policy must be
   encoded in mentor-match rules and messaging permissions before youth onboarding.
2. **Spiritual direction is not mentorship.** The session-logging model has private
   mentor notes. For anything approaching the internal forum, the correct answer is
   almost certainly **do not record it at all** — not "record it with permissions."
   That's a formation decision for the Order, and the platform should be configured to
   make certain conversations unloggable by design.
3. **Agent naming.** TILLY/CORA/EDDI/RITA/MEERKAT are HeroBridge-branded. A faith
   deployment likely wants different (or invisible) naming.
4. **Branding assets.** I seeded a navy/burgundy/parchment palette to match the
   infographics' Augustinian tone. Real logo, the flaming-heart mark, and typography
   drop into the Design Studio the same way Hero's did.

---

## Run it

```bash
npm run migrate && npm start
node scripts/seed-tolle-lege.js
```

Seeds the whole community and walks Emma's journey — arrival through discernment —
with pass/fail receipts. It doubles as the demo for a Provincial or a benefactor.
