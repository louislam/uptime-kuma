# Fase 1 — Página e monitores

Entra em produção sem nenhuma infraestrutura nova. As fontes de deploy aparecem como "não configurada".

## 1. Esqueleto do backend

- [x] 1.1 Criar `server/deploy-board/config.js`: lê o JSON de `DEPLOY_BOARD_CONFIG`, valida namespaces, projetos (`name`, `source` ∈ {bitbucket, github}, `repo`, `branch`, `releases` no formato `<namespace>/<release>`) e `amplify.region`, e devolve erro que nomeia arquivo e campo. Arquivo ausente ou inválido desliga todas as fontes de deploy, sem lançar.
- [x] 1.2 Criar `server/deploy-board/store.js` com a situação de cada fonte (`não configurada`, `ativa`, `sem leitura`, hora do último dado), a lista de deploys e o histórico (vazios nesta fase), `snapshot()` só com os campos que o navegador usa e `onChange` limitado a uma emissão por segundo.
- [x] 1.3 Criar `server/deploy-board/index.js`: monta config e store, `start()` idempotente, nenhuma fonte ligada nesta fase.
- [x] 1.4 Criar `server/socket-handlers/deploy-board-socket-handler.js`: `getDeployBoard` com `checkLogin(socket)`; difusão de `deployBoardUpdate` só para sockets com `socket.userID`.
- [x] 1.5 `server/server.js`, duas inserções de uma linha: registrar o socket handler na lista (~linha 1733, com o `require` junto dos outros) e chamar o `start()` no callback do `listen` depois de `startMonitors()`.
- [x] 1.6 Escrever `test/backend-test/deploy-board/test-config.js` (válido, ausente, JSON inválido, campo errado nomeado na mensagem), `test-store.js` (situação das fontes, campos do `snapshot()`, limite de emissão) e `test-socket-handler.js` (socket sem login recebe recusa e nenhum dado; com login recebe o estado; a difusão não alcança socket anônimo).

## 2. Página

- [x] 2.1 Registrar `/deploys/:slug` no nível de cima de `src/router.js` com import lazy de `src/pages/DeployBoard.vue`. Conferir que `src/mixins/socket.js` não precisa mudar.
- [x] 2.2 Criar `src/pages/DeployBoard.vue`: `<Login>` quando `!$root.loggedIn && $root.allowLoginDialog` e nenhum dado antes do login; com login, pede `getDeployBoard` e escuta `deployBoardUpdate`; lê a curadoria de `/api/status-page/:slug` (relida a cada 5 min) e mostra "página não encontrada" para slug inexistente ou despublicado.
- [x] 2.3 Layout em duas colunas (`minmax(26rem, 30%)` + resto), empilhando abaixo de 1.180 px, sem rolagem horizontal; fonte de `src/assets/fonts/plus-jakarta-sans.css`; tokens de cor no `:root` da página com tema escuro e claro; cor de marca `#B11E58`.
- [x] 2.4 Criar `src/components/deploy-board/MonitorGrid.vue` e `IncidentBlock.vue`: estado nos quatro estados do Kuma a partir de `$root.heartbeatList`, barras de heartbeat, `DOWN`/`PENDING` no destaque com o tempo no estado, `MAINTENANCE` na grade sem contar como queda. Sem fonte de deploy ativa, o destaque não tem linha de deploy.
- [x] 2.5 Dimensionar a grade medindo o DOM: menor número de colunas em que todos cabem com altura mínima legível; não cabendo, paginar a cada 15 s com "página X de Y".
- [x] 2.6 Coluna de deploys no estado sem fontes (texto que diz o que vai aparecer ali) e `src/components/deploy-board/SourcesFooter.vue` com a situação de cada fonte, incluindo o socket do Kuma.
- [x] 2.7 Extrair os textos para chaves novas em `src/lang/en.json` e `src/lang/pt-BR.json`, no MEIO do json, perto de chaves relacionadas.

## 3. Entrega da fase 1

- [x] 3.1 `npm run build`, `npm run test-backend`, `npm run lint` e `node extra/check-lang-json.js` verdes.
  - Rodada local de 31/10/2026: build ok, lint 0 erros (72 avisos, nenhum em arquivo desta mudança), langs ok, test-backend 302/303. O único vermelho é `monitors/test-mssql.js`, interrompido por esperar o download da imagem do MSSQL; o MSSQL não é usado na Winker e o teste não toca no painel.
- [x] 3.2 Localmente: sem login, a página mostra só o login e o socket não recebe dado do painel; com login, numa janela de 1920 × 1080 com a status page `winker`, os 34 monitores cabem sem paginar; com 400 px, as colunas empilham sem rolagem horizontal.
- [ ] 3.3 Merge no master do fork, deploy pela pipeline e conferência na TV: `/deploys/winker` logado, monitores ao vivo, queda subindo para o destaque.

# Fase 2 — Virada no cluster

Exige a ServiceAccount do Kuma com leitura em 5 namespaces e o ConfigMap com namespaces e projetos.

## 4. Estado da virada

