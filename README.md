# Usage
App for make conversion wheater between Fahrenheit and Celsius

### Node
Requer **Node.js >= 20** (para o app e os testes com Vitest). Recomendado: 20 LTS ou 22 LTS.

### Build Container
```
docker build -t felipecs8/conversor-temperatura .
```
### Running
```
docker compose up -d
```

### Testes e lint
Na pasta `src`:
```bash
cd src
npm install
npm run lint
npm test
```
Detalhes em [TESTES.md](TESTES.md).

### Smoke (imagem Docker)
Depois de buildar a imagem:
```bash
bash scripts/smoke.sh felipecs8/conversor-temperatura:latest
```
Checa `/health` (app up), rotas de conversão, a página `/` e que o container não roda como root. Em falha, imprime `docker logs` na esteira/terminal.

### Esteira CI/CD (GitHub Actions)

| Gatilho | Workflow | O que acontece |
|---|---|---|
| Pull request para `main` ou `homolog` | `.github/workflows/ci.yaml` | Gitleaks, lint (ESLint), testes (Node 20 e 22), lint do Dockerfile, build **sem push**, smoke e scan Trivy |
| Push em `homolog` | `.github/workflows/release.yaml` | Testes, publicação (`homolog` + tag **git sha**), smoke e Trivy |
| Push em `main` | `.github/workflows/release.yaml` | Testes, publicação (`latest` + tag **git sha**), smoke e Trivy |
| Tag `v1.2.3` | `.github/workflows/release.yaml` | Testes, publicação (`1.2.3`, `1.2` + tag **git sha**), smoke e Trivy |

Os checks de qualidade rodam em `.github/workflows/test.yaml` (Gitleaks, lint, testes e audit), um workflow reutilizável chamado tanto pela CI quanto pelo release, então nada é publicado sem eles passarem.

Imagem: `felipecs8/conversor-temperatura` (multi-arch `linux/amd64` e `linux/arm64`, SBOM e proveniência).

**Tags publicadas**
- **Imutável:** `<git-sha>` (= `github.sha`) — use no Helm/Argo para deploy dinâmico
- **Atalhos:** `homolog` (branch homolog), `latest` (branch main)
- **Release:** `1.2.3`, `1.2` ao criar tag git `v1.2.3`

```bash
# Criar release versionada (na main atualizada)
git tag v1.0.1
git push origin v1.0.1
```

**Secrets necessários** (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`: usuário do Docker Hub
- `DOCKERHUB_TOKEN`: access token do Docker Hub com **Read/Write/Delete** (push + cleanup de tags)
- `HELM_CHARTS_TOKEN`: PAT com **Contents: write** em `fcavalcanti-devops/helm-charts`

Após cada Release, o job **Cleanup Docker Hub** chama a API do Hub e apaga tags **sha** antigas (mantém as 10 mais recentes; `latest`/`homolog`/semver não são sha e ficam).

### Deploy — dois modos (Helm / Argo)

Applications no repo [gitops](https://github.com/fcavalcanti-devops/gitops) (App of Apps). Charts no `helm-charts`.  
Release publica a imagem → atualiza a `tag` no chart → Argo sync.

| Modo | Chart | Recurso K8s | Uso |
|------|--------|-------------|-----|
| **Normal** | `charts/conversor-temperatura` | `Deployment` | Homolog / prod (padrão) |
| **Canary** | `charts/conversor-temperatura-canary` | `Rollout` (Argo Rollouts) | Lab / testes de canary |

#### Modo normal (Deployment)

Rolling update clássico do Kubernetes. Namespace típico: `conversor-homolog` / `conversor-prod`.

```bash
# via Argo (gitops) ou:
helm upgrade --install conversor ./charts/conversor-temperatura \
  -n conversor-homolog --create-namespace \
  --set application.image.tag=<sha>

kubectl get deploy,pods -n conversor-homolog
kubectl port-forward -n conversor-homolog svc/<release>-conversor-temperatura 8080:80
```

#### Modo canary (Argo Rollouts)

Sobe gradualmente: **50%** pods novos → **pause 60s** → **100%**.  
Namespace de teste: `conversor-canary`. Requer o controller Argo Rollouts:

```bash
kubectl apply --server-side --force-conflicts -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

```bash
helm upgrade --install conversor-canary ./charts/conversor-temperatura-canary \
  -n conversor-canary --create-namespace \
  --set application.image.tag=<sha>

kubectl get rollout -n conversor-canary -w
kubectl argo rollouts get rollout conversor-canary-conversor-temperatura -n conversor-canary -w
```

`kubectl port-forward` no Service costuma fixar em **um** pod; para ver mix de versões, use curl in-cluster ou forward por pod.  
Application de exemplo no gitops: `apps/conversor-temperatura-canary.yaml`.

### Pipeline Jenkins
Configuração e execução da CI (testes, build e push da imagem Docker) em [JENKINS.md](JENKINS.md).
