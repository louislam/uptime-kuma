## ADDED Requirements

### Requirement: Webhooks assinados, recusados sem assinatura válida

O servidor SHALL receber webhooks em `POST /api/deploy-board/webhook/bitbucket` e
`POST /api/deploy-board/webhook/github`. Cada pedido SHALL ser autenticado por HMAC-SHA256 do
**corpo cru**, com o segredo da fonte vindo do ambiente (`X-Hub-Signature` no Bitbucket,
`X-Hub-Signature-256` no GitHub), comparado em tempo constante.

- Fonte sem segredo configurado: a rota SHALL responder 404.
- Assinatura ausente ou errada: SHALL responder 401 e não registrar nada.
- Corpo acima de 1 MiB: SHALL responder 413.
- As rotas SHALL ter limite de taxa por IP.

Segredo, cabeçalho de assinatura e corpo do pedido SHALL NOT aparecer em log.

#### Scenario: Assinatura correta
- **WHEN** o Bitbucket envia `repo:commit_status_updated` com assinatura válida
- **THEN** o servidor responde 2xx e o estado da pipeline aparece no painel

#### Scenario: Assinatura errada
- **WHEN** um pedido chega com `X-Hub-Signature-256` que não confere com o corpo
- **THEN** o servidor responde 401 e nenhum deploy é criado ou alterado

#### Scenario: Corpo reserializado não serve
- **WHEN** a assinatura é calculada sobre o JSON reserializado em vez do corpo recebido
- **THEN** o pedido é recusado, porque a verificação usa os bytes recebidos

#### Scenario: Fonte desligada
- **WHEN** não há segredo do GitHub configurado
- **THEN** `POST /api/deploy-board/webhook/github` responde 404

### Requirement: Só os repositórios e branches configurados

O servidor SHALL considerar apenas eventos de repositórios listados na configuração e da branch de
produção de cada projeto. Os demais SHALL ser aceitos com 2xx e descartados sem registro, para o
remetente não reenviar.

#### Scenario: Push numa branch de feature
- **WHEN** chega um push assinado do `winker/condominio` na branch `GPW-123`
- **THEN** o servidor responde 2xx e nada aparece no painel

### Requirement: O que cada evento informa

- Bitbucket `repo:push` e GitHub `push` na branch de produção SHALL registrar o **merge**: hora,
  SHA e a primeira linha da mensagem do commit, truncada em 120 caracteres.
- Bitbucket `repo:commit_status_created` e `repo:commit_status_updated` SHALL registrar o estado da
  pipeline do commit: em andamento (`INPROGRESS`), sucesso (`SUCCESSFUL`), falha (`FAILED`) ou
  parada (`STOPPED`).
- GitHub `workflow_run` SHALL registrar o estado da execução (fila, em andamento, concluída com
  `success`, `failure` ou `cancelled`), e `workflow_job` SHALL registrar cada job pelo nome, com
  seu estado e duração.

Do corpo do evento, o servidor SHALL guardar só esses campos e o link para a execução.

#### Scenario: Merge no condominio
- **WHEN** chega o `repo:push` do merge de `develop` em `master` no `winker/condominio`
- **THEN** o painel cria o deploy com o SHA curto e "Merged develop into master", e começa a contar o tempo desde o merge

#### Scenario: Jobs no GitHub
- **WHEN** chegam `workflow_job` dos jobs `build` e `deploy` do `gladfy/chat`
- **THEN** o cartão do deploy mostra os dois jobs com o estado de cada um

### Requirement: Jobs do Amplify por consulta, com leitura apenas

Quando houver credencial AWS, o servidor SHALL descobrir os apps do Amplify da região configurada e,
em cada um, a branch de estágio `PRODUCTION`, e SHALL consultar os jobs dessas branches: a cada
60 s quando nenhum job estiver em andamento e a cada 15 s quando houver. Para job em andamento, os
passos (`BUILD`, `DEPLOY`, `VERIFY`) SHALL vir da consulta do job. A permissão AWS SHALL ser só
`amplify:ListApps`, `amplify:ListBranches`, `amplify:ListJobs` e `amplify:GetJob`. Sem credencial,
a fonte SHALL ficar "não configurada".

#### Scenario: Build do pro
- **WHEN** um job da branch `main` do app `pro` está em `RUNNING` no passo `BUILD`
- **THEN** o painel mostra o deploy do `pro` com o passo de build em andamento, em até 60 s depois de o job começar

