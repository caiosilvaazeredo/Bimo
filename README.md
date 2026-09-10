# Bimo

Camada de integração entre Google Classroom e Microsoft Teams for Education. Ver `bimorequisitos_1.md` (requisitos) e `docs/PLANO_IMPLEMENTACAO.md` (plano de implementação).

## Estrutura do monorepo

- `apps/api` — backend NestJS (motor de sincronização, integrações, API do painel/portal)
- `apps/web` — frontend Next.js (painel do professor, portal do aluno)

## Desenvolvimento

```bash
npm install

# API (copie apps/api/.env.example para apps/api/.env e preencha)
npm run dev:api

# Web
npm run dev:web
```

## Scripts do workspace raiz

- `npm run build` — build de api e web
- `npm run lint` — lint de api e web
- `npm test` — testes da api
