# Bimo - Plano de Implementação (v1 / MVP piloto)

Versão 1.0 | Baseado em `bimorequisitos_1.md`. Decisões de stack confirmadas com o responsável do produto em 2026-09-10.

## 1. Decisões de arquitetura confirmadas

| Área | Decisão | Racional / RNF relacionado |
|---|---|---|
| Backend | Node.js + TypeScript (NestJS) | RNF-ARCH-02/03, RNF-MAINT-01/02 — módulos isolados por provedor, DI facilita testes de contrato |
| Frontend | React + Next.js | RNF-PERF-01 (SSR ajuda p95 < 2s), RNF-UX-01/02, RNF-I18N-01 |
| Banco de dados | Oracle Autonomous Database (Free Tier, até 2x 20GB) | RNF-ARCH-04 |
| Multi-tenancy | Schema único, `tenant_id` em toda tabela + policy de isolamento obrigatória na camada de aplicação (e, quando possível, Row-Level Security do Oracle) | RNF-ARCH-01, RNF-SEC-03 |
| Fila de sincronização | Fila baseada em tabelas no próprio Oracle Database (padrão outbox/job table, sem broker externo) | RNF-ARCH-02, RNF-AVAIL-03, RNF-ARCH-04 (sem RAM extra para Redis/broker) |
| Armazenamento de arquivo temporário (contingência) | Oracle Object Storage (20GB Free Tier), com expiração automática após propagação | RF-STU-03, RNF-ARCH-04 |
| Verificação OAuth (Google verification/CASA, admin consent Entra ID) | Corre em paralelo ao desenvolvimento, usando contas de teste/sandbox; formalizada perto do fim do MVP | Seção 8 dos requisitos |
| Contract tests | Fixtures gravadas (respostas reais capturadas uma vez em sandbox) reproduzidas em CI, sem chamada real a cada build | RNF-MAINT-02 |

### Consequências de design a manter em mente

- **Fila em banco**: implementar como tabela `sync_job` com colunas de estado (`pending`, `processing`, `failed`, `done`), `attempt_count`, `next_attempt_at` (backoff exponencial), `locked_by`/`locked_at` (lock otimista via `SELECT ... FOR UPDATE SKIP LOCKED` ou equivalente Oracle) para permitir múltiplos workers sem duplicar processamento — atende RNF-AVAIL-03 (at-least-once) sem precisar de Redis/RabbitMQ.
- **Workers leves**: como não há broker dedicado, os workers de sincronização devem rodar como processos Node separados do processo web, mas ainda dentro do orçamento de RAM do Free Tier (RNF-ARCH-04) — evitar manter caches grandes em memória, processar em lotes pequenos.
- **RLS/tenant_id**: toda query gerada pelo ORM deve passar por um repositório/base class que injeta `tenant_id` automaticamente; nunca permitir query manual sem esse filtro (mitiga vazamento entre tenants).

## 2. Fases do projeto

### Fase 0 — Fundglobal (infra, autenticação de app, esqueleto)
Paralelamente: iniciar processo de registro de app no Google Cloud Console e Microsoft Entra ID (mesmo em modo de teste), já que isso desbloqueia todo o resto.

- Provisionamento Oracle Cloud Free Tier: VM(s) Ampere A1, Autonomous Database, Object Storage, rede/VCN
- Monorepo NestJS (API + workers) e Next.js (painel/portal), CI básico (lint, build, testes)
- Esqueleto de multi-tenancy: modelo `Tenant`, middleware de resolução de tenant, testes de isolamento
- Registro de app no Google Cloud Console (OAuth client, escopos Classroom) e no Microsoft Entra ID (app registration, escopos Graph) — modo de teste/sandbox
- Infra de observabilidade mínima (RNF-OBS-01/02): logs estruturados (JSON) + um dashboard leve (ex: Grafana+Prometheus em container leve, ou serviço gerenciado gratuito, a definir)

