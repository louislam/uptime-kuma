## Context

O protótipo do painel (artefato "Winker Serviços — Wallboard (TV)", 30/10/2026) validou a ideia de
juntar deploys e saúde numa tela de parede e mostrou o limite do arranjo: com os deploys em cima,
os 34 monitores da status page `winker` ficaram pequenos e paginados. As decisões do usuário para
esta mudança: **todas as fontes já na primeira versão** (cluster, Bitbucket, GitHub, Amplify),
**página só com login** e **duas colunas**.

**Como os deploys acontecem hoje (medido em 29 e 30/10/2026):**

| Projeto | Pipeline | Releases no EKS (namespace) | Tag da imagem |
|---|---|---|---|
| condominio | Bitbucket, sem `--wait` | `winker-prod` (17 réplicas no pico), `winker-integration` (2) — `condominio` | SHA completo |
| api_gateway | Bitbucket, sem `--wait` | `gateway-worker` (17 Deployments, 39 pods), `gateway-cron` (95 CronJobs), `gateway-integration` (20), `gateway-prod` (16) — `gateway` | SHA completo |
| connector-server | Bitbucket, sem `--wait` | `connector-worker` (7 Deployments, 29 pods), `connector-queue` (2), `connector-access` (4), `connector-consumer` (2) — `connector` | SHA completo |
| chat | GitHub Actions, sem `--wait` | `chatwoot` (`chatwoot-web` 2 + `chatwoot-worker` 2) — `chat` | **móvel**: sempre `prod`; o rollout é forçado pela anotação `rollme` e `imagePullPolicy: Always` |
| uptime-kuma | GitHub Actions, **com** `--wait --timeout 5m` | `uptime-kuma` (1) — `monitor-infra` | `2.5.3-winker.<run>` |
| 8 apps Amplify | Amplify | — | cada app tem uma branch em estágio `PRODUCTION` (`main` ou `master`) |

- O `winker-prod` usa `maxSurge 1`, `maxUnavailable 0` e `progressDeadlineSeconds 600`; a virada de
  29/10 levou 12 min (13:20 → 13:32 UTC).
- O HPA muda `spec.replicas` o dia todo (o `winker-prod` estava com 8 de madrugada e 17 à tarde), e
  isso também incrementa `metadata.generation`.
- O Kuma de produção já roda a imagem do fork (`tiwinker/uptime-kuma:2.5.3-winker.15`), réplica
  única com volume, usando a ServiceAccount `default` de `monitor-infra`. O cluster tem precedente
  de leitura só por ClusterRole (`infra-pending-watch`).

**Estado relevante do código do Kuma:**
- `server/server.js:213` registra `app.use(express.json())` globalmente, **antes** dos roteadores
  (`api-router` e `status-page-router` entram nas linhas 372–377). Quando um roteador nosso recebe o
  pedido, o corpo já foi consumido e reserializar não reproduz os bytes que o remetente assinou.
- Login: `afterLogin()` (`server/server.js:1828`) faz `socket.userID = user.id` e `socket.join(user.id)`.
  Handlers logados chamam `checkLogin(socket)`. No front, `Layout.vue` mostra `<Login>` quando
  `!$root.loggedIn && $root.allowLoginDialog`.
- A lista de monitores que o socket entrega a quem está logado já traz as tags
  (`Monitor.preparePreloadData`), e `$root.heartbeatList` recebe cada heartbeat ao vivo.
- `/api/status-page/:slug` devolve a curadoria (grupos, ordem e `childrenList` da expansão de grupo),
  com `cache("5 minutes")`.
- A TV importa a fonte de `src/assets/fonts/plus-jakarta-sans.css` com rota lazy, para os ~250 KB
  não entrarem no bundle de toda página.
- `axios` já é dependência. AWS SDK não é (há só provedores de credencial transitivos em
  `node_modules/@aws-sdk`).

## Goals / Non-Goals

**Goals:**
- Painel em rota própria, logada, em duas colunas, com os monitores ocupando a maior parte da tela.
- Ver a virada no cluster, que é a parte que ninguém acompanha hoje, com o mesmo critério do
  `kubectl rollout status`.
- Juntar merge, pipeline e virada num cartão só, inclusive quando a tag da imagem não carrega SHA.
- Manter saúde (Kuma) e deploy como sinais separados na tela.
- Custo de merge com o upstream próximo de zero: quase tudo em arquivo novo, e o que toca arquivo
  quente é inserção de uma linha.
- Nenhuma permissão de escrita em lugar nenhum: Kubernetes e AWS só leitura.

