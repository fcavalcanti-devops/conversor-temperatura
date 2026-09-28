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

**Deploy (Argo + Helm):** veja [`.argo/README.md`](.argo/README.md). Fluxo: Release publica a imagem → **PR no Helm** altera `application.image.tag` (sha ou semver) → merge → Argo sync. Sem Image Updater.

**Secrets necessários** (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`: usuário do Docker Hub
- `DOCKERHUB_TOKEN`: access token do Docker Hub com permissão de escrita

### Pipeline Jenkins
Configuração e execução da CI (testes, build e push da imagem Docker) em [JENKINS.md](JENKINS.md).
