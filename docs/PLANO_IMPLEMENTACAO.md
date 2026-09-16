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

## 7. Status de implementação (código em `apps/api` e `apps/web`)

As Fases 0-9 têm uma primeira implementação no branch `claude/pensive-dijkstra-3s3dva`,
com build, lint e 278 testes unitários passando a cada commit. Resumo do que está
implementado de fato versus o que ficou simplificado ou pendente:

**Completo**: Fase 0 (monorepo, CI, multi-tenancy), Fase 1 (RF-AUTH-01 a 04, RBAC/JWT —
RF-AUTH-05 SSO institucional fica para quando algum tenant piloto exigir), Fase 2
completa (fila de sincronização, integração Google/Microsoft isolada com contract
tests, criação de turma espelhada com retry/backoff, e agora também publicação/edição
de tarefas — RF-SYNC-01/02 — e materiais por link — RF-INT-04), Fase 3 slice inicial
(login e painel de turmas no Next.js — falta revisão WCAG a fundo, links de chat
nativo e resumo periódico), Fase 4 (log de auditoria, conflitos, notificações), Fase 5
completa (portal do aluno e contingência, incluindo tarefas/notas em modo leitura —
RF-STU-02 — RF-STU-04 detecção automática de sinais implementada depois, ver seção de atualizações), Fase 6
(migração de turmas existentes, com roster capturando o id do aluno em cada
provedor), Fase 7 (administração institucional), Fase 8 (billing de aluno ativo e
relatórios), Fase 9 (exclusão individual de dados via LGPD/RNF-PRIV-03).

Depois do fechamento das 6 fases, a camada de coursework foi implementada como
trabalho adicional (não fazia parte das fases originais, mas era o maior bloqueio
identificado): **Tarefa** (RF-SYNC-01/02, RF-INT-04) publica e edita coursework nas
duas plataformas via a mesma fila/worker; **Nota** (RF-SYNC-04) lança nota uma vez no
Bimo e propaga best-effort para Classroom/Graph quando o id do aluno naquele provedor
é conhecido (capturado durante a reconciliação de roster da Fase 6). Isso também
completou RF-STU-02 no portal do aluno.

**Atualização pós-coursework**: RF-MIG-02/04 (importar histórico de tarefas/notas de
uma turma migrada) e RF-REPORT-01 completo (taxa de entrega calculada de verdade a
partir de Tarefa/Nota, não mais só um proxy via contingência) foram implementados.
`MigrationService.importHistory` lê o histórico do lado já vinculado (Classroom e/ou
Teams) e grava Tarefa+Nota de forma idempotente, sem tentar publicar essas tarefas
antigas no lado recém-criado (ver código para o racional). O `ReportsService.
turmaSummary` agora reporta total de alunos/tarefas, taxa de entrega e a quebra
tarefas-só-Google/só-Microsoft/espelhadas — mas vale registrar uma limitação real do
modelo de dados: `Nota` não guarda de qual plataforma a entrega chegou, só um status
unificado, então a comparação "via Classroom vs via Teams" do requisito original é
aproximada pela origem da *tarefa* (qual(is) id(s) externo(s) ela tem), não por
entrega individual rastreada por origem.

**Atualização RF-SYNC-03**: o motor de conflito genérico (Fase 4) agora tem um
gatilho real: `CourseworkConflictCheckService.checkTarefa` (exposto em
`POST /tarefas/:id/check-conflito`) busca o estado atual da tarefa nas duas
plataformas (`GoogleClassroomClient.getCourseWork` / `MicrosoftTeamsClient.
getAssignment`), compara título/descrição/data/pontos contra o que o Bimo publicou
por último e, para cada campo divergente, registra um `SyncConflict` e marca a
`Tarefa` como `CONFLICT`, notificando o professor. **Simplificação intencional**:
a checagem é sob demanda (acionada pelo professor ou por uma chamada externa, ex.
um cron futuro), não um listener automático de mudanças — RF-INT-06
(webhooks/change notifications das duas APIs) continua não implementado, então uma
edição divergente feita fora do Bimo só é detectada na próxima checagem, não em
tempo real.

