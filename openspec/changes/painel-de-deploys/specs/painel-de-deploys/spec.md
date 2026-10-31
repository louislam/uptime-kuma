## ADDED Requirements

### Requirement: Página própria, só com login

O sistema SHALL servir o painel na rota `/deploys/<slug>`, em tela cheia, sem a barra de navegação
do Kuma. A página SHALL exigir login: sem sessão, ela SHALL exibir o formulário de login do Kuma e
nenhum dado de deploy ou de monitor.

O servidor SHALL entregar dado de deploy somente a socket autenticado. Pedido de socket sem login
SHALL ser recusado, e a difusão de mudanças SHALL alcançar só sockets autenticados.

#### Scenario: Abrir sem login
- **WHEN** `/deploys/winker` é aberto num navegador sem sessão no Kuma
- **THEN** a página mostra o formulário de login e nenhum nome de repositório, commit, release ou monitor aparece no HTML nem nas mensagens recebidas pelo socket

#### Scenario: Socket sem login pede o estado
- **WHEN** um socket não autenticado emite o pedido do estado do painel
- **THEN** o servidor responde com recusa de login e não envia nenhum deploy

#### Scenario: Abrir com login
- **WHEN** `/deploys/winker` é aberto com sessão válida
- **THEN** o painel aparece com os deploys à esquerda e os monitores da status page `winker` à direita

### Requirement: A TV e a status page não mudam

A rota `/status/<slug>/tv` e a status page `/status/<slug>` SHALL continuar exibindo o que exibem
hoje. O painel SHALL NOT importar nem alterar `StatusPage.vue` nem `StatusPageTv.vue`.

#### Scenario: As três telas convivem
- **WHEN** `/status/winker`, `/status/winker/tv` e `/deploys/winker` são abertos ao mesmo tempo
- **THEN** cada uma mostra o próprio layout, e as duas primeiras continuam públicas

### Requirement: Duas colunas, com os monitores ocupando a maior parte

Em tela larga, o painel SHALL dividir a tela em duas colunas: deploys numa coluna estreita à
esquerda (até cerca de 30% da largura) e monitores à direita no restante.

Numa tela de 1920 × 1080, os 34 monitores da status page `winker` SHALL caber todos sem paginar.
Quando a quantidade de monitores passar da capacidade da coluna, o painel SHALL paginar, com a
capacidade medida no DOM e nunca constante, sem cortar cartão.

Em tela estreita, as colunas SHALL empilhar (deploys em cima), com rolagem vertical normal e
nenhuma rolagem horizontal.

#### Scenario: TV 1080p com a status page winker
- **WHEN** o painel é aberto em 1920 × 1080 com a status page `winker` (34 monitores) e três deploys ativos
- **THEN** os 34 monitores aparecem na mesma tela, sem indicador de página, e nenhum cartão de deploy fica cortado

#### Scenario: Mais monitores do que cabem
- **WHEN** a status page tem mais monitores do que a coluna comporta na altura disponível
- **THEN** a coluna pagina sozinha e mostra "página X de Y", e nenhuma página corta cartão

#### Scenario: Celular
- **WHEN** o painel é aberto com 400 px de largura
- **THEN** os deploys aparecem acima dos monitores e a página não rola na horizontal

### Requirement: A lista de monitores vem da curadoria da status page

O painel SHALL exibir exatamente os monitores que a status page `<slug>` exibe, na mesma ordem,
respeitando a expansão de grupo (`monitor_group.show_children`). Slug inexistente ou despublicado
SHALL mostrar o mesmo desfecho de página não encontrada da status page.

#### Scenario: Monitor entra na status page
- **WHEN** um monitor é acrescentado à status page `winker`
- **THEN** ele passa a aparecer no painel sem release e sem recarregar a página manualmente

#### Scenario: Grupo expandido
- **WHEN** a status page tem um grupo com "mostrar monitores do grupo" ligado
- **THEN** o painel mostra os filhos diretos do grupo como monitores próprios