- [ ] 4.1 Criar `server/deploy-board/rollout-state.js` (puro): dado o retrato dos Deployments de uma release, devolve o estado (atualizando, sem progresso, travado, concluído) com o critério do `kubectl rollout status`, a soma de réplicas atualizadas sobre `spec.replicas`, réplicas 0 como concluído, e a extração dos campos permitidos do objeto (namespace, nome, release, revisão, tags de imagem, réplicas, condições).
- [ ] 4.2 Escrever `test/backend-test/deploy-board/test-rollout-state.js`: virada do `winker-prod` com `maxSurge 1`, `ProgressDeadlineExceeded`, release de vários Deployments (`gateway-worker`), réplicas 0, mudança só de réplicas pelo HPA (não é virada), template novo com a mesma tag (é virada), e a asserção de que env e volumes de um Deployment com credencial plantada não sobrevivem à extração.

## 5. Coletor do cluster

- [ ] 5.1 Criar `server/deploy-board/kubernetes-source.js`: token e CA da ServiceAccount, `https.Agent` com o CA, `list` + `watch` por namespace para `apps/v1 deployments` e `batch/v1 cronjobs`, leitura do stream linha a linha, `timeoutSeconds` de 5 min, reabertura com espera de 1 s a 60 s, relista no 410, 403 por namespace como erro nomeado. Sem token = fonte "não configurada".
- [ ] 5.2 Linha de base no boot (release concluída não vira deploy; release no meio da virada aparece em andamento), relógio de "sem progresso" de 2 min e marca "sem leitura" quando o cluster passa de 2 min sem resposta.
- [ ] 5.3 CronJobs: contar os da release cujo template mudou junto ("N CronJobs na imagem nova"), sem bloquear o "concluído".
- [ ] 5.4 Escrever `test/backend-test/deploy-board/test-kubernetes-source.js` com servidor HTTP local no papel da API: eventos partidos no meio da linha, 410 seguido de relista sem virada falsa, 403 num namespace sem derrubar os outros, e ausência de token.

## 6. Deploys do cluster no painel

- [ ] 6.1 No store: deploy a partir da virada (identidade `namespace/release` + revisão, agrupado por projeto pela configuração), rótulo derivado da virada, sem seção de pipeline e sem "Sem pipeline" enquanto a fonte de pipeline do projeto estiver desligada; ciclo de vida (concluído some após 10 min; travado sai quando um deploy posterior do projeto conclui) e histórico de 24 h com teto de 500.
- [ ] 6.2 Ampliar `test-store.js`: rótulos com a fonte de pipeline desligada, ciclo de vida, teto do histórico e campos do `snapshot()`.
- [ ] 6.3 Criar `src/components/deploy-board/DeployCard.vue` (linhas de release com `<atualizados>/<réplicas>` e estado, linha de CronJobs, rótulos da spec), a ordem dos cartões (falha, travado, andamento, concluído) e a lista "Hoje".
- [ ] 6.4 Marca "em deploy"/"virada travada" pela tag `deploy` dos monitores e a linha de correlação do destaque, só com a fonte da release ativa. Deploy nunca muda a cor do monitor.
- [ ] 6.5 Chaves de i18n novas da fase, no meio dos dois json.

## 7. Infraestrutura da fase 2 (repositório `infrastructure`, chart `helm-packages/tools/uptimekuma`)

- [ ] 7.1 ServiceAccount `uptime-kuma` e `serviceAccountName` no Deployment (hoje usa a `default`).
- [ ] 7.2 ClusterRole `uptime-kuma-deploy-board` com `get`, `list` e `watch` em `apps/deployments` e `batch/cronjobs`, ligada por RoleBinding em `condominio`, `gateway`, `connector`, `chat` e `monitor-infra`. Conferir com `kubectl auth can-i --as=system:serviceaccount:monitor-infra:uptime-kuma` que ela lê Deployments nesses namespaces e não lê Secrets em nenhum.
- [ ] 7.3 ConfigMap com `namespaces` e `projects` (sem segredos) e `DEPLOY_BOARD_CONFIG` no Deployment. Publicar a versão nova do chart.

## 8. Entrega da fase 2

- [ ] 8.1 `npm run build`, `npm run test-backend`, `npm run lint` e `node extra/check-lang-json.js` verdes.
- [ ] 8.2 Deploy, marcar os monitores com a tag `deploy` e acompanhar o próximo merge de um projeto do Bitbucket no painel: a virada aparece por release, sem o rótulo "Sem pipeline", e conclui junto com o `kubectl rollout status`.

# Fase 3 — Pipelines

Exige o Secret com os dois segredos e o cadastro dos cinco webhooks.

## 9. Assinatura e leitura dos eventos

- [ ] 9.1 Criar `server/deploy-board/signature.js`: HMAC-SHA256 sobre o `Buffer` recebido, formato `sha256=<hex>`, `crypto.timingSafeEqual` com guarda de tamanho.
- [ ] 9.2 Criar `server/deploy-board/bitbucket-events.js` e `github-events.js` (puros): `repo:push`/`push` → merge (hora, SHA, primeira linha da mensagem truncada em 120); `repo:commit_status_*` → estado da pipeline; `workflow_run` → execução; `workflow_job` → job. Filtro por repositório e branch configurados. Só os campos da spec saem da função.
- [ ] 9.3 Escrever `test/backend-test/deploy-board/test-signature.js` e `test-webhook-events.js`: assinatura correta, errada, ausente, de tamanho diferente e calculada sobre o JSON reserializado (tem de falhar); payloads de exemplo reais de cada evento, branch de feature e repositório fora da configuração descartados.