**Pendente, e por quê**: RF-INT-06 (webhooks/change notifications em tempo real)
segue não implementado, pelo motivo acima. A API de nota do Microsoft Graph
(`MicrosoftTeamsClient.setGrade`/`createAssignment`/`listAssignments`/
`listAssignmentSubmissions`) foi implementada com base no formato documentado
publicamente, mas nunca testada contra um tenant EDU real — validar antes de
produção, junto com a suposição de que o id da education class é o mesmo id do
grupo/Team criado.

**Atualização RF-MIG-06**: migração em lote implementada via
`MigrationService.linkExistingBatch` (`POST /migrations/turmas-existentes/lote`,
corpo `{ turmas: [...] }` no mesmo formato de cada item de
`POST /migrations/turmas-existentes`). Roda sequencialmente (não em paralelo,
para não estourar rate limit das duas APIs de uma vez com N turmas) e reaproveita
`linkExisting` item a item — uma turma que falha (id inválido, falta
`confirmedSameClass` quando os dois lados existem) não interrompe as demais;
cada item do lote volta com seu próprio resultado (`ok: true` + turma, ou
`ok: false` + mensagem de erro). Não inclui roster/histórico em lote (esses
continuam por turma, via os endpoints já existentes de `/roster` e
`/historico`) — escopo do requisito original era só o vínculo em si.

**Atualização RF-SYNC-06**: exclusão de tarefa implementada — era uma lacuna
real (não existia nenhum caminho de delete para `Tarefa` até aqui).
`TarefaService.requestDeletion(id, professorId, confirmed)` exige
`confirmed === true` explícito (caso contrário `BadRequestException`, sem
tocar em nada); quando confirmado, marca a tarefa como `DELETING` (novo
valor em `SyncStatus`, compartilhado com `TurmaEspelhada`) e enfileira
`DELETE_COURSEWORK_JOB`. `DeleteCourseworkHandler` propaga a exclusão só
para o(s) lado(s) já publicado(s) (`GoogleClassroomClient.deleteCourseWork`
/ `MicrosoftTeamsClient.deleteAssignment`, ambos novos) e marca `DELETED`
(exclusão lógica — `TarefaService.listByTurma` já filtra tarefas `DELETED`
das listagens, mas `findById` ainda encontra o registro para auditoria).
Endpoint `DELETE /tarefas/:id` com corpo `{ confirm: true }`. Falha ao
excluir em uma das plataformas marca `ERROR` (o professor pode tentar de
novo) em vez de deixar a tarefa num estado indefinido. **Simplificação
assumida** (documentada no client): o Graph pode recusar excluir um
assignment já atribuído a alunos — não testado contra um tenant EDU real,
tratado como falha de propagação igual a qualquer outro erro de API. 7
testes novos (128 no total).

**Atualização RNF-PRIV-01 (revisão de minimização, não é código)**: revisão
do modelo de dados de `Professor`, `Aluno` e `ExternalAccount` — os únicos
campos de identificação pessoal armazenados são e-mail institucional e nome
de exibição (ambos vindos do provedor OAuth/diretório da instituição, não
preenchidos livremente por um usuário), mais os tokens OAuth (cifrados,
`TokenEncryptionService`, RNF-SEC-01) em `ExternalAccount`. Não há data de
nascimento, documento, endereço ou qualquer outro dado de menor além do já
mínimo necessário para login e reconciliação de roster — nenhum campo extra
identificado para remover. Ponto de atenção não resolvido nesta revisão:
`Nota.grade`/`SubmissionStatus` fica retido indefinidamente mesmo após
`DataSubjectRequestsService.deleteOwnData` anonimizar o Aluno (RNF-PRIV-03) —
a nota em si não referencia o nome do aluno diretamente (só `alunoId`, que
passa a apontar para um registro anonimizado), então não é dado pessoal por
si só depois da anonimização, mas vale confirmar com jurídico se isso
satisfaz o requisito de minimização para dados de avaliação escolar.