### Fase 1 — Identidade e autenticação (RF-AUTH)
- RF-AUTH-01/02: login OAuth Google e Microsoft, armazenamento de tokens criptografados via KMS (RNF-SEC-01)
- RF-AUTH-03: vínculo de 0-2 contas externas por perfil Professor
- RF-AUTH-04: renovação automática de tokens + notificação em falha de refresh
- RF-AUTH-05: SSO institucional (SAML/OIDC) — pode ficar para o fim da fase piloto se nenhum tenant piloto exigir de imediato (confirmar com negócio)
- RBAC básico (RNF-SEC-03): papéis Professor, Admin institucional, Admin de rede

### Fase 2 — Integração externa + motor de sincronização base (RF-INT, RF-SYNC essenciais)
- Módulos isolados `integrations/google` e `integrations/microsoft` (RNF-ARCH-03), cada um com client de API, mapeamento de erros e testes de contrato com fixtures gravadas (RNF-MAINT-02)
- Fila de jobs de sincronização (tabela `sync_job`), workers com backoff exponencial e respeito a rate limit (RF-INT-05)
- RF-INT-01/02: criação de turma espelhada (Course no Classroom + Team no Teams)
- RF-INT-03: importação e reconciliação de roster por e-mail institucional, com tela de revisão de divergências
- RF-INT-04: materiais por referência (link), nunca cópia física
- RF-SYNC-01/02/04: publicação e edição de tarefa, propagação de notas/status de entrega
- RF-SYNC-06: confirmação antes de propagar exclusão
- Log de auditoria de sincronização (RF-SYNC-05, RNF-OBS-01)

### Fase 3 — Painel do professor (RF-DASH)
- RF-DASH-01/02/03/04: criação de turma, status único, publicação de tarefa, lançamento de notas
- RF-DASH-05: links diretos para chat/canal nativo
- RF-DASH-06: resumo periódico (pode ser job assíncrono simples, e-mail)
- Acessibilidade WCAG 2.1 AA e responsividade 360px desde o primeiro componente (RNF-UX-01/02) — não deixar para o fim

### Fase 4 — Resolução de conflitos e notificações (RF-SYNC-03, RF-NOTIF)
- RF-SYNC-03: detecção de conflito, tela de comparação lado a lado, marcação "dessincronizada"
- RF-NOTIF-01/02/03: e-mail + painel para conflito e reautenticação; alerta institucional para falhas recorrentes

### Fase 5 — Portal do aluno / acesso de contingência (RF-STU)
- RF-STU-01/02: login direto do aluno, visualização read-only
- RF-STU-03: upload de entrega por contingência, com origem marcada, tentativa de propagação posterior, armazenamento temporário em Object Storage quando necessário
- RF-STU-04/05: detecção de sinais de problema de acesso, painel do professor mostrando alunos em contingência
- RF-STU-06: toggle institucional para habilitar/desabilitar contingência
- RNF-AVAIL-04: portal do aluno deve continuar no ar mesmo com painel do professor em manutenção → considerar deploy/processo separado ou ao menos rota independente que não dependa do mesmo processo web que o painel

### Fase 6 — Migração de turmas existentes (RF-MIG)
- RF-MIG-01: vínculo de turma já existente (um lado ou dois lados), confirmação manual quando existir dos dois lados
- RF-MIG-02/03/04: importação de histórico de tarefas/notas, roster, materiais por referência
- RF-MIG-05: idempotência/retomada de migração (chave de idempotência por recurso externo)
- RF-MIG-07: turma migrada passa a seguir o motor de sincronização contínua (reusa Fase 2)
- RF-MIG-06 (Could): migração em lote — só se sobrar tempo no MVP

### Fase 7 — Administração institucional (RF-ADMIN)
- RF-ADMIN-01/02/03: cadastro de tenant, credenciais de app em nível de domínio, visão de turmas/status, isolamento multi-tenant validado com testes
- RF-ADMIN-05: revogação de acesso de professor
- RF-ADMIN-04/06 (Should/Could): métricas entre unidades, API aberta — avaliar conforme tempo

