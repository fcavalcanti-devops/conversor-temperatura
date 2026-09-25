# Pipeline Jenkins

Este documento descreve como configurar e executar a pipeline CI do projeto no Jenkins.

---

## Visão geral

A pipeline executa em sequência:

| Estágio           | O que faz                                                                 | Agente        |
|-------------------|---------------------------------------------------------------------------|---------------|
| **Test**          | Roda em container `node:20`: instala dependências e executa `npm test`   | Docker (node:20) |
| **Build Docker**  | Constrói a imagem Docker do app (`docker build`)                          | Qualquer (com Docker) |
| **Push to Docker Hub** | Faz login, taga a imagem e envia para o Docker Hub                 | Qualquer (com Docker) |

O estágio **Test** garante que só se segue para build e push se os testes passarem.

---

## Pré-requisitos no Jenkins

### 1. Credenciais do Docker Hub

- No Jenkins: **Manage Jenkins** → **Credentials** → **Add Credentials**.
- Tipo: **Username with password**.
- **ID**: `dockerhub-credentials` (deve ser exatamente este, usado no Jenkinsfile).
- Username e password da conta Docker Hub.

### 2. Agente(s) com Docker

- Os estágios **Build Docker** e **Push to Docker Hub** usam `agent any`, então pelo menos um agente deve ter:
  - **Docker** instalado e o usuário do Jenkins com permissão para usar Docker (`docker build`, `docker push`).
- O estágio **Test** usa `agent { docker { image 'node:20' } }`, então o agente precisa conseguir rodar containers Docker (Docker-in-Docker ou Docker socket montado).

### 3. Plugins

- **Pipeline** (Pipeline plugin).
- **Docker Pipeline** (para `agent { docker { image 'node:20' } }`).
- Se for usar **Multibranch Pipeline**: **Branch API** / **Multibranch Pipeline**.

---

## Como criar o job

### Opção A: Pipeline (job único)

1. **New Item** → nome do job → **Pipeline** → OK.
2. Em **Pipeline**:
   - **Definition**: *Pipeline script from SCM*.
   - **SCM**: Git.
   - **Repository URL**: URL do repositório (ex.: `https://github.com/KubeDev/conversao-temperatura.git`).
   - **Credentials**: se o repositório for privado.
   - **Branch**: `*/main`, `*/master` ou `*/homolog`, conforme seu fluxo.
3. **Script Path**: `Jenkinsfile` (padrão, na raiz do repositório).
4. Salvar.

Cada **Build Now** dispara uma execução da pipeline para a branch configurada.

### Opção B: Multibranch Pipeline

1. **New Item** → nome do job → **Multibranch Pipeline** → OK.
2. Em **Branch Sources**:
   - Adicionar fonte (Git, GitHub, etc.).
   - Informar URL do repositório e credenciais, se necessário.
3. **Build Configuration**:
   - **Mode**: *by Jenkinsfile*.
   - **Script Path**: `Jenkinsfile`.
4. Opcional: em **Discover branches** / **Discover pull requests** ajustar quais branches e PRs disparam build.
5. Salvar.

O Jenkins varre as branches, descobre o `Jenkinsfile` e cria um sub-job por branch. Cada push (e, se configurado, cada PR) pode disparar uma execução.

---

## Execução

- **Disparo**: manual (**Build Now**) ou por webhook (push no Git/GitHub apontando para o job).
- **Ordem**: Checkout (implícito pelo SCM) → **Test** → **Build Docker** → **Push to Docker Hub**.
- Se **Test** falhar, os estágios seguintes não rodam.
- Ao final, a imagem estará no Docker Hub como `SEU_USUARIO/jenkins-pipeline-test:latest` (ou o nome configurado no Jenkinsfile).

---

## Resumo rápido

| Item              | Valor / Observação                                      |
|-------------------|---------------------------------------------------------|
| Arquivo da pipeline | `Jenkinsfile` (raiz do repositório)                  |
| Credenciais ID    | `dockerhub-credentials`                                 |
| Imagem de teste   | `node:20` (container efêmero)                          |
| Imagem gerada     | `app:latest` (local); push como `USER/jenkins-pipeline-test:latest` |

Para rodar a aplicação a partir da imagem construída, use a imagem do Docker Hub no seu ambiente (Kubernetes, `docker run`, etc.).
