#!/usr/bin/env bash
# Applies custom Grafana dashboard ConfigMaps to the monitoring namespace.
# Grafana's sidecar automatically picks up ConfigMaps with grafana_dashboard=1.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARDS_DIR="$SCRIPT_DIR/../helm/dashboards"

echo "Applying Grafana dashboard ConfigMaps..."

for json_file in "$DASHBOARDS_DIR"/*.json; do
  name=$(basename "$json_file" .json)
  cm_name="ticketplatform-dashboard-${name}"
  echo "  → $cm_name"

  kubectl create configmap "$cm_name" \
    --from-file="dashboard.json=$json_file" \
    --namespace monitoring \
    --dry-run=client -o yaml \
  | kubectl annotate --local -f - \
    "meta.helm.sh/release-name=kube-prometheus-stack" \
    "meta.helm.sh/release-namespace=monitoring" \
    --dry-run=client -o yaml \
  | kubectl label --local -f - \
    grafana_dashboard=1 \
    --dry-run=client -o yaml \
  | kubectl apply -f -
done

echo "Done. Grafana dashboards will load within ~30s."