**Non-Goals:**
- Passos da pipeline no Bitbucket (exigiria token e consulta à API; ver Pendências da proposta).
- Persistir histórico no banco do Kuma.
- Ações a partir da tela (disparar, cancelar, desfazer deploy).
- Notificação de deploy pelos providers do Kuma.
- Alterar a status page, a TV ou as pipelines dos outros repositórios.

## Decisions

### 1. Página nova fora do `Layout`, com o login do próprio Kuma

**Decisão:** rota `/deploys/:slug` no nível de cima de `src/router.js` (fora do `Layout`, para não
ter a barra de navegação numa TV), import lazy. A página renderiza o componente `Login` existente
quando `!$root.loggedIn && $root.allowLoginDialog`, como o `Layout` faz, e só monta o painel com
`$root.loggedIn`. `src/mixins/socket.js` não muda: o caminho não casa com `/^\/status/`, então o
socket abre.

*Alternativas descartadas:* (a) rota filha do `Layout` — leva a barra de navegação e o menu
para a TV; (b) `/status/:slug/deploys` — cairia em `noSocketIOPages` e exigiria editar
`socket.js`, e "status" é o espaço do que é público.

### 2. Dado de deploy só por socket autenticado

**Decisão:** socket handler novo (`server/socket-handlers/deploy-board-socket-handler.js`):
`getDeployBoard` responde o estado inteiro depois de `checkLogin(socket)`. Mudanças são difundidas
como `deployBoardUpdate` com o estado inteiro, no máximo uma vez por segundo, para cada socket com
`socket.userID` definido. O estado é pequeno (dezenas de deploys, centenas de bytes cada), então
mandar inteiro evita reconciliação de diff no front.

*Alternativas descartadas:* REST com chave na URL (o usuário escolheu login, e a regra do fork é
socket para o que é logado); difundir com `io.emit` (alcançaria socket anônimo de status page).

### 3. Monitores: curadoria pela status page, estado pelo socket, ligação pela tag

**Decisão:** a lista e a ordem vêm de `GET /api/status-page/:slug` (o mesmo que a status page usa,
com expansão de grupo), relida a cada 5 minutos para acompanhar o cache. O estado de cada monitor
vem de `$root.heartbeatList` e `$root.monitorList`, que o socket logado já mantém ao vivo. A ligação
com release vem da tag `deploy` do monitor (`<namespace>/<release>` ou `amplify/<app>`), lida da
mesma `monitorList`.

*Por quê:* trocar o que aparece no painel é editar a status page, como na TV; ligar um monitor a
uma release é editar o monitor, sem deploy. *Descartado:* mapa monitor → release no arquivo de
configuração (exigiria deploy do Kuma para cada ajuste) e casar por nome (frágil: "Web" e
"winker-prod" não se parecem).

### 4. Cluster: list + watch com axios, virada pela revisão

**Decisão:** `server/deploy-board/kubernetes-source.js` fala com a API do Kubernetes pelo endereço
interno (`KUBERNETES_SERVICE_HOST`/`PORT`), com o token e o CA montados da ServiceAccount, usando o
`axios` que já existe e um `https.Agent` com esse CA. Para cada namespace configurado e cada recurso
(`apps/v1 deployments`, `batch/v1 cronjobs`): `list` para a linha de base e `watch` com
`resourceVersion`, lendo o stream linha a linha. Fechou ou 410: lista de novo e retoma, com espera
crescente entre tentativas (1 s até 60 s). Só os campos da spec "Guardar só o necessário" saem do
objeto; o resto é descartado na leitura.

A virada começa quando `metadata.annotations["deployment.kubernetes.io/revision"]` muda. Escala
pelo HPA muda `generation` mas não a revisão; a anotação `rollme` do chat muda o template e,
portanto, a revisão. Estado por release conforme a spec, com "sem progresso" medido por um relógio
que zera a cada aumento de réplicas atualizadas ou disponíveis.

*Alternativas descartadas:* `@kubernetes/client-node` (dependência grande e de API instável para o
uso de dois recursos); consultar a cada N segundos (perde a granularidade e custa mais na API do que
um watch); detectar pela tag (falha no chat) ou pela `generation` (falso positivo a cada escala do
HPA).

### 5. Webhooks antes do `express.json()`, assinados sobre o corpo cru

**Decisão:** `server/routers/deploy-board-webhook-router.js` com
`express.raw({ type: "application/json", limit: "1mb" })` no próprio roteador, montado em
`server/server.js` **antes** da linha 213 (uma linha aditiva). O roteador só responde em
`/api/deploy-board/webhook/*`; qualquer outro caminho passa direto para o `express.json()` global,
sem mudança de comportamento para o resto do Kuma. A verificação é HMAC-SHA256 dos bytes recebidos
com `crypto.timingSafeEqual`. Depois de verificado, o corpo é parseado e passa por funções puras
(`bitbucket-events.js`, `github-events.js`) que devolvem só os campos que o painel usa.