#### Scenario: Branch que não é de produção
- **WHEN** a branch `homolog` do `pro` (estágio `NONE`) faz build
- **THEN** nada aparece no painel

#### Scenario: Consulta falha
- **WHEN** a API do Amplify responde erro por mais de 3 ciclos seguidos
- **THEN** o rodapé marca o Amplify como sem leitura, e os deploys do Amplify em andamento aparecem como não confirmados

### Requirement: Pipeline e virada viram um deploy só

Um deploy SHALL juntar o merge, a pipeline e a virada do mesmo commit de um projeto:

1. Quando a tag da imagem da release contém o SHA do commit (inteiro ou prefixo de ao menos 7
   caracteres), a virada SHALL ser ligada à pipeline desse commit.
2. Quando a tag não contém SHA (tag móvel ou numerada), a virada SHALL ser ligada à pipeline mais
   recente do mesmo projeto que estava em andamento no início da virada ou concluiu com sucesso até
   20 minutos antes, e que ainda não esteja ligada a outra virada.
3. Virada sem pipeline correspondente SHALL virar um deploy "sem pipeline" **somente quando a
   fonte de pipeline do projeto (Bitbucket ou GitHub) estiver configurada**. Com a fonte do
   projeto desligada, a virada SHALL aparecer sem a parte de pipeline e SHALL NOT receber o rótulo
   "Sem pipeline", que significa deploy manual.
4. Pipeline concluída com sucesso de projeto no cluster sem nenhuma virada em 10 minutos SHALL
   aparecer com o aviso "pipeline verde, nenhuma virada vista" **somente quando a fonte do cluster
   estiver ativa**. Sem ela, o painel não tem como saber se houve virada e SHALL NOT dar o aviso.

O projeto de uma release SHALL vir da configuração (lista de releases por projeto).

#### Scenario: SHA na tag
- **WHEN** a release `winker-prod` passa a usar `tiwinker/condominio:c13dc62f43f7…` e há pipeline do commit `c13dc62f43f7…`
- **THEN** a virada aparece no mesmo cartão da pipeline

#### Scenario: Tag móvel
- **WHEN** a release `chatwoot` vira com a tag `prod` e o workflow do `gladfy/chat` terminou com sucesso 1 minuto antes
- **THEN** a virada aparece no cartão desse workflow

#### Scenario: Deploy que não chegou ao cluster
- **WHEN** a pipeline do api_gateway termina com sucesso, o cluster está sendo lido e nenhuma release do projeto muda de revisão em 10 minutos
- **THEN** o cartão mostra "pipeline verde, nenhuma virada vista"

#### Scenario: Fonte de pipeline ainda não ligada
- **WHEN** o segredo do Bitbucket não está configurado e a release `winker-prod` muda de revisão
- **THEN** o cartão do condominio mostra só a virada, sem seção de pipeline e sem o rótulo "Sem pipeline"

#### Scenario: Cluster desligado
- **WHEN** o Kuma roda fora do cluster e a pipeline do api_gateway termina com sucesso
- **THEN** o cartão mostra a pipeline concluída e não mostra o aviso "pipeline verde, nenhuma virada vista"

### Requirement: Configuração por arquivo, segredos por ambiente

A configuração do painel SHALL vir de um arquivo JSON indicado por variável de ambiente, com:
namespaces observados, projetos (nome, origem `bitbucket` ou `github`, repositório, branch de
produção e releases `<namespace>/<release>`) e a região do Amplify. Os segredos dos webhooks SHALL
vir de variáveis de ambiente próprias e SHALL NOT estar no arquivo. Arquivo ausente ou inválido
SHALL desligar todas as fontes de deploy (cluster, pipelines e Amplify, porque os namespaces e a
região também vêm dele), com erro legível no log, sem impedir o boot.

#### Scenario: Arquivo com erro
- **WHEN** o arquivo de configuração tem JSON inválido
- **THEN** o Kuma sobe, o log diz qual arquivo e qual erro, e o painel mostra as fontes como "não configuradas"

### Requirement: Histórico das últimas 24 horas em memória

Os deploys encerrados SHALL ficar em memória por 24 horas, com teto de 500 registros. Reiniciar o
Kuma SHALL apagar esse histórico. Nada do painel SHALL ser gravado no banco do Kuma.

#### Scenario: Teto
- **WHEN** o histórico chega a 500 deploys
- **THEN** o mais antigo sai para o novo entrar
