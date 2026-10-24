# Community Platform

A native, self-hosted alternative to the Disciple Media community framework. Built as a containerized Node.js/Express API on Postgres + PostGIS, designed to run on AWS ECS Fargate with full ownership of your data and event stream.

Covers five feature areas:

- **Feeds** — org-wide and per-group posts with comments and cursor pagination
- **Groups** — public/private groups, membership, moderators
- **Resources** — geolocated resources with PostGIS radius search (find resources within N meters, sorted by distance)
- **Events** — scheduling with RSVPs and location
- **Messaging** — conversations with a REST fallback and a real-time WebSocket channel

## The entitlement model (Phase 2)

Everything bespoke flows from one idea: a row in `user_entitlements` says "this user may access this object" (a group, resource, track, or event). The referral code, the milestone engine, and manual admin/mentor grants are just three ways of writing those rows. Every surface — feed, library, map, calendar — filters by what the user is entitled to.

- **Visibility**: groups and resources are `public` (everyone in the org), `private` (entitled, but listable), or `secret` (invisible unless entitled).
- **Referral codes** (`/api/codes`): an admin builds a code with a bundle of grants (the dropdown). On `/redeem`, the whole bundle is applied to the new user and group memberships auto-created, so they land already curated.
- **Auto-graduation** (`/api/profiles/milestones/:id/complete`): completing a milestone grants its configured objects and awards a badge — no manual step.
- **Curated feed** (`/api/feeds`): merges org-wide announcements with posts from every entitled group; `/carousel` returns the user's group thumbnails for the top bar; `?group_id=` shows a single group. Posts carry `attachments_json` deep links, can be liked, and `/share` posts them into a DM while recording the source in `post_shares`.
- **Resources** (`/api/resources`): list is entitlement-filtered; `?on_map=true` powers the GIS layer; `/:id/open` verifies access, logs the view, and flags `open_in_app_player` for authenticated third-party links (wire to S3 presign / partner SSO in prod).
- **Profiles & transcript** (`/api/profiles`): `/me` returns bio, badges, goals, saved resources, posting history, and track progress. `/:userId/transcript` (admin/mentor) returns the full journey log plus rolled-up performance metrics — the resume/transcript export.
- **Journey transcript** (`journey_events`): every meaningful action (post, view, RSVP, message, share, badge, milestone, redeem) is logged through one service. This is the spine for both bespoke mentorship and KPI measurement.

Phase 2 schema lives in `src/db/schema_phase2.sql` and runs automatically after the base schema.

## Project layout

```
src/
  server.js            Express app + WebSocket server + health check
  db/
    pool.js            Postgres connection pool (RDS-ready, SSL aware)
    schema.sql         Full schema, PostGIS + pgcrypto
    migrate.js         Migration runner (npm run migrate)
  middleware/
    auth.js            JWT signing, auth guard, role guard
  routes/
    auth.js            register / login
    groups.js          CRUD + join/leave
    feeds.js           posts + comments
    resources.js       geolocated CRUD + radius search
    events.js          events + RSVP
    messages.js        conversations + messages
Dockerfile
docker-compose.yml     Local dev: API + PostGIS
infra/
  task-definition.json ECS Fargate task definition template
```

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

The compose file runs migrations on startup. API is at `http://localhost:8080`, health at `/health`.

Quick smoke test:

```bash
# Register
curl -s localhost:8080/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"password123","display_name":"Ada"}'

# Use the returned token
TOKEN=...
curl -s localhost:8080/api/feeds -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"body":"hello world"}'
```

## Deploy to AWS ECS Fargate

1. **Database** — provision an RDS Postgres instance and enable PostGIS:
   `CREATE EXTENSION postgis;` then run `src/db/schema.sql` against it.
2. **Build & push image** to ECR:
   ```bash
   aws ecr create-repository --repository-name community-platform
   docker build -t community-platform .
   docker tag community-platform:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/community-platform:latest
   aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
   docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/community-platform:latest
   ```
3. **Secrets** — store `DB_PASSWORD` and `JWT_SECRET` in Secrets Manager, `DB_HOST`/`DB_USER` in SSM Parameter Store.
4. **Task definition** — fill in the placeholders in `infra/task-definition.json` and register it.
5. **Service** — create an ECS service behind an Application Load Balancer. Point the target group health check at `/health`. The ALB must allow WebSocket upgrades (it does by default) for the `/ws` path.

## Scaling notes

- The WebSocket fan-out uses an in-memory socket map, which only works within a single task. To scale messaging across multiple Fargate tasks, replace it with **Redis pub/sub via ElastiCache**: each task subscribes to a channel and re-broadcasts to its own connected sockets.
- Put media uploads on **S3** rather than the database; store only the object key in `resources`/`posts`.
- For KPI measurement, have each route emit an event (post created, RSVP, message sent, resource viewed) to a stream — **Kinesis Firehose into S3 or directly into a warehouse** — so analytics never touch the production DB.

## Security checklist before production

- Rotate `JWT_SECRET`, never commit `.env`
- Run the container as non-root (already configured)
- Restrict the RDS security group to the ECS task security group only
- Add rate limiting (e.g. `express-rate-limit`) and request validation on every route
- Add refresh tokens / token revocation if sessions need to be invalidated