| Fonte | Cabeçalho | Eventos usados |
|---|---|---|
| Bitbucket | `X-Hub-Signature: sha256=<hex>` | `repo:push`, `repo:commit_status_created`, `repo:commit_status_updated` |
| GitHub | `X-Hub-Signature-256: sha256=<hex>`, `X-GitHub-Event` | `push`, `workflow_run`, `workflow_job` |

Limite de taxa com uma instância própria de `KumaRateLimiter` (`server/rate-limiter.js`), sem
alterar as existentes. Log só com fonte, evento, repositório e desfecho; nunca corpo, cabeçalho ou
segredo.

*Alternativas descartadas:* trocar a linha 213 por `express.json({ verify })` guardando o corpo cru
(edita uma linha existente de arquivo quente, e passa a guardar o corpo cru de todo pedido do
Kuma); consultar a API do Bitbucket por polling (exige token, e o limite de 1.000 pedidos por hora
aperta com três repositórios); confiar em lista de IPs do Bitbucket e do GitHub (as listas mudam e
não autenticam o conteúdo).

### 6. Amplify por consulta com IRSA

**Decisão:** `server/deploy-board/amplify-source.js` com `@aws-sdk/client-amplify` e a cadeia
padrão de credenciais (no EKS, o webhook de identidade injeta `AWS_ROLE_ARN` e
`AWS_WEB_IDENTITY_TOKEN_FILE`). Descoberta (`ListApps` + `ListBranches`, filtrando estágio
`PRODUCTION`) a cada 30 minutos; `ListJobs` (`maxResults: 3`) por branch a cada 60 s, ou 15 s
enquanto houver job em andamento; `GetJob` só para job em andamento, para os passos. Com os 8 apps
de hoje: cerca de 500 chamadas por hora parado.

*Alternativa descartada:* EventBridge (`Amplify Deployment Status Change`) → API destination
chamando um webhook do Kuma. Exige regra, conexão com segredo e destino na AWS, mais uma rota
pública; a consulta só exige a role de leitura, que o usuário já aceitou dar.

### 7. Um deploy, três fontes: a correlação

**Decisão:** `server/deploy-board/store.js` mantém os deploys por projeto e aplica as regras da spec
"Pipeline e virada viram um deploy só": SHA na tag (inteiro ou prefixo ≥ 7) liga direto; sem SHA,
liga à pipeline do mesmo projeto em andamento no início da virada ou concluída com sucesso até 20
minutos antes; sem nada, "sem pipeline" — mas só se a fonte de pipeline do projeto estiver
configurada. Com ela desligada (fases 1 e 2, ou um segredo ausente), o cartão mostra só a virada:
rotular "sem pipeline" ali acusaria deploy manual em toda virada. Pelo mesmo motivo, o aviso
"pipeline verde, nenhuma virada vista" só existe com o cluster sendo lido. O store decide isso pela
situação de cada fonte, que ele já mantém para o rodapé. O projeto de uma release vem da configuração. A identidade
do deploy é `projeto + SHA` quando há SHA, e `projeto + id da execução` ou
`namespace/release + revisão` quando não há.

O estado do deploy é derivado, nunca gravado: a cada evento o store recalcula o rótulo
(`Na pipeline`, `Virando no cluster`, `Sem progresso`, `Virada travada`, `Falhou`, `No ar`,
`Sem pipeline`) a partir das partes. Funções puras, testáveis sem cluster.

### 8. Configuração por arquivo, segredos por ambiente

**Decisão:** `DEPLOY_BOARD_CONFIG` aponta para um JSON (montado de ConfigMap); segredos em
`DEPLOY_BOARD_BITBUCKET_SECRET` e `DEPLOY_BOARD_GITHUB_SECRET` (de Secret). Exemplo com os
projetos de hoje:

