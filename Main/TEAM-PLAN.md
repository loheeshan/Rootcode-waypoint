# TEAM-PLAN.md

# Ownership

## Web
Abish, Adrian

- Dispatcher
- Store Manager

## Mobile frontend
Sivananthi, Vashika, Lisha

- Driver
- Loader

## Backend
Loheeshan, Krish, Lisha

- FastAPI
- PostgreSQL
- planning
- sync
- integration

---

# Daily standups

09:00
- yesterday completed
- today's target
- blocker

14:00
- API contract check
- integration check

20:00
- merge completed branches to dev
- run full flow
- assign blockers

---

# API freeze

After **1 Oct evening**, do not casually rename endpoints or fields.

Any API change after freeze must:
1. notify web team;
2. notify mobile team;
3. update shared contract;
4. be merged with consumer fix.

---

# Integration owner

Loheeshan:
- final backend integration
- merge coordination
- release branch
- judge flow

Lisha:
- mobile/backend contract bridge

Abish/Adrian:
- web integration bridge

---

# Deadline rules

3 Oct:
- feature freeze

4 Oct:
- only critical fixes
- submission preparation