## 10. Roteador de webhook

- [ ] 10.1 Criar `server/routers/deploy-board-webhook-router.js`: `express.raw({ type: "application/json", limit: "1mb" })` no próprio roteador, só em `/api/deploy-board/webhook/:source`; 404 sem segredo, 401 sem assinatura válida, 413 acima do teto, 2xx para evento descartado; instância própria de `KumaRateLimiter`; log só com fonte, evento, repositório e desfecho.
- [ ] 10.2 `server/server.js`: montar o roteador **antes** do `app.use(express.json())` da linha 213 (uma linha aditiva).
- [ ] 10.3 Escrever `test/backend-test/deploy-board/test-webhook-router.js` com o app Express e o roteador montado antes de `express.json()`: os desfechos 404/401/413/2xx, um pedido JSON comum a outra rota continua chegando parseado, e o log capturado não contém trecho do corpo nem do segredo.

## 11. Correlação e cartão completo

- [ ] 11.1 No store, a correlação da spec "Pipeline e virada viram um deploy só": SHA na tag (inteiro ou prefixo ≥ 7), janela de 20 min para tag sem SHA, "sem pipeline" só com a fonte do projeto configurada, "pipeline verde, nenhuma virada vista" só com o cluster ativo.
- [ ] 11.2 Ampliar `test-store.js`: o chat com tag `prod`, o condominio com SHA completo, dois deploys do mesmo projeto sobrepostos, fonte de pipeline desligada e cluster desligado.
- [ ] 11.3 Seção de pipeline no `DeployCard.vue` (estado, jobs do GitHub, SHA e primeira linha do commit, tempo desde o merge, "pipeline verde há N min" e o texto de que a virada continua no cluster), último evento de cada webhook no rodapé e as chaves de i18n da fase.

## 12. Infraestrutura e entrega da fase 3

- [ ] 12.1 Secret com `DEPLOY_BOARD_BITBUCKET_SECRET` e `DEPLOY_BOARD_GITHUB_SECRET`, referenciado no Deployment. Publicar a versão nova do chart.
- [ ] 12.2 `npm run build`, `npm run test-backend`, `npm run lint` e `node extra/check-lang-json.js` verdes; deploy.
- [ ] 12.3 Cadastrar os cinco webhooks com o segredo e conferir a primeira entrega de cada um no histórico do remetente, incluindo o formato do cabeçalho de assinatura do Bitbucket.
- [ ] 12.4 Acompanhar um merge real do condominio, do push à virada concluída, e registrar os tempos observados no change.

# Fase 4 — Amplify

Exige a role IAM por IRSA e a dependência nova.

## 13. Coletor do Amplify

- [ ] 13.1 Acrescentar `@aws-sdk/client-amplify` ao `package.json` e atualizar o `package-lock.json`. Anotar o tamanho da imagem `docker/winker.dockerfile` antes e depois.
- [ ] 13.2 Criar `server/deploy-board/amplify-source.js`: descoberta de apps e branch `PRODUCTION` a cada 30 min, `ListJobs` (`maxResults: 3`) a cada 60 s ou 15 s com job em andamento, `GetJob` para os passos do job em andamento, "sem leitura" após 3 ciclos com erro, "não configurada" sem credencial ou sem `amplify.region`.
- [ ] 13.3 Escrever `test/backend-test/deploy-board/test-amplify-source.js` com o cliente do SDK substituído por dublê: branch de estágio `NONE` ignorada, troca de ritmo 60 s ↔ 15 s, passos do `GetJob`, três erros seguidos levando a "sem leitura".
- [ ] 13.4 Deploys do Amplify no store e no cartão (passos `BUILD`, `DEPLOY`, `VERIFY`), ligação de monitor pela tag `amplify/<app>` e as chaves de i18n da fase.

## 14. Infraestrutura e entrega da fase 4

- [ ] 14.1 Role IAM em `terraform/` (padrão de `terraform/iam-cost-exporter`) com `amplify:ListApps`, `amplify:ListBranches`, `amplify:ListJobs` e `amplify:GetJob`, confiando no OIDC do cluster para `monitor-infra:uptime-kuma`.
- [ ] 14.2 Anotação `eks.amazonaws.com/role-arn` na ServiceAccount e `amplify.region` no ConfigMap. Publicar a versão nova do chart.
- [ ] 14.3 `npm run build`, `npm run test-backend`, `npm run lint` e `node extra/check-lang-json.js` verdes; deploy; conferir um build da branch de produção do `pro` no painel em até 60 s e ligar os monitores dos apps do Amplify (confirmar guest-link → "Convite" e gatekeeper-dashboard → "Portaria Web").
