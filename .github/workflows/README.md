# Workflows do GitHub Actions

Este documento descreve a esteira de CI/CD do **Conversor de Temperatura**: quais workflows existem, quando cada um roda, o que cada job faz e como a imagem chega em homolog e produção.

---

## Visão geral

| Arquivo | Gatilho | Papel |
|---|---|---|
| `test.yaml` | `workflow_call` (reutilizável) | Checks de qualidade: Gitleaks, lint, testes e audit |
| `ci.yaml` | Pull request para `homolog` (branch default) ou `main` | Valida o PR: testes + build da imagem **sem push**, smoke e Trivy |
| `codeql.yaml` | Pull request para `homolog`/`main` e push nessas branches | Análise estática (SAST) do código JS e dos próprios workflows |
| `release.yaml` | Push em `homolog`/`main` e tag `v*` | Publica a imagem, promove para produção e atualiza o Helm (GitOps) |
| `release-please.yaml` | `workflow_run` depois de um Release em `homolog` com sucesso | Abre o PR de release e, no merge, cria a tag `v*` |

Arquivos relacionados fora desta pasta:

- `scripts/smoke.sh` — smoke test da imagem (usado pela CI e pelo release).
- `scripts/cleanup-dockerhub.sh` — remove tags sha antigas do Docker Hub.
- `.github/dependabot.yml` — atualização automática de dependências npm, actions e imagem base.
- `release-please-config.json` e `.release-please-manifest.json` — versão e changelog da tag de produção.

---

## Fluxo completo

```mermaid
flowchart TD
    PR[Pull request para homolog/main] --> CI[ci.yaml]
    PR --> CQ[codeql.yaml]
    CI --> T1[test.yaml]
    T1 --> B[build: hadolint, build local, smoke, Trivy]

    PUSH[Push em homolog/main] --> REL[release.yaml]
    PUSH -.->|push em homolog e main| CQ
    REL --> T2[test.yaml]
    T2 --> PUB[publish: candidata, smoke, Trivy, push multi-arch]
    PUB --> HH[update-helm: values-homolog.yaml]
    PUB --> CL[cleanup-hub]
    PUB --> RP[release-please.yaml]
    RP --> RPR[PR de release]
    RPR --> MERGE[Merge em homolog]
    MERGE --> REL
    RP --> TAG[Tag vX.Y.Z se o PR de release ja foi mergeado]

    TAG --> REL2[release.yaml]
    REL2 --> PRO[promote: adiciona X.Y.Z e X.Y ao digest do sha]
    PRO --> HP[update-helm: values-prod.yaml]

    HH --> ARGO[Argo CD sincroniza o cluster]
    HP --> ARGO
```

Resumo do ciclo de vida de uma mudança:

1. **PR** → `ci.yaml` e `codeql.yaml` validam a mudança. Nada é publicado.
2. **Merge em `homolog` (branch default) ou `main`** → `release.yaml` testa de novo, publica a imagem com a tag `<git-sha>` e atualiza `values-homolog.yaml` no repo `helm-charts`. O Argo faz o deploy em homolog. O push em `homolog` também move as tags `latest` e `homolog`.
3. **Release Please**, depois que o Release em `homolog` termina com sucesso, abre ou atualiza o PR de release. Produção não muda ainda.
4. **Merge do PR de release** → o push publica a imagem desse commit (ele altera `src/package.json`). Em seguida o Release Please cria a tag `vX.Y.Z`. O `release.yaml` **não rebuilda**: reaproveita a imagem `<git-sha>`, adiciona as tags de versão ao mesmo digest e atualiza `values-prod.yaml`. O Argo faz o deploy em produção.

---

## `test.yaml` — checks de qualidade (reutilizável)

Workflow chamado via `uses: ./.github/workflows/test.yaml` pela CI e pelo release. Assim, nenhuma imagem é publicada sem passar pelos mesmos checks do PR.

Os quatro jobs rodam **em paralelo**:

| Job | O que faz | Bloqueia? |
|---|---|---|
| **Gitleaks** | Procura segredos commitados em todo o histórico (`fetch-depth: 0`) | Sim |
| **Lint** | `npm ci` + `npm run lint` (ESLint) no Node 24 | Sim |
| **Testes (Node 22 / 24)** | `npm test` (Vitest) em matriz; publica o relatório JUnit como artifact `junit-node-<versão>` (7 dias) | Sim |
| **Auditoria de dependências** | `npm audit --audit-level=high` | Não (`continue-on-error`, só informativo) |

A matriz usa `fail-fast: false`: uma versão do Node falhando não cancela a outra, então dá para ver se o problema é específico de versão.

---

