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
| Push em `homolog` | `.github/workflows/release.yaml` | Testes, publicação (`homolog`), smoke da imagem publicada e Trivy |
| Push em `main` | `.github/workflows/release.yaml` | Testes, publicação (`latest`), smoke da imagem publicada e Trivy |
| Tag `v1.2.3` | `.github/workflows/release.yaml` | Testes, publicação (`1.2.3`, `1.2`, `latest`), smoke da imagem publicada e Trivy |

Os checks de qualidade rodam em `.github/workflows/test.yaml` (Gitleaks, lint, testes e audit), um workflow reutilizável chamado tanto pela CI quanto pelo release, então nada é publicado sem eles passarem.

Imagem publicada: `felipecs8/conversor-temperatura` (multi-arquitetura `linux/amd64` e `linux/arm64`, com SBOM e proveniência). Tags estáveis (`homolog`, `latest`, semver) são sobrescritas a cada release — o Hub não acumula `sha-*` nem tag `main`.

Para deploy: use `homolog` / `latest` no dia a dia; para versão imutável, fixe o **digest** do job summary do Release (`felipecs8/conversor-temperatura@sha256:...`).

**Secrets necessários** (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`: usuário do Docker Hub
- `DOCKERHUB_TOKEN`: access token do Docker Hub com permissão de escrita

### Deploy (Argo CD + Argo Rollouts)

O chart Helm usa **Argo Rollouts** (`kind: Rollout`) com estratégia **canary**, não um `Deployment` comum.

Fluxo:

```text
Release publica a imagem → tag no helm-charts → Argo CD sync
        → Rollout: 50% pods novos → pause 60s → 100%
```

**Pré-requisito no cluster:** controller Argo Rollouts instalado (`argo-rollouts`). Se o `kubectl apply` do install falhar por annotation grande nos CRDs:

```bash
kubectl apply --server-side --force-conflicts -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

**Acompanhar um deploy (homolog):**

```bash
kubectl get rollout -n conversor-homolog -w
# com o plugin:
kubectl argo rollouts get rollout conversor-temperatura-homolog-conversor-temperatura \
  -n conversor-homolog -w
```

**Steps padrão** (ajustáveis em `application.canary.steps` no chart): `setWeight: 50` → `pause: 60s` → `setWeight: 100`. Use **2+ replicas** para o canary fazer sentido.

**Migração:** se ainda existir um `Deployment` antigo do conversor no namespace, apague-o após o sync do Rollout para evitar conflito.

Chart: repo `helm-charts` → `charts/conversor-temperatura` (`templates/rollout.yaml`).

### Pipeline Jenkins
Configuração e execução da CI (testes, build e push da imagem Docker) em [JENKINS.md](JENKINS.md).