### Requirement: O estado de cada monitor vem do Kuma, ao vivo

O estado exibido de cada monitor SHALL vir do último heartbeat que o Kuma entregou pelo socket,
nos quatro estados do Kuma: `UP` (Normal), `PENDING` (Pendente), `DOWN` (Fora do ar) e
`MAINTENANCE` (Manutenção). Monitores em `DOWN` e `PENDING` SHALL subir para um bloco de destaque
no topo da coluna de monitores e sair da grade. `MAINTENANCE` SHALL ficar na grade com cor própria
e SHALL NOT contar como queda.

#### Scenario: Monitor cai
- **WHEN** o Kuma registra `DOWN` para um monitor da lista
- **THEN** o monitor sai da grade e aparece no destaque no topo da coluna, sem esperar ciclo de atualização

#### Scenario: Manutenção programada
- **WHEN** um monitor entra em manutenção
- **THEN** ele permanece na grade com o rótulo "Manutenção" e o veredito de serviços não acusa queda

### Requirement: Deploy não altera a saúde do monitor

A cor e o rótulo de estado de um monitor SHALL depender só do Kuma. Um deploy em andamento,
travado ou com falha SHALL NOT mudar o estado exibido do monitor; ele SHALL aparecer como uma
marca à parte no cartão do monitor ligado à release ("em deploy" ou "virada travada").

#### Scenario: Virada travada com serviço de pé
- **WHEN** a virada de `connector/connector-access` está travada e o monitor "Connector Access" está `UP` no Kuma
- **THEN** o monitor aparece como Normal, com a marca "virada travada", e o veredito de serviços não acusa queda

### Requirement: Ligação de monitor com release pela tag do Kuma

Um monitor SHALL ser ligado a uma release por uma tag do Kuma de nome `deploy`, com valor
`<namespace>/<release>` para o cluster ou `amplify/<app>` para o Amplify. Um monitor MAY ter mais
de uma tag `deploy`. Mudar a tag na tela do monitor SHALL refletir no painel sem deploy.

#### Scenario: Monitor com tag
- **WHEN** o monitor "Web" tem a tag `deploy` = `condominio/winker-prod` e começa uma virada do `winker-prod`
- **THEN** o cartão do monitor "Web" mostra a marca "em deploy" enquanto a virada durar

#### Scenario: Monitor sem tag
- **WHEN** um monitor não tem tag `deploy`
- **THEN** ele nunca mostra marca de deploy, e o destaque de queda diz que ele não tem deploy associado

### Requirement: O destaque de queda diz se havia deploy

Cada monitor no destaque SHALL mostrar há quanto tempo está no estado e uma linha sobre deploy:
"Deploy de <projeto> em andamento", "Começou <n> min depois da virada de <release>" (virada
concluída até 60 min antes do início da queda), "Nenhum deploy relacionado na última hora" ou
"Este monitor não tem deploy associado".

Quando a fonte da release ligada ao monitor (cluster ou Amplify) não está ativa, o destaque SHALL
omitir a linha de deploy: "nenhum deploy relacionado" só pode ser dito por quem está lendo a fonte.

#### Scenario: Queda depois de virada
- **WHEN** a virada de `gateway/gateway-prod` conclui e o monitor ligado cai 2 minutos depois
- **THEN** o destaque mostra "Começou 2 min depois da virada de gateway-prod" com o SHA curto do commit

#### Scenario: Queda sem a fonte do cluster
- **WHEN** o monitor "Web" (tag `deploy` = `condominio/winker-prod`) cai e a fonte do cluster não está configurada
- **THEN** o destaque mostra o monitor e o tempo fora do ar, sem nenhuma linha sobre deploy

### Requirement: O cartão de deploy separa pipeline e virada

Cada deploy SHALL aparecer como um cartão com: o projeto, o SHA curto e a primeira linha da
mensagem do commit (quando conhecida), o tempo desde o merge, o estado da pipeline (e os jobs,
quando a fonte informar) e, para projetos no cluster, uma linha por release com
"<atualizados>/<réplicas> na versão nova" e o estado da virada. Quando a pipeline já terminou e a
virada continua, o cartão SHALL dizer isso explicitamente.

