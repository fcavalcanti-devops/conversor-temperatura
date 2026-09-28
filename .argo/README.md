# Argo CD — deploy via PR (sem Image Updater)

Fluxo:

```text
1. Push/tag → GitHub Release publica imagem
      tags: <git-sha> + homolog|latest + semver (se v*)

2. Abrir PR no repo do Helm alterando application.image.tag
      homolog: tag = <git-sha>  (ou "homolog")
      prod:    tag = "1.0.1"    (apos git tag v1.0.1)

3. Merge do PR → Argo sync → cluster atualiza
```

Nada no cluster muda só porque o Hub ganhou tag nova: o **PR no Git** e o gatilho.

## Exemplo de mudanca no Helm

No chart (`values.yaml` / `values-homolog.yaml` / `values-prod.yaml`):

```yaml
application:
  image:
    name: felipecs8/conversor-temperatura
    tag: "760cdd55be69ec6dc3566371e3f56cee91b59cfc"  # github.sha do Release
```

Ou, em prod versionado:

```yaml
    tag: "1.0.1"
```

O sha e as tags do Release aparecem no **Job summary** do workflow Release.

## Applications

- `application-homolog.yaml` — aponta para o chart + `values-homolog.yaml`
- `application-prod.yaml` — chart + `values-prod.yaml`

Ajuste `repoURL`, `path` e `namespace` antes de aplicar.

```bash
kubectl apply -f .argo/application-homolog.yaml
kubectl apply -f .argo/application-prod.yaml
```

## Homolog mais automatico (opcional)

Se quiser menos PRs em homolog, use `tag: homolog` + `imagePullPolicy: Always` no values-homolog e force restart quando precisar — ou mantenha PR com o sha (recomendado, imutavel).
