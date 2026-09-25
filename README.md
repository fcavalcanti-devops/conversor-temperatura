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

### Testes
Rodar os testes (a partir da pasta `src`):
```bash
cd src
npm install
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
| Pull request para `main` ou `homolog` | `.github/workflows/ci.yaml` | Testes (Node 20 e 22), lint do Dockerfile, build da imagem **sem push**, smoke (`/health` + API + view) e scan Trivy |
| Push em `homolog` | `.github/workflows/release.yaml` | Testes e publicação das tags `homolog` e `sha-<commit>` |
| Push em `main` | `.github/workflows/release.yaml` | Testes e publicação das tags `latest`, `main` e `sha-<commit>` |
| Tag `v1.2.3` | `.github/workflows/release.yaml` | Testes e publicação das tags `1.2.3`, `1.2` e `latest` |

Os testes rodam em `.github/workflows/test.yaml`, um workflow reutilizável chamado tanto pela CI quanto pelo release, então nada é publicado sem os testes passarem.

Imagem publicada: `felipecs8/conversor-temperatura` (multi-arquitetura `linux/amd64` e `linux/arm64`, com SBOM e proveniência).

Prefira sempre a tag imutável `sha-<commit>` nos manifests de deploy.

**Secrets necessários** (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`: usuário do Docker Hub
- `DOCKERHUB_TOKEN`: access token do Docker Hub com permissão de escrita

### Pipeline Jenkins
Configuração e execução da CI (testes, build e push da imagem Docker) em [JENKINS.md](JENKINS.md).