## `ci.yaml` — validação de pull request

**Gatilho:** pull request com destino `homolog` (branch default) ou `main`.
**Concorrência:** um novo push no mesmo PR cancela a execução anterior (`cancel-in-progress: true`).

```
test (test.yaml) ──► build
```

Job **Build da imagem** (só roda se `test` passar):

1. **Lint do Dockerfile** — Hadolint, falha a partir de `warning`.
2. **Build local** — `docker/build-push-action` com `push: false` e `load: true`, gerando `conversor-temperatura:ci-<sha>`. Usa cache do GitHub Actions (`type=gha`).
3. **Smoke test** — `scripts/smoke.sh` sobe o container e valida a aplicação (ver [Smoke test](#smoke-test)).
4. **Trivy (relatório)** — lista vulnerabilidades `CRITICAL` e `HIGH` com correção disponível, sem bloquear.
5. **Trivy (gate)** — **falha o PR** se houver vulnerabilidade `CRITICAL` com correção disponível.

Como não há push nem uso de secrets, a CI funciona também em PRs vindos de fork.

---

## `codeql.yaml` — análise estática

**Gatilhos:** pull request para `homolog`/`main` e push nessas duas branches. O push em `homolog` cobre a branch default.

Roda o CodeQL em matriz com duas linguagens:

- `javascript-typescript` — código da aplicação em `src/`.
- `actions` — os próprios workflows (injeção de expressão, permissões excessivas etc.).

Usa o conjunto de queries `security-extended`. A regra `actions/unpinned-tag` é excluída de propósito: as actions são referenciadas por tag (`@v7`), não por SHA, e o Dependabot mantém essas tags atualizadas.

Os resultados aparecem em **Security → Code scanning**.

---

## `release.yaml` — publicação e deploy

**Gatilhos:**

- Push em `homolog` ou `main`, **exceto** quando o commit altera apenas `**.md` ou `.k8s/**`.
- Push de tag `v*` (o filtro `paths-ignore` não se aplica a tags).

**Concorrência:** uma execução por ref, **sem cancelar** a que está em andamento — uma publicação nunca é interrompida no meio.

Variável global: `IMAGE_NAME=felipecs8/conversor-temperatura`.

### Quais jobs rodam em cada gatilho

| Job | Push em `homolog` | Push em `main` | Tag `vX.Y.Z` |
|---|---|---|---|
| `test` | ✅ | ✅ | — |
| `publish` | ✅ (tags `<sha>` + `latest` + `homolog`) | ✅ (só `<sha>`) | — |
| `promote` | — | — | ✅ |
| `update-helm` | ✅ → `values-homolog.yaml` | ✅ → `values-homolog.yaml` | ✅ → `values-prod.yaml` |
| `cleanup-hub` | ✅ | ✅ | — |

> Push em `homolog` ou `main` atualiza o ambiente de **homolog**. Produção só muda via tag `v*`. A tag `latest` só anda no push de `homolog`.

### Job `publish` — build e push da imagem

Roda só em push de branch, depois do `test`. Environment: `homolog`.

O princípio é: **nada vai para o Docker Hub antes de passar no smoke e no Trivy.**

1. **Docker metadata** — calcula as tags:
   - `<git-sha>` (sempre, formato longo — é a tag imutável usada no deploy);
   - `latest` e `homolog` (só no push da branch default `homolog`).
2. **Build da candidata (amd64)** — build local, sem push: `conversor-temperatura:candidate-<sha>`.
3. **Smoke test** na candidata.
4. **Trivy** — relatório de `CRITICAL`/`HIGH` e gate que falha em `CRITICAL` com correção.
5. **Build and push (multi-arch)** — só depois de tudo acima passar: build `linux/amd64` + `linux/arm64`, com **SBOM** e **provenance**, publicando as tags calculadas. O cache da candidata é reaproveitado, então o amd64 não é recompilado do zero.
6. **Job summary** — mostra digest, tag imutável e todas as tags publicadas.

### Job `promote` — promoção para produção

Roda só em push de tag. Environment: `production`.

Não faz build. Reaproveita a imagem `felipecs8/conversor-temperatura:<git-sha>` que o push em `homolog` ou `main` já testou e publicou para o **mesmo commit** da tag:

1. Calcula as tags semver a partir da tag git: `v1.2.3` → `1.2.3` e `1.2`.
2. Falha se a tag não for semver (`vX.Y.Z`).
3. Falha se a imagem `<git-sha>` não existir no Docker Hub (ver [Problemas comuns](#problemas-comuns)).
4. `docker buildx imagetools create` — adiciona as tags de versão ao manifest existente (cópia de manifest no registry, sem rebuild).
5. Confere que cada tag nova aponta para exatamente o mesmo digest da origem.
6. Job summary com origem, digest e tags.

Resultado: o que vai para produção é **byte a byte** a mesma imagem que rodou em homolog.

### Job `update-helm` — deploy via GitOps

Roda depois de `publish` **ou** `promote` (o que tiver rodado com sucesso). Environment: `production` para tag, `homolog` para branch.

1. Faz checkout do repo [`fcavalcanti-devops/helm-charts`](https://github.com/fcavalcanti-devops/helm-charts) com o `HELM_CHARTS_TOKEN`.
2. Define ambiente e tag:
   - branch → `values-homolog.yaml` com tag `<git-sha>`;
   - tag `v1.2.3` → `values-prod.yaml` com tag `1.2.3`.
3. Atualiza `.application.image.tag` com `yq` em `charts/conversor-temperatura/values-<env>.yaml`.
4. Commita como `github-actions[bot]` (`chore(<env>): update conversor-temperatura to <tag>`). Se a tag já for a mesma, não há commit e o job termina com sucesso.
5. Faz `git push` com até 3 tentativas, rodando `git pull --rebase` entre elas.

O job tem um grupo de concorrência **global** (`update-helm-conversor-temperatura`): pushes simultâneos em `main`, `homolog` e tags entram em fila, em vez de competir pelo mesmo repositório.

A partir daí, o Argo CD (Applications no repo `gitops`) detecta a mudança e sincroniza o cluster.

### Job `cleanup-hub` — limpeza do Docker Hub

Roda depois do `publish` (só em push de branch), com `continue-on-error: true`: falhar aqui não marca o release como falho.

Executa `scripts/cleanup-dockerhub.sh`, que:

1. Autentica na API do Docker Hub.
2. Lista as tags do repositório (primeira página, até 100), ordenadas por última atualização.
3. Filtra só tags no formato sha (40 caracteres hex) — `latest`, `homolog` e semver nunca são removidas.
4. Mantém as `KEEP=10` mais recentes e apaga o restante.

---

## Smoke test

`scripts/smoke.sh <imagem> [porta]` é usado na CI e no `publish`. Ele:

1. Sobe o container (nome `smoke`) na porta 8080.
2. Espera até 20 s o `/health` responder.
3. Valida `GET /celsius/0/fahrenheit` → `"fahrenheit":32`.
4. Valida `GET /fahrenheit/32/celsius` → `"celsius":0`.
5. Valida que `GET /` contém `Conversor de Temperatura`.
6. Falha se o container estiver rodando como **root**.

Em falha, imprime `docker logs` do container. O container é removido no final (via `trap`) e também pelo step `Remove container` do workflow.

Para rodar localmente:

```bash
docker build -t conversor-temperatura:local .
bash scripts/smoke.sh conversor-temperatura:local
```

---

## Tags da imagem

| Tag | Quando é criada | Uso |
|---|---|---|
| `<git-sha>` | Todo push em `homolog`/`main` | **Imutável.** Usada no Helm de homolog e como origem da promoção |
| `latest`, `homolog` | Push em `homolog` (branch default) | Atalhos móveis, não usar em deploy |
| `X.Y.Z`, `X.Y` | Tag git `vX.Y.Z` criada pelo Release Please | Produção (mesmo digest do `<git-sha>` do commit) |

---

## `release-please.yaml` — tag de produção

Roda quando o workflow **Release** termina com sucesso na branch `homolog`. O Release disparado pela própria tag não entra nesse gatilho.

Usa `googleapis/release-please-action` com o secret `RELEASE_PLEASE_TOKEN` (PAT fine-grained **deste** repositório, Contents e Pull requests write). O `GITHUB_TOKEN` não serve: pull request aberto por ele não dispara a CI, e a tag criada por ele não dispara o `promote`.

A configuração está em `release-please-config.json` e `.release-please-manifest.json`:

- Pacote Node em `src` (atualiza `src/package.json` e o lock). A versão atual registrada é `1.0.0`.
- Tag `vX.Y.Z`, sem prefixo do componente.
- Changelog em `src/CHANGELOG.md`. O caminho é relativo ao pacote. `../` é recusado pelo Release Please.
- `bootstrap-sha` no commit anterior a esta adoção. O histórico anterior não entra na primeira release.

Versão a partir da mensagem do commit:

| Commit | Incremento |
|---|---|
| `fix: ...` | patch (`1.0.1`) |
| `feat: ...` | minor (`1.1.0`) |
| `feat!: ...` ou rodapé `BREAKING CHANGE:` | major (`2.0.0`) |

Commit que não segue esse formato não abre release. O commit do release altera `src/package.json` de propósito: o `paths-ignore` do `release.yaml` ignora `**.md`, então um commit só de changelog não publicaria a imagem que a tag precisa. Um commit que não dispara o `release.yaml` (só `.md` ou `.k8s`) entra no PR de release na próxima publicação.

## Como fazer uma release para produção

1. Mergeie em `homolog` com commit convencional e espere o Release publicar a imagem. Confira o ambiente de homolog.
2. O Release Please abre ou atualiza o pull request de release (versão e changelog).
3. Mergeie esse pull request quando homolog estiver validado. O merge publica a imagem do commit de release e, ao terminar, cria a tag `vX.Y.Z` e o GitHub Release.
4. Se o environment `production` tiver aprovação obrigatória, aprove em **Actions → execução do Release** disparada pela tag.

Um `git tag vX.Y.Z` seguido de `git push origin vX.Y.Z`, no commit que o push em `homolog` ou `main` já publicou, continua promovendo a mesma imagem. O caminho normal é o pull request do Release Please.

---

## Environments, permissões e secrets

**Environments** (Settings → Environments):

| Environment | Jobs |
|---|---|
| `homolog` | `publish`, `update-helm` (push de branch) |
| `production` | `promote`, `update-helm` (tag) |

Proteções como required reviewers ou restrição de branches/tags são configuradas no próprio environment.

**Permissões:** todos os workflows usam `contents: read` por padrão. Só o `codeql.yaml` recebe `security-events: write`, para enviar os resultados ao Code scanning. A escrita no repo `helm-charts` usa um token próprio, não o `GITHUB_TOKEN`.

**Secrets:**

| Secret | Usado por | Permissão necessária |
|---|---|---|
| `DOCKERHUB_USERNAME` | `publish`, `promote`, `cleanup-hub` | — |
| `DOCKERHUB_TOKEN` | `publish`, `promote`, `cleanup-hub` | Access token com **Read, Write, Delete** (o delete é para o cleanup) |
| `HELM_CHARTS_TOKEN` | `update-helm` | PAT com **Contents: write** em `fcavalcanti-devops/helm-charts` |
| `RELEASE_PLEASE_TOKEN` | `release-please` | PAT fine-grained **deste** repositório, Contents e Pull requests write. A identidade do token precisa poder abrir PR em `homolog` e criar tag `v*` |

A CI de PR não usa nenhum secret.

---

## Dependabot

Configurado em `.github/dependabot.yml`, roda semanalmente:

- **npm** (`/src`) — segunda às 09:00 (America/Sao_Paulo), minor e patch agrupados num único PR, com cooldown de 7 dias para releases recém-publicadas. Majors continuam sendo propostas.
- **GitHub Actions** — todas as actions agrupadas num único PR.
- **Docker** (imagem base) — ignora majors, para não sair da LTS do Node escolhida.

Os PRs do Dependabot abrem contra `homolog` (`target-branch`) e passam pela mesma `ci.yaml` e `codeql.yaml` de qualquer PR.

---

## Problemas comuns

**`promote` falha com "A imagem ... nao existe no Docker Hub"**
A tag foi criada num commit que não gerou imagem. Causas possíveis:
- o commit só alterou `.md` ou `.k8s/` (o `paths-ignore` não dispara o release);
- o commit não passou por um push em `homolog` ou `main`, ou o release desse push ainda não terminou;
- a tag sha já foi removida pelo `cleanup-hub` (mais de 10 publicações depois).

Solução: a tag tem que estar num commit que o push em `homolog` ou `main` já publicou. No fluxo normal, isso é o commit do pull request de release.

**Release Please falha pedindo `RELEASE_PLEASE_TOKEN`**
O secret ainda não existe, ou está vazio. Crie o PAT fine-grained e grave em Settings → Secrets and variables → Actions.

**O pull request de release não aparece**
Não houve commit `feat`, `fix` ou `BREAKING CHANGE` depois do `bootstrap-sha`. Um `chore` ou um merge sem corpo convencional não abre release.

**`promote` falha com "nao e semver"**
A tag precisa seguir `vX.Y.Z` (ex.: `v1.2.3`).

**CI falha no "Fail on critical vulnerabilities"**
O Trivy encontrou CVE `CRITICAL` com correção disponível. Normalmente se resolve atualizando a imagem base (`node:*-alpine`) ou a dependência npm apontada no relatório do step anterior.

**`update-helm` falha no push**
Depois de 3 tentativas com `git pull --rebase`, o job falha. Verifique se o `HELM_CHARTS_TOKEN` não expirou e se ainda tem permissão de escrita no `helm-charts`.
