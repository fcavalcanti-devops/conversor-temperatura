# Argo CD

Release publica a imagem e faz `sed` + push em `charts/conversor-temperatura/values.yaml` no `helm-charts`. Argo synca.

Secret no app: `HELM_CHARTS_TOKEN` (write no helm-charts).

Application: repo Helm, path `charts/conversor-temperatura`, `values.yaml`, sync automatico.