```json
{
  "namespaces": ["condominio", "gateway", "connector", "chat", "monitor-infra"],
  "amplify": { "region": "us-east-1" },
  "projects": [
    { "name": "condominio", "source": "bitbucket", "repo": "winker/condominio", "branch": "master",
      "releases": ["condominio/winker-prod", "condominio/winker-integration"] },
    { "name": "api_gateway", "source": "bitbucket", "repo": "winker/api_gateway", "branch": "master",
      "releases": ["gateway/gateway-worker", "gateway/gateway-cron", "gateway/gateway-integration", "gateway/gateway-prod"] },
    { "name": "connector-server", "source": "bitbucket", "repo": "winker/connector-server", "branch": "master",
      "releases": ["connector/connector-worker", "connector/connector-queue", "connector/connector-access", "connector/connector-consumer"] },
    { "name": "chat", "source": "github", "repo": "gladfy/chat", "branch": "master", "releases": ["chat/chatwoot"] },
    { "name": "uptime-kuma", "source": "github", "repo": "gladfy/uptime-kuma", "branch": "master", "releases": ["monitor-infra/uptime-kuma"] }
  ]
}
```

Validação no boot com mensagem que nomeia o campo errado; arquivo ausente ou inválido desliga
todas as fontes de deploy (os namespaces do cluster e a região do Amplify também vêm dele) sem
impedir o boot. A fase 2 já precisa do arquivo, só com `namespaces` e `projects`; os segredos só
entram na fase 3. Mudar a configuração exige reiniciar o Kuma, aceitável para
algo que muda quando nasce um repositório.

*Alternativa descartada:* tela de configuração no Kuma com JSON em `setting` — mais trabalho de
front para algo que muda raramente, e exigiria migration para validar o formato.

### 9. Layout em duas colunas e visual do protótipo

**Decisão:** em tela larga, grid de duas colunas: deploys em `minmax(26rem, 30%)`, monitores no
resto. A grade de monitores escolhe o menor número de colunas em que cabem todos com altura mínima
legível, medindo a área no DOM; não cabendo, pagina a cada 15 s. Monitores em `DOWN`/`PENDING`
sobem para o topo da coluna de monitores. Abaixo de 1.180 px, as colunas empilham.

A tipografia reusa `src/assets/fonts/plus-jakarta-sans.css` (o mesmo arquivo da TV, sem cópia) e os
estados seguem o protótipo: cor de marca oficial `#B11E58`, tema escuro por padrão com claro
disponível, texto dimensionado para leitura a distância.

Componentes em `src/components/deploy-board/`: `DeployCard.vue`, `MonitorGrid.vue`,
`IncidentBlock.vue`, `SourcesFooter.vue`; página em `src/pages/DeployBoard.vue`.

### 10. Pontas de registro

Não é monitor type nem notification provider. As pontas são:

| Ponta | Arquivo | Tipo de mudança | Fase |
|---|---|---|---|
| Socket handler | `server/server.js`, lista da linha ~1733 | 1 linha aditiva, mais o `require` no topo junto dos outros | 1 |
| Início dos coletores | `server/server.js`, no callback do `listen` depois de `startMonitors()` | 1 linha aditiva | 1 |
| Rota | `src/router.js` | 1 rota, import lazy | 1 |
| Textos | `src/lang/en.json`, `src/lang/pt-BR.json` | chaves novas no meio | 1, e acréscimos nas seguintes |
| Roteador de webhook | `server/server.js`, antes da linha 213 | 1 linha aditiva (`require` + `app.use`) | 3 |
| Dependência | `package.json` | `@aws-sdk/client-amplify` | 4 |

Esquecer a primeira ponta deixa as rotas de webhook respondendo 404; esquecer a terceira deixa o
painel com todas as fontes "sem leitura".

## Risks / Trade-offs

- [O watch do Kubernetes cai em silêncio (conexão viva sem eventos)] → o servidor fecha e reabre o
  watch com `timeoutSeconds` de 5 minutos, e o painel marca o cluster como sem leitura se passar de
  2 minutos sem resposta nem do watch nem da reabertura.
- [Correlação por janela erra quando dois deploys do mesmo projeto se sobrepõem] → só acontece em
  projetos de tag sem SHA (chat e o próprio Kuma), que têm deploy raro; o cartão mostra o SHA para
  conferência. Corrigir de vez é publicar o SHA na tag desses dois projetos.
- [Webhook público no domínio dos clientes] → HMAC sobre corpo cru, 404 sem segredo, 401 sem
  assinatura, 1 MiB de teto, limite de taxa e log sem conteúdo. O endpoint não devolve dado.
- [O nome exato do cabeçalho de assinatura do Bitbucket] → conferir numa entrega real antes de
  fechar a task (ver Open Questions); o teste da função de verificação cobre o formato `sha256=`.
- [Coletores no mesmo processo dos monitores] → trabalho é I/O e cálculo pequeno; memória limitada
  (histórico com teto de 500, só campos necessários). Uma exceção num coletor é capturada e vira
  estado "sem leitura" da fonte, nunca derruba o processo.