### Fase 8 — Billing (esqueleto, sem cobrança) e relatórios
- RF-BILL-01: cálculo de aluno ativo por tenant/período (job periódico), sem cobrar
- RF-BILL-02/03 (Could): modelo de planos e visualização de consumo — se sobrar tempo
- RF-REPORT-01/02: relatórios de entrega e adoção

### Fase 9 — Hardening para piloto real
- RNF-PRIV-03: fluxo de exclusão de dados individual (LGPD, direito do titular) — não pode ficar para depois, é obrigação independente do modelo de negócio
- RNF-PRIV-01/02: revisão de minimização de dados de menores, textos de consentimento configuráveis por região
- RNF-SEC-04: log de auditoria imutável para ações administrativas sensíveis
- Cobertura de testes ≥ 80% em motor de sincronização e integrações (RNF-MAINT-01) — checkpoint de qualidade antes do piloto, não só no fim
- Teste de carga simulando 50 turmas / 2.000 alunos ativos (RNF-PERF-03)
- Preparação para Google Workspace Marketplace review / Microsoft Partner Center (RNF-SEC-05) — iniciar submissão

## 3. Ordem de dependências entre fases

```
Fase 0 (infra + registro de apps)
   └── Fase 1 (auth)
         └── Fase 2 (integração + sync engine)
               ├── Fase 3 (painel professor)
               ├── Fase 4 (conflitos + notificações)
               ├── Fase 5 (portal aluno / contingência)
               └── Fase 6 (migração) ── depende também de Fase 3 para UI de vínculo
Fase 7 (admin institucional) pode começar em paralelo à Fase 3, depende só de Fase 1
Fase 8 (billing/relatórios) depende de Fase 2 (precisa de dados de sincronização)
Fase 9 (hardening) atravessa todas as fases anteriores, mas RNF-PRIV-03 deve começar já na Fase 1 (é sobre dados de conta)
```

## 4. Definition of Done por fase

Cada fase só é considerada concluída quando:
1. Critérios de aceite dos RFs da fase estão implementados e cobertos por teste automatizado
2. Cobertura de teste do código novo em motor de sync / integrações ≥ 80% (RNF-MAINT-01)
3. Nenhuma regressão nos contract tests de Google/Microsoft (RNF-MAINT-02)
4. Revisão de acessibilidade básica (WCAG AA) para telas novas do painel/portal
5. Log estruturado emitido para os novos eventos de sincronização, quando aplicável (RNF-OBS-01)

O DoD global da v1 é o da seção 9 do documento de requisitos.

## 5. Riscos e pontos em aberto

- **Fila em banco sob carga**: uma fila baseada em tabela Oracle pode não escalar tão bem quanto um broker dedicado; mitigação: desenhar a tabela com índices adequados desde o início e revisar throughput no teste de carga da Fase 9. Se insuficiente, plano B é introduzir um broker leve só na migração pós-piloto.
- **Verificação OAuth em paralelo**: como o processo não bloqueia o desenvolvimento, existe risco de o app não estar aprovado a tempo do piloto real; acompanhar prazo do Google/Microsoft desde a Fase 0 e ter um plano de contingência (lançar com lista de test users enquanto aguarda aprovação, já que a v1 é para "algumas escolas").
- **RNF-AVAIL-04 (portal do aluno independente do painel)**: precisa de decisão de deploy (processos separados? mesma app com rota isolada?) — recomendo revisitar isso no início da Fase 5, quando o desenho de infraestrutura estiver mais maduro.
- **SSO institucional (RF-AUTH-05)**: prioridade Must, mas só é necessário se algum tenant piloto exigir SAML/OIDC corporativo — vale confirmar com as escolas-piloto antes de alocar tempo de engenharia na Fase 1.

## 6. Próximos passos imediatos

1. Confirmar este plano (fases, ordem, riscos) com o time/product owner
2. Fase 0: criar monorepo, configurar CI, provisionar Oracle Cloud Free Tier, abrir registro de app Google/Microsoft em modo teste
3. Definir escolas/tenants do piloto para validar SSO (RF-AUTH-05) e escala real (RNF-PERF-03) o quanto antes