**Atualização RNF-PRIV-02**: texto de consentimento configurável por região
implementado. `Tenant.consentRegion` (novo campo, default `BR-LGPD`) escolhe
qual texto se aplica; `ConsentTextsService` mantém 3 textos hardcoded
(`BR-LGPD`, `EU-GDPR`, `GENERIC`, com fallback para `GENERIC` numa região
desconhecida). `GET /tenants/:slug/consent-text` é público (sem sessão,
resolve o tenant pelo slug da URL — mesmo padrão de `/auth/*`) para exibir
na tela de login antes do OAuth; `PATCH /admin/tenant/consentimento` (admin
institucional/de rede) troca a região, validando contra
`ConsentTextsService.listRegions()` e registrando em log de auditoria
(RNF-SEC-04). **Simplificação assumida**: os textos são hardcoded no
código, não um editor de texto livre por instituição — cobre "escolher qual
base legal/texto se aplica", não personalização arbitrária. O texto ainda
não é registrado como "consentimento dado" em lugar nenhum (o campo
`version` existe para isso, mas nada grava "titular X consentiu com a
versão Y" ainda) — fica como próximo passo se o produto precisar provar
consentimento formal. A tela de login (`apps/web/src/app/login/page.tsx`)
já busca e exibe o texto (debounce de 400ms enquanto o professor digita o
identificador da instituição) abaixo do campo, antes de escolher Google ou
Microsoft. 7 testes novos (135 no total).

**Atualização RF-STU-04**: detecção automática de sinal de problema de
acesso implementada — até aqui a contingência era 100% reativa (o aluno
aciona, o professor só descobre se conferir o painel de RF-STU-05).
`EntregaContingenciaService.submit` agora conta, a cada envio, quantas
entregas de contingência aquele aluno já fez naquela turma; ao cruzar
`CONTINGENCY_SIGNAL_THRESHOLD` (2 — ou seja, a partir do 2º uso seguido),
notifica o professor proativamente via `NotificationsService.
notifyContingencySignal` (novo `NotificationKind.CONTINGENCY_SIGNAL`, mesmo
padrão de log `[e-mail]` + registro em painel dos demais tipos). Notifica só
uma vez ao cruzar o limite (não a cada entrega subsequente, para não
gerar spam), e a notificação é best-effort — uma falha ao notificar nunca
impede a entrega em si de ser registrada. **Simplificação assumida**: o
sinal é "uso repetido de contingência" (um proxy direto e sem falsos
positivos de terceiros), não uma heurística mais sofisticada envolvendo
falhas de OAuth/login — RF-STU-04 no requisito original é mais amplo
("detecção de sinais de problema de acesso" no plural), então outros sinais
(ex: falha recorrente de refresh token do professor já é RF-AUTH-04/RF-NOTIF-02,
mas nada equivalente existe do lado do aluno porque o aluno não faz OAuth
com o Bimo) ficam como possível extensão futura. 4 testes novos (139 no
total).

**Atualização RNF-MAINT-01**: cobertura de teste da API elevada de 57,27%
para 80,21% de statements (46,58% → 78,63% branches; 42,82% → 86,92%
funções; 57,64% → 81,11% linhas — medido com `npx jest --coverage` a partir
de `apps/api`), com 139 testes novos (139 → 278 no total). O trabalho foi
quase todo aditivo — nenhum teste existente foi alterado além de pequenos
ajustes nos mocks de repositório para suportar os novos casos. Focado em
três frentes: (1) os oito controllers que estavam em 0% de cobertura
(`TarefaController`, `NotaController`, `TurmaEspelhadaController`,
`ConflictController`, `NotificationsController`, `PortalController`,
`BillingController`, `MigrationController`, e depois também
`MatriculaController`, `ProfessorContingenciaController` e
`TenantBootstrapController`), instanciados diretamente com dependências
mockadas, cobrindo o wrap em `TenantContext.run` e o mapeamento de DTO para
input de serviço; (2) services/handlers sem spec algum (`TenantsService`,
`TenantMiddleware`, `SyncEventLogService`, `AlunosService`,
`GoogleTokenRefresher`/`MicrosoftTokenRefresher`,
`DataSubjectRequestsController`, os handlers `CreateMissingMicrosoftTeamHandler`/
`CreateMissingGoogleCourseHandler`), incluindo os ramos de erro
(`NotFoundException`, conta externa não vinculada, falha na chamada
externa); (3) os dois clients de integração (`GoogleClassroomClient`,
`MicrosoftTeamsClient`), que só tinham um contract test cobrindo
`createCourse`/`createTeam` — adicionados testes unitários para os
métodos restantes (`getCourse`, `listStudents`, `createCourseWork`,
`updateCourseWork`, `deleteCourseWork`, `listCourseWork`, `getCourseWork`,
`listSubmissions`, `setGrade` no Google; `getGroup`, `listMembers`,
`createAssignment`, `updateAssignment`, `deleteAssignment`,
`listAssignments`, `getAssignment`, `listAssignmentSubmissions`, `setGrade`
no Microsoft), incluindo os ramos de rate limit (429/503) e erro HTTP
genérico. Por fim, completados os ramos que faltavam em vários services já
parcialmente cobertos (`ProfessorsService`, `ExternalAccountsService`,
`TurmaEspelhadaService`, `TarefaService`, `NotaService`,
`NotificationsService`, `AdminController`, `MatriculaService`,
`ConflictService`). **Abaixo dos 80% ou fora do escopo, honestamente**:
`workers.module.ts` foi deliberadamente pulado (loop de poll gated por env
var, baixo valor para teste unitário) e os `*.module.ts` de wiring do Nest
continuam em 0% (esperado, não testado por convenção). Alguns arquivos
ficaram um pouco abaixo de 80% em branches — `admin.controller.ts` (poucas
combinações de guard testadas), `delete-coursework.handler.ts`,
`sync-queue.service.ts`/`sync-worker.service.ts` (alguns ramos defensivos
de erro concorrente) e `matricula.service.ts`/`nota.service.ts` (ramos de
`?? null` em campos totalmente opcionais) — considerados de baixo risco e
não perseguidos para não inflar a suíte com testes de pouco valor.

**Atualização RNF-UX-01**: primeira rodada de correções de acessibilidade nas
4 páginas do painel (`/`, `/login`, `/turmas`, `/auth/callback`). Trocados os
botões "Entrar com Google/Microsoft" de `<a>` com `pointerEvents:none` (não
focáveis nem anunciados como desabilitados por leitor de tela) para
`<button disabled>` reais; adicionado `role="status" aria-live="polite"` nos
estados "Carregando.../Entrando..." (antes silenciosos para leitor de tela);
tabela de turmas ganhou `<caption>` e `scope="col"` nos `<th>`; links
"Abrir no Classroom/Teams" (`target="_blank"`) ganharam texto oculto "(abre em
nova aba)"; adicionado skip-link "Pular para o conteúdo" e `:focus-visible`
global (antes inexistente, dependia só do outline padrão do navegador).
**Não é uma auditoria WCAG 2.1 AA completa** — não houve teste com leitor de
tela real (NVDA/VoiceOver) nem checagem de contraste automatizada
(axe-core/Lighthouse); fica como validação pendente antes de produção.