- [Histórico some ao reiniciar o Kuma] → aceito na proposta (Pendências futuras).
- [Reinício do Kuma durante o próprio deploy] → o painel fica fora do ar por esse minuto; ao voltar,
  mostra a linha de base do cluster.
- [Imagem maior com o AWS SDK] → `@aws-sdk/client-amplify` e o núcleo do smithy; medir o tamanho da
  imagem antes e depois na task de build.

## Migration Plan

A entrega é em quatro fases. Cada uma vai ao master do fork, passa pela pipeline dele (que faz
backup do banco antes do deploy) e é conferida em produção antes da seguinte. Nenhuma fase tem
migration de banco, então o rollback é sempre de imagem ou de configuração.

**Fase 1 — Página e monitores.**
- Código: decisões 1, 2, 3 e 9; esqueleto de 5, 7 e 8 (config, store e socket handler, com as
  fontes desligadas); as duas primeiras linhas da tabela da decisão 10.
- Infraestrutura: nenhuma. Sem `DEPLOY_BOARD_CONFIG`, as fontes aparecem como "não configurada".
- Conferência: `/deploys/winker` sem login mostra o login e nada mais; com login, numa TV 1080p, os
  34 monitores aparecem sem paginar e uma queda sobe para o destaque.
- Rollback: imagem anterior.

**Fase 2 — Virada no cluster.**
- Código: decisão 4; deploys vindos só do cluster no store; marca de deploy e correlação de queda
  pela tag `deploy`.
- Infraestrutura (chart `helm-packages/tools/uptimekuma`): ServiceAccount `uptime-kuma` e
  `serviceAccountName` no Deployment; ClusterRole `uptime-kuma-deploy-board` (get/list/watch em
  `apps/deployments` e `batch/cronjobs`) com RoleBinding em `condominio`, `gateway`, `connector`,
  `chat` e `monitor-infra`; ConfigMap com `namespaces` e `projects`; `DEPLOY_BOARD_CONFIG` no
  Deployment. Marcar os monitores com a tag `deploy`.
- Conferência: o próximo merge de qualquer dos três projetos do Bitbucket aparece virando, sem o
  rótulo "Sem pipeline"; `kubectl auth can-i` confirma que a ServiceAccount não lê Secrets.
- Rollback: tirar `DEPLOY_BOARD_CONFIG` desliga a fonte; a permissão pode ficar.

**Fase 3 — Pipelines.**
- Código: decisão 5 e a correlação completa da decisão 7; a linha do roteador no `server.js`.
- Infraestrutura: Secret com `DEPLOY_BOARD_BITBUCKET_SECRET` e `DEPLOY_BOARD_GITHUB_SECRET`,
  referenciado no Deployment. Cadastrar os webhooks: três no Bitbucket (`repo:push` e os dois de
  build status) e dois no GitHub (`push`, `workflow_run`, `workflow_job`), apontando para
  `https://monitor-clientes.winker.com.br/api/deploy-board/webhook/<fonte>`, e conferir a primeira
  entrega de cada um no histórico do remetente (incluindo o formato do cabeçalho do Bitbucket).
- Conferência: um merge real do condominio aparece num cartão só, do push à virada concluída.
- Rollback: tirar os segredos faz as rotas responderem 404 e os cartões voltarem a mostrar só a
  virada.

**Fase 4 — Amplify.**
- Código: decisão 6 e a dependência.
- Infraestrutura: role IAM em `terraform/` (padrão de `terraform/iam-cost-exporter`) com as quatro
  ações de leitura, confiando no OIDC do cluster para `monitor-infra:uptime-kuma`; anotação
  `eks.amazonaws.com/role-arn` na ServiceAccount; `amplify.region` no ConfigMap.
- Conferência: um build da branch de produção do `pro` aparece com os passos em até 60 s.
- Rollback: tirar `amplify.region` do ConfigMap desliga a fonte.

## Open Questions

- **Cabeçalho do Bitbucket:** conferir numa entrega real se o Bitbucket Cloud envia
  `X-Hub-Signature` com `sha256=`. Se vier outro formato, só a função de verificação muda.
- **Ligações que dependem de confirmação:** guest-link → "Convite" e gatekeeper-dashboard →
  "Portaria Web" parecem corresponder, mas não foram confirmadas. Os outros apps do Amplify ficam
  sem monitor até alguém dizer qual é.
- **Sessão da TV:** a TV fica logada com um usuário do Kuma. Decidir se é o usuário de sempre ou um
  usuário dedicado (o Kuma tem um usuário só por padrão; criar outro é configuração, não código).
