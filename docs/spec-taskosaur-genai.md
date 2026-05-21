# Spec: mktask + GenAI Agent

> Update: workload analysis is now integrated directly into the NestJS backend. Running the
> separate FastAPI `ai-agent` service is no longer required for the AI project planner workflow.

## Objective
Build a self-hosted project and people management platform by extending mktask with a separate GenAI Agent service. The first deliverable is a working foundation that can run mktask plus an AI workload analysis API for Vietnamese project management workflows.

Success means the repository contains the mktask frontend/backend, an `ai-agent` FastAPI service, backend integration code that calls the agent, environment and Docker wiring, and tests for the new behavior.

## Tech Stack
- Frontend: Next.js, React, TypeScript.
- Backend: NestJS, Prisma, PostgreSQL, Redis.
- AI Layer: Python 3.10+, FastAPI, Pydantic, optional LLM provider keys.
- Dev runtime: Docker Compose or local Node/Python processes.

## Commands
- Install Node dependencies: `npm install`
- Install AI dependencies: `python -m pip install -r ai-agent/requirements.txt`
- Backend test: `npm run test:backend -- ai-agent.service.spec.ts --runInBand`
- AI Agent test: `python -m pytest ai-agent/tests`
- Build backend: `npm run build:backend`
- Dev app: `npm run dev`
- Dev AI Agent: `cd ai-agent && uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload`
- Docker dev: `docker compose -f docker-compose.dev.yml up`

## Project Structure
- `backend/`: NestJS API, Prisma schema, modules, integration client for the AI Agent.
- `frontend/`: Next.js UI from mktask.
- `ai-agent/`: FastAPI workload analysis service.
- `docs/`: project specs and implementation notes.
- `docker-compose*.yml`: local and production orchestration.

## Code Style
```ts
export class AiAgentService {
  async analyzeWorkload(input: AnalyzeWorkloadDto): Promise<AnalyzeWorkloadResponseDto> {
    const response = await fetch(`${this.agentUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    return response.json() as Promise<AnalyzeWorkloadResponseDto>;
  }
}
```

Use descriptive names, DTOs for API boundaries, small pure helper functions for scoring logic, and explicit error handling when crossing service boundaries.

## Testing Strategy
- Unit test the NestJS AI client with mocked `fetch`.
- Unit test Python workload scoring with deterministic inputs.
- Keep AI provider calls out of tests; tests must pass without real API keys.
- Run targeted tests before broader build commands.

## Boundaries
- Always: keep secrets in `.env`, validate API request shapes, make AI behavior deterministic when no LLM key exists.
- Ask first: database schema changes, adding large frontend screens, changing auth/RBAC rules, pushing to GitHub.
- Never: commit real API keys, remove existing mktask features, delete unrelated code, depend on an external LLM for local tests.

## Success Criteria
- `ai-agent/src/main.py` exposes `GET /health` and `POST /api/analyze`.
- Workload analysis returns `analysis`, `assignments`, and `warnings`.
- Backend exposes a NestJS client/controller for calling the AI Agent.
- `.env.example` documents `AI_AGENT_URL`, `AI_MODEL`, and provider keys.
- Docker dev compose includes the AI Agent service.
- New backend and AI Agent tests pass locally.

## Open Questions
- Which real LLM provider should be enabled first in production.
- Whether the admin workload page should be built as the next slice or integrated into an existing admin route.
