## ADDED Requirements

### Requirement: Observar só os namespaces configurados, com leitura apenas

O servidor SHALL observar Deployments e CronJobs somente dos namespaces listados na configuração,
por list + watch na API do Kubernetes, autenticado pela conta de serviço do pod. A permissão SHALL
ser só `get`, `list` e `watch` sobre `deployments` (apps) e `cronjobs` (batch), concedida apenas
nesses namespaces. O servidor SHALL NOT ler Secrets, Pods ou logs.

#### Scenario: Namespace fora da lista
- **WHEN** um Deployment muda de revisão num namespace que não está na configuração
- **THEN** o painel não mostra nada sobre ele

#### Scenario: Permissão negada
- **WHEN** a API do Kubernetes responde 403 para um namespace configurado
- **THEN** o rodapé do painel mostra o cluster com erro de permissão nomeando o namespace, e os outros namespaces continuam observados

### Requirement: A virada é detectada pela revisão, não pela tag nem pela geração

Uma virada SHALL começar quando a anotação `deployment.kubernetes.io/revision` de um Deployment
muda. Mudança só de `spec.replicas` (o HPA escalando) SHALL NOT ser virada, ainda que
`metadata.generation` suba. Template novo com a mesma tag de imagem (tag móvel, como
`tiwinker/chatwoot:prod`) SHALL ser virada.

#### Scenario: HPA escala no meio do dia
- **WHEN** o HPA do `winker-prod` muda as réplicas de 8 para 17
- **THEN** nenhuma virada aparece no painel

#### Scenario: Chat com tag móvel
- **WHEN** o `helm upgrade` do chat troca a anotação `rollme` do template sem mudar a tag `prod`
- **THEN** a virada da release `chatwoot` aparece no painel

### Requirement: Estados por release do Helm

Os Deployments SHALL ser agrupados pela release do Helm (anotação `meta.helm.sh/release-name`; na
falta, o rótulo `app.kubernetes.io/instance`; na falta dos dois, o próprio nome do Deployment). Cada
release SHALL ter um destes estados, somando os seus Deployments:

- **Atualizando:** alguma réplica ainda não está na versão nova ou disponível, ou o controlador
  ainda não observou a geração atual.
- **Sem progresso:** atualizando, sem aumento de réplicas atualizadas ou disponíveis há 2 minutos.
- **Travado:** algum Deployment com a condição `Progressing` em `False` e motivo
  `ProgressDeadlineExceeded`.
- **Concluído:** em todos os Deployments, `observedGeneration` ≥ `generation`, réplicas
  atualizadas = disponíveis = `spec.replicas` (o mesmo critério do `kubectl rollout status`).

Deployment com `spec.replicas` = 0 SHALL contar como concluído. A contagem exibida SHALL ser a soma
das réplicas atualizadas sobre a soma de `spec.replicas` da release.

#### Scenario: Virada do winker-prod
- **WHEN** o `winker-prod` (17 réplicas, `maxSurge 1`, `maxUnavailable 0`) está com 9 réplicas atualizadas
- **THEN** a release aparece como "atualizando" com `9/17`

#### Scenario: Virada travada
- **WHEN** o `connector-access` passa 600 s sem progresso e o Kubernetes marca `ProgressDeadlineExceeded`
- **THEN** a release aparece como "travado"

#### Scenario: Release com vários Deployments
- **WHEN** a release `gateway-worker` tem 17 Deployments e só parte deles terminou
- **THEN** a release continua "atualizando" e a contagem soma as réplicas de todos

### Requirement: CronJobs da release contam a imagem nova, sem virada

Os CronJobs de uma release SHALL ser contados como "<n> CronJobs na imagem nova" quando o template
deles muda junto com a release, e SHALL NOT impedir a release de ficar concluída.

#### Scenario: gateway-cron
- **WHEN** o `helm upgrade` do `gateway-cron` atualiza os 95 CronJobs
- **THEN** a release aparece com "95 CronJobs na imagem nova" e sem barra de virada

### Requirement: Linha de base no boot e reconexão

No boot, o servidor SHALL listar os Deployments e usar o estado atual como linha de base: release
concluída não vira deploy; release no meio de uma virada aparece como deploy em andamento. Quando o
watch fechar ou a API responder 410 (versão de recurso expirada), o servidor SHALL listar de novo e
retomar o watch, sem criar virada falsa para o que não mudou.

#### Scenario: Kuma reinicia no meio de uma virada
- **WHEN** o Kuma sobe enquanto o `gateway-prod` está com 6 de 16 réplicas atualizadas
- **THEN** o painel mostra a virada do `gateway-prod` em andamento

#### Scenario: Watch expira
- **WHEN** a API do Kubernetes responde 410 ao watch
- **THEN** o servidor lista de novo, retoma o watch, e nenhuma virada aparece para release que não mudou de revisão

### Requirement: Fora do cluster, a fonte fica desligada

Sem o token da conta de serviço do Kubernetes no pod, a fonte do cluster SHALL ficar como "não
configurada", e o servidor do Kuma SHALL subir normalmente.

#### Scenario: Desenvolvimento local
- **WHEN** o Kuma sobe fora do Kubernetes
- **THEN** nenhum erro de boot acontece e o painel mostra o cluster como "não configurado"

### Requirement: Guardar só o necessário

Do objeto do Deployment, o servidor SHALL guardar só namespace, nome, release, revisão, tags de
imagem dos containers, réplicas e condições. Variáveis de ambiente, volumes e qualquer outro campo
do template SHALL NOT ser guardados nem enviados ao navegador.

#### Scenario: Deployment com variáveis de ambiente
- **WHEN** um Deployment observado tem variáveis de ambiente com credenciais no template
- **THEN** nenhum valor delas aparece no estado em memória nem nas mensagens enviadas pelo socket