Rótulos do cartão: "Na pipeline", "Virando no cluster", "Sem progresso", "Virada travada",
"Falhou", "No ar" e, para virada sem pipeline correspondente, "Sem pipeline".

Quando a fonte de pipeline do projeto (Bitbucket ou GitHub) não está configurada, o cartão SHALL
mostrar só a virada, sem a seção de pipeline, e SHALL NOT usar o rótulo "Sem pipeline": a ausência
de pipeline ali é falta de fonte, não deploy manual.

#### Scenario: Pipeline verde, virada em curso
- **WHEN** a pipeline do condominio terminou com sucesso e o `winker-prod` está com 9 de 17 réplicas na versão nova
- **THEN** o cartão mostra "Virando no cluster", "pipeline verde há N min", a linha `winker-prod 9/17` e o texto de que a virada continua no cluster

#### Scenario: Virada manual
- **WHEN** a fonte de pipeline do projeto está configurada e uma release dele muda de revisão sem pipeline correspondente
- **THEN** o cartão aparece com o rótulo "Sem pipeline" e a virada normalmente

#### Scenario: Pipeline ainda não ligada
- **WHEN** a fonte de pipeline do projeto não está configurada e uma release dele muda de revisão
- **THEN** o cartão mostra só a virada, com o rótulo do estado dela, sem seção de pipeline e sem "Sem pipeline"

### Requirement: Ordem e ciclo de vida dos cartões

Os cartões SHALL aparecer nesta ordem: com falha, travados, em andamento, concluídos. Um deploy
concluído SHALL ficar visível por 10 minutos e depois sair para a lista "Hoje". Um cartão de falha
ou de virada travada SHALL sair sozinho quando um deploy posterior do mesmo projeto concluir com
sucesso, e SHALL NOT exigir clique para sair.

A lista "Hoje" SHALL mostrar os deploys encerrados nas últimas 24 horas (projeto, SHA curto,
desfecho, duração e há quanto tempo), os mais recentes primeiro.

#### Scenario: Falha resolvida por deploy novo
- **WHEN** o connector-server tem uma virada travada e um deploy posterior dele conclui
- **THEN** o cartão travado sai do painel e os dois deploys aparecem na lista "Hoje"

### Requirement: O painel não afirma o que não leu

Cada fonte (Kuma, cluster, Bitbucket, GitHub, Amplify) SHALL mostrar no rodapé há quanto tempo
chegou o último dado. Quando a fonte passar do limite sem dado (cluster sem watch ativo, Amplify
sem consulta bem-sucedida, socket do Kuma desconectado), o painel SHALL avisar e marcar como não
confirmada a parte da tela que depende dela. Fonte não configurada SHALL aparecer como "não
configurada" e SHALL NOT gerar alarme.

Webhook não tem ritmo próprio: ausência de evento não é falha. Para Bitbucket e GitHub o rodapé
SHALL mostrar o último evento recebido, sem alarme por tempo.

#### Scenario: Watch do cluster cai
- **WHEN** a conexão de watch com o cluster cai e não volta por mais de 2 minutos
- **THEN** o rodapé marca o cluster como sem leitura e os cartões dizem que o estado da virada não está confirmado

#### Scenario: Rodando fora do cluster
- **WHEN** o Kuma roda na máquina de um desenvolvedor, sem conta de serviço do Kubernetes
- **THEN** o cluster aparece como "não configurado" e o resto do painel funciona

### Requirement: Textos traduzidos e sem controles de demonstração

Todo texto da página SHALL vir de chaves novas em `src/lang/en.json` e `src/lang/pt-BR.json`. A
página SHALL NOT ter botões de simulação nem dado fictício.

#### Scenario: Página em português
- **WHEN** o Kuma está em pt-BR
- **THEN** todos os rótulos do painel aparecem em português, sem chave crua na tela