**Atualização RF-DASH-06**: resumo periódico semanal por professor
implementado via `PeriodicSummaryService` (`apps/api/src/billing/`), usando
`@nestjs/schedule` (`@Cron(CronExpression.EVERY_WEEK)`). Para cada tenant
(`TenantsService.listAll`) e cada professor com pelo menos uma turma
espelhada, agrega `ReportsService.turmaSummary` de todas as turmas do
professor (total de turmas, tarefas publicadas, entregas pendentes) e envia
via `NotificationsService.notifyPeriodicSummary` (mesmo padrão de
notificação em painel + log `[e-mail]` das demais notificações). Mesmo
padrão de opt-in do `WorkersModule`: só roda de fato quando
`PERIODIC_SUMMARY_ENABLED=true` (variável nova no `.env.example`), para não
bater no banco durante testes/CI. `generateForAllTenants`/`generateForTenant`
ficam públicos para acionar sob demanda sem esperar o cron semanal. Uma
falha ao gerar o resumo de um tenant é logada e não interrompe os demais
tenants. 5 novos testes.

**Atualização RF-DASH-05**: `TurmaEspelhada` agora grava `googleCourseUrl`
(`alternateLink` do Classroom) e `microsoftTeamUrl` (`webUrl` retornado ao criar o
Team a partir do grupo no Graph) nos dois fluxos de criação — criação nova
(`CreateTurmaEspelhadaHandler`) e criação do lado que faltava numa migração
(`CreateMissingGoogleCourseHandler`/`CreateMissingMicrosoftTeamHandler`). O painel
Next.js (`/turmas`) mostra "Abrir no Classroom"/"Abrir no Teams" como link quando o
id e a URL existem. **Limitação conhecida**: quando `MigrationService.linkExisting`
vincula uma turma que já existe nos dois lados (`createLinked`), nenhuma URL é
capturada — `resolveName` só busca nome via `getCourse`/`getGroup`, que não expõem
os campos de link; nesse caso a coluna fica nula e o painel volta a mostrar apenas
"Criado". Não é um caminho comum (a maioria das turmas nasce pelo fluxo normal ou
com um lado faltando), mas fica registrado como pendência caso vire prioridade.

