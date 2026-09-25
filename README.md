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
