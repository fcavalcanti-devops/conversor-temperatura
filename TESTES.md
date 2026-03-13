# Documentação dos Testes

Este documento descreve a suíte de testes do **Conversor de Temperatura**: o que é testado, como executar e qual a estrutura dos arquivos.

---

## Como executar

Na pasta `src`:

```bash
cd src
npm install
npm test
```

- **`npm test`** — executa toda a suíte uma vez ([Vitest](https://vitest.dev/) em modo run).
- **`npm run test:watch`** — executa os testes em modo watch (re-executa ao salvar arquivos).

Os testes ficam em `test/**/*.js`, conforme configurado em `vitest.config.js`.

---

## Stack de testes

| Ferramenta    | Uso                                                |
|---------------|----------------------------------------------------|
| **Vitest**    | Runner de testes (describe / it / expect), rápido e com API estilo Jest |
| **Supertest** | Testes HTTP (requisições ao Express)               |

Vitest oferece asserções built-in (`expect`), suporte a async/await e modo watch nativo.

---

## Estrutura dos arquivos de teste

```
src/
  vitest.config.js  # Configuração do Vitest (globals, environment, include)
  test/
    convert.js      # Testes unitários do módulo de conversão
    server.js       # Testes de integração da API e rotas HTTP
  convert.js        # Módulo testado por convert.js
  server.js         # App Express testado por server.js
```

---

## 1. Testes unitários — `test/convert.js`

Testam o módulo **convert** (`convert.js`), que expõe as funções de conversão de temperatura.

### 1.1 `fahrenheitCelsius(valor)`

Converte graus Fahrenheit → Celsius.

| Caso de teste | Entrada | Resultado esperado |
|---------------|---------|--------------------|
| Valor comum   | 131°F   | 55°C               |
| Ponto de fusão da água | 32°F | 0°C          |
| Ponto de igualdade das escalas | -40°F | -40°C   |
| Ponto de ebulição da água | 212°F | 100°C      |
| Valor decimal | 98.6°F | ~37°C (tolerância 0,01) |

### 1.2 `celsiusFahrenheit(valor)`

Converte graus Celsius → Fahrenheit.

| Caso de teste | Entrada | Resultado esperado |
|---------------|---------|--------------------|
| Valor comum   | 55°C    | 131°F              |
| Ponto de fusão da água | 0°C  | 32°F          |
| Ponto de igualdade das escalas | -40°C | -40°F   |
| Ponto de ebulição da água | 100°C | 212°F      |
| Valor decimal | 37°C  | ~98.6°F (tolerância 0,01) |

---

## 2. Testes de API — `test/server.js`

Testam o aplicativo Express (**server.js**) com [Supertest](https://github.com/visionmedia/supertest). As requisições são feitas **in-process** (o objeto `app` é passado ao Supertest); nenhuma porta é aberta nem servidor sobe. Isso mantém os testes rápidos e suficientes para validar rotas, respostas e health.

### 2.1 GET `/fahrenheit/:valor/celsius`

- **Objetivo:** Conferir conversão F → C pela API.
- **Testes:**
  - `GET /fahrenheit/131/celsius` → status 200, corpo com `celsius: 55` e `maquina`.
  - `GET /fahrenheit/32/celsius` → status 200, corpo com `celsius: 0`.

### 2.2 GET `/celsius/:valor/fahrenheit`

- **Objetivo:** Conferir conversão C → F pela API.
- **Testes:**
  - `GET /celsius/55/fahrenheit` → status 200, corpo com `fahrenheit: 131` e `maquina`.
  - `GET /celsius/0/fahrenheit` → status 200, corpo com `fahrenheit: 32`.

### 2.3 GET `/`

- **Objetivo:** Página inicial.
- **Teste:** status 200 e `Content-Type` contendo `html`.

### 2.4 POST `/`

- **Objetivo:** Formulário de conversão (envio de temperatura e tipo).
- **Testes:**
  - POST com `valorRef: 100`, `selectTemp: 1` (C → F) → status 200, resposta HTML.
  - POST com `valorRef: 212`, `selectTemp: 2` (F → C) → status 200, resposta HTML.

### 2.5 Rotas de health

- **GET /health:** status 200 e corpo `"OK"`.
- **GET /ready:** status 200 ou 500 (depende do estado interno de readiness).

---

## Resumo da cobertura

| Área              | Arquivo     | Tipo        | O que é validado                          |
|-------------------|------------|-------------|-------------------------------------------|
| Conversão F→C     | convert.js | Unitário    | Valores inteiros, decimais e pontos fixos |
| Conversão C→F     | convert.js | Unitário    | Valores inteiros, decimais e pontos fixos |
| API REST          | server.js  | Integração  | GET de conversão e resposta JSON          |
| Interface web     | server.js  | Integração  | GET e POST da página principal            |
| Health / Ready    | server.js  | Integração  | Resposta das rotas de probe               |

---

## Notas

- Os testes de conversão com decimais usam `expect(...).toBeCloseTo(valor, numDigitos)` (API Vitest/Jest) para evitar falhas por arredondamento.
- Os testes de API usam **async/await** com Supertest, sem callbacks `done`.
- O `server.js` exporta o `app` e só chama `app.listen()` quando executado diretamente, permitindo que os testes usem o mesmo app sem subir a porta 8080.
- Não há testes que subam o servidor em uma porta real: a suíte usa apenas testes in-process, que cobrem o comportamento das rotas sem essa complexidade.