**Atualização infraestrutura/deploy**: banco Autonomous Database Always Free
provisionado num tenant real (`bimodb`, região sa-saopaulo-1), conectado via
Wallet (mTLS obrigatório nesse tier). `app.module.ts` e o novo
`src/data-source.ts` (config só para o CLI do TypeORM) aceitam
`DB_CONNECT_STRING` (alias do `tnsnames.ora` da Wallet) com fallback para
host/port/serviceName. Migration inicial (`src/migrations/1758000000000-
InitialSchema.ts`) escrita à mão com as 13 tabelas — não deu pra usar
`typeorm migration:generate` porque essa geração exige uma conexão viva com
o banco pra introspecção/diff, e a porta 1522 (TCPS/mTLS) está bloqueada no
sandbox onde este agente roda; o DDL segue exatamente o mapeamento de tipos
do driver Oracle do TypeORM (conferido lendo `OracleDriver.js`) pra não
divergir se `migration:generate` for rodado no futuro contra o banco real.
`npm run migration:run`/`migration:revert`/`migration:show` adicionados ao
`apps/api/package.json`. Também: `Dockerfile` para `apps/api` e `apps/web`
(build multi-stage, `output:'standalone'` no Next.js), `docker-compose.yml`
e `docs/DEPLOY.md` com o passo a passo completo de hospedar numa VM Ampere
A1 Always Free — validado nesta sessão até onde dá sem um daemon Docker
disponível (o `npm ci`/`npm run build` que o Dockerfile executa foram
replicados manualmente fora do Docker e funcionaram; `docker build`/
`docker compose up` de ponta a ponta ficam para testar na VM real).

**Não executado nesta sessão** (exige ambiente real, não é código): subir de
fato os containers e rodar a migration contra o Autonomous Database (bloqueado
pela mesma porta 1522/TCPS do sandbox), teste de carga contra RNF-PERF-03
(script k6 em `apps/api/loadtest/`, pronto para rodar contra um staging
real), e o processo de verificação OAuth do Google (OAuth verification/CASA)
e admin consent do Microsoft Entra ID — ambos dependem de contas reais nos
consoles do Google Cloud e do Microsoft Entra ID, fora do escopo de um agente
de código.
