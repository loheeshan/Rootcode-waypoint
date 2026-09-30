# TeamName_SolutionName — Waypoint Delivery Operations MVP

> Rootcode Tech-Triathlon 2026 Hackathon repository.

## Final stack

| Area | Technology |
|---|---|
| Dispatcher | Next.js + React + TypeScript |
| Store Manager | Next.js + React + TypeScript |
| Driver | React Native + Expo + TypeScript |
| Loader | React Native + Expo + TypeScript |
| Backend | FastAPI + Python |
| Database | PostgreSQL |
| Planning | OR-Tools |
| Mobile offline DB | Expo SQLite |
| Mobile secure storage | Expo SecureStore |
| Network state | NetInfo |
| POD storage for MVP | PostgreSQL BYTEA |
| CI | GitHub Actions |
| Containers | Docker Compose |

## Team

### Web
- Abish
- Adrian

### Mobile frontend
- Sivananthi
- Vashika
- Lisha

### Backend
- Loheeshan
- Krish
- Lisha

## Branch model

```text
main
└── dev
    ├── chore/*
    ├── feature/*
    ├── fix/*
    ├── docs/*
    ├── test/*
    └── refactor/*
```

Nobody develops directly on `main` or `dev`.

## Start order

```text
Repository foundation
→ Design tokens
→ Web reusable components
→ Mobile reusable components
→ API contracts
→ Database foundation
→ Authentication
→ Role features
→ Integration
→ Feature freeze
→ Release
```

## Main repository layout

```text
TeamName_SolutionName/
├── README.md
├── CONTRIBUTING.md
├── AGENTS.md
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── web/
│   ├── driver-mobile/
│   ├── loader-mobile/
│   └── api/
├── packages/
│   ├── design-tokens/
│   ├── web-ui/
│   ├── mobile-ui/
│   ├── api-contracts/
│   └── shared-types/
├── data/seed/
├── scripts/
├── docs/
└── .github/
```

## Important docs

- `docs/architecture/SYSTEM-ARCHITECTURE.md`
- `docs/architecture/DATA-MODEL.md`
- `docs/architecture/API-CONTRACTS.md`
- `docs/process/GIT-FLOW.md`
- `docs/process/BRANCH-OWNERSHIP.md`
- `docs/process/COMMIT-PLAN.md`
- `docs/process/REUSABLE-COMPONENT-MAP.md`
- `docs/process/JUDGE-WALKTHROUGH.md`
- `docs/process/DEADLINE-PLAN.md`
- `docs/ai/AI-DISCLOSURE.md`
