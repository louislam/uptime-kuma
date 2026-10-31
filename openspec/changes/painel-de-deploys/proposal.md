## Why

Quando alguém faz merge no master, ninguém acompanha a virada no Kubernetes. Nos três repositórios
do Bitbucket (condominio, api_gateway, connector-server) e no chat, o `helm upgrade` roda **sem
`--wait`**: a pipeline fica verde assim que o Helm entrega os manifestos, e os pods trocam depois.
Medido em 29/10/2026 no condominio: merge 13:13 UTC, pipeline verde 13:20, último pod pronto 13:32.
Foram 12 minutos de virada sem ninguém olhando, e uma virada travada passaria verde do mesmo jeito.

O time quer uma tela de parede que junte as duas coisas: o que está sendo publicado (pipeline e
virada) e se os serviços estão de pé (Kuma). O protótipo validou a ideia e mostrou o limite: com
os deploys em cima, os 34 monitores ficaram pequenos e paginados. O painel de TV que já existe
(`/status/<slug>/tv`) tem outro propósito, e misturar os dois estragaria os dois.

## What Changes

- **Página logada nova `/deploys/<slug>`**, em tela cheia e separada da TV, em duas colunas:
  deploys numa coluna estreita à esquerda e os monitores da status page `<slug>` em cerca de 70% da
  largura à direita. Os 34 monitores da status page `winker` cabem numa TV 1080p sem paginar.
  A página só abre com login no Kuma.
- **Virada lida do cluster.** O servidor do Kuma passa a observar os Deployments e os CronJobs dos
  namespaces configurados, com permissão **só de leitura**, e detecta a virada pela revisão do
  Deployment, não pela tag da imagem (o chat publica sempre `tiwinker/chatwoot:prod`). Estados:
  atualizando, sem progresso, travado (`ProgressDeadlineExceeded`) e concluído, por release do Helm.
- **Pipeline por webhook.** Rotas novas recebem webhooks do Bitbucket (`repo:push`,
  `repo:commit_status_*`) e do GitHub (`push`, `workflow_run`, `workflow_job`), conferidos por
  assinatura HMAC sobre o corpo cru. Sem segredo configurado, a rota não existe (404).
- **Jobs do Amplify por consulta.** O servidor consulta os jobs da branch de produção de cada app
  do Amplify (descoberta automática pelo estágio `PRODUCTION`), com permissão AWS só de leitura
  dada ao pod por IRSA.
- **Correlação** entre pipeline e virada pelo SHA do commit na tag da imagem; quando a tag não
  carrega SHA, pela janela de tempo da pipeline do mesmo repositório. Virada sem pipeline
  correspondente aparece como "sem pipeline" (deploy manual).
- **Ligação monitor ↔ release por tag do Kuma** (`deploy` = `<namespace>/<release>` ou
  `amplify/<app>`), editável na tela do monitor, sem deploy. É ela que faz o monitor mostrar
  "em deploy" e o destaque de queda dizer se a queda começou logo depois de uma virada.
- **A saúde do serviço vem só do Kuma.** Virada travada não pinta o monitor de vermelho, porque a
  versão anterior continua atendendo. Esse foi o erro do protótipo.

## Fases de entrega

A implementação sai em quatro fases. Cada uma vai para produção sozinha, com só a infraestrutura
dela, e a seguinte não muda o que a anterior entregou.

| Fase | O que entra em produção | Infraestrutura e configuração |
|---|---|---|
| **1. Página e monitores** | `/deploys/<slug>` com login, duas colunas, monitores ao vivo e destaque de queda; a coluna de deploys mostra as fontes como "não configurada" | Nenhuma |
| **2. Virada no cluster** | A virada de cada release, ao vivo; a marca "em deploy" e a correlação de queda nos monitores com a tag `deploy` | ServiceAccount do Kuma, leitura em 5 namespaces, ConfigMap com namespaces e projetos; marcar os monitores |
| **3. Pipelines** | Merge, pipeline e virada num cartão só; jobs do GitHub | Secret com os segredos; cadastro dos 5 webhooks |
| **4. Amplify** | Os 8 apps do Amplify, com passos do job | Role IAM por IRSA e anotação na ServiceAccount |

A ordem segue valor e custo: a virada é o que ninguém vê hoje e só precisa de permissão no
cluster; os webhooks exigem rota pública e cadastro em cinco repositórios; o Amplify é independente
e é a única fase com IAM e dependência nova.

