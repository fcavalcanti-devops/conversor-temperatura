# Usage
App for make conversion wheater between Fahrenheit and Celsius

### Node
Requer **Node.js >= 18** (para rodar o app e os testes com Vitest). Recomendado: 18 LTS ou 20 LTS.

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