## Capabilities

### New Capabilities

- `painel-de-deploys`: a página `/deploys/<slug>` — acesso só com login, as duas colunas, a lista
  de monitores tirada da curadoria da status page, os estados dos deploys e dos monitores, a
  ligação monitor ↔ release e o aviso quando uma fonte de dado para de responder.
- `deploys-no-cluster`: observação dos Deployments e CronJobs no EKS, detecção da virada por
  revisão, estados por release e a permissão só de leitura que isso exige.
- `deploys-de-pipeline`: webhooks assinados do Bitbucket e do GitHub, consulta dos jobs do Amplify
  e a correlação de pipeline com virada.

### Modified Capabilities

Nenhuma. `openspec/specs/` está vazio, e a mudança não altera requisito da status page nem da TV.

## Impact

**Candidatura a upstream:** não — **exclusiva do fork**. O upstream não tem o caso de uso
(pipelines e cluster de uma empresa específica), e a página depende de infraestrutura nossa.

**Arquivos quentes do upstream tocados** (custo de merge):
- `server/server.js` — três inserções de uma linha, todas aditivas: montar o roteador de webhook
  **antes** do `app.use(express.json())` da linha 213 (a assinatura HMAC precisa do corpo cru, e o
  parser global o consome), registrar o socket handler na lista da linha ~1733 e iniciar os
  coletores no boot.
- `src/router.js` — uma rota nova, com import lazy.
- `src/lang/en.json` e `src/lang/pt-BR.json` — chaves novas no meio do arquivo.
- `package.json` / `package-lock.json` — dependência nova `@aws-sdk/client-amplify`.
- `src/mixins/socket.js` **não** muda: a rota fica fora de `/status`, então o socket abre normalmente.
- Todo o resto é arquivo novo (`server/deploy-board/`, roteador, socket handler, página, testes).

**Infraestrutura** (repositório `infrastructure`):
- chart `helm-packages/tools/uptimekuma`: ServiceAccount própria para o Kuma (hoje ele roda com a
  `default`), ClusterRole de leitura de Deployments e CronJobs ligada por RoleBinding só nos
  namespaces observados, ConfigMap com a configuração, Secret com os segredos dos webhooks e, na
  fase 4, a anotação de IRSA na ServiceAccount;
- `terraform/`: a role IAM com as quatro ações de leitura do Amplify, no padrão de
  `terraform/iam-cost-exporter`.

**Configuração fora do código:** cadastrar os webhooks nos cinco repositórios (três no Bitbucket,
dois no GitHub) apontando para `monitor-clientes.winker.com.br` e marcar os monitores com a tag
`deploy`.

## Fora de escopo

- **Passos da pipeline no Bitbucket.** O webhook do Bitbucket só informa o estado da pipeline
  inteira; os passos ("Build & Push Docker", "Deploy") exigiriam consultar a API com um token. O
  painel infere a etapa pelo cluster (imagem nova aplicada = passou do deploy). No GitHub os jobs
  chegam pelo `workflow_job`.
- **Ações.** O painel só mostra; não dispara, cancela nem desfaz deploy.
- **Notificação de deploy** pelos providers do Kuma.
- **Outros clusters** (OKE na OCI) e ambientes Elastic Beanstalk.
- **Alterar a status page do cliente ou a TV.** As duas continuam como estão.
- **Colocar `--wait` nas pipelines dos outros repositórios.** É mudança nas pipelines, não no Kuma;
  o painel mostra a virada com ou sem ele.

## Pendências futuras

- **Histórico só em memória** (últimas 24 h): reiniciar o Kuma apaga a lista "Hoje". Revisar quando
  o reinício do Kuma passar a acontecer fora do próprio deploy dele, ou quando alguém pedir o
  histórico de mais de um dia.
- **Passos da pipeline do Bitbucket por API.** Revisar quando a falta de saber em que passo a
  pipeline falhou atrapalhar um diagnóstico.
- **O próprio deploy do Kuma não aparece ao vivo:** o pod reinicia (réplica única com volume), e o
  painel volta já com a virada concluída. Revisar se o Kuma passar a ter mais de uma réplica.
- **Webhooks no domínio dos clientes.** As rotas ficam em `monitor-clientes.winker.com.br`,
  protegidas por assinatura e limite de taxa. Revisar quando houver um host interno para o Kuma.
