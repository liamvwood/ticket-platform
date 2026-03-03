# ── nginx Ingress Controller ───────────────────────────────────────────────────
resource "helm_release" "nginx_ingress" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = "4.10.1"
  namespace        = "ingress-nginx"
  create_namespace = true

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  # Provision an AWS NLB instead of a CLB
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "nlb"
  }

  # Snippet annotations are disabled — security headers are set in application code
  set {
    name  = "controller.allowSnippetAnnotations"
    value = "false"
  }

  set {
    name  = "controller.config.use-forwarded-headers"
    value = "true"
  }

  set {
    name  = "controller.config.compute-full-forwarded-for"
    value = "true"
  }

  depends_on = [module.eks]
}

# ── cert-manager + Let's Encrypt ClusterIssuer ────────────────────────────────
resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.14.4"
  namespace        = "cert-manager"
  create_namespace = true

  set {
    name  = "crds.enabled"
    value = "true"
  }

  depends_on = [helm_release.nginx_ingress]
}

resource "kubernetes_manifest" "letsencrypt_clusterissuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt-prod"
    }
    spec = {
      acme = {
        server = "https://acme-v02.api.letsencrypt.org/directory"
        email  = var.letsencrypt_email
        privateKeySecretRef = { name = "letsencrypt-prod" }
        solvers = [{
          http01 = {
            ingress = { ingressClassName = "nginx" }
          }
        }]
      }
    }
  }

  depends_on = [helm_release.cert_manager]
}

# ── kube-prometheus-stack (Prometheus + Grafana + alertmanager) ────────────────
resource "helm_release" "kube_prometheus_stack" {
  count = var.enable_monitoring ? 1 : 0

  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = "58.6.0"
  namespace        = "monitoring"
  create_namespace = true
  timeout          = 600

  values = [<<-YAML
    grafana:
      enabled: true
      ingress:
        enabled: ${var.grafana_domain != "" ? "true" : "false"}
        ingressClassName: nginx
        annotations:
          cert-manager.io/cluster-issuer: letsencrypt-prod
        hosts:
          ${var.grafana_domain != "" ? "- ${var.grafana_domain}" : "[]"}
        tls:
          ${var.grafana_domain != "" ? "- secretName: grafana-tls\n          hosts:\n            - ${var.grafana_domain}" : "[]"}
      sidecar:
        dashboards:
          enabled: true
          searchNamespace: ALL
          label: grafana_dashboard
          labelValue: "1"

    prometheus:
      prometheusSpec:
        # Discover ServiceMonitors in all namespaces
        serviceMonitorSelectorNilUsesHelmValues: false
        serviceMonitorNamespaceSelector: {}
        serviceMonitorSelector: {}
        podMonitorSelectorNilUsesHelmValues: false
        podMonitorNamespaceSelector: {}
        podMonitorSelector: {}
        retention: 15d
        storageSpec:
          volumeClaimTemplate:
            spec:
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 10Gi
  YAML
  ]

  depends_on = [helm_release.cert_manager]
}

# ── Kubernetes namespace for the application ───────────────────────────────────
resource "kubernetes_namespace" "app" {
  metadata {
    name = local.app_namespace
  }

  depends_on = [module.eks]
}

# ── ServiceAccount annotated for IRSA (S3 + SSM access from the API pod) ──────
resource "kubernetes_service_account" "api" {
  metadata {
    name      = "ticket-platform-api"
    namespace = kubernetes_namespace.app.metadata[0].name

    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.api_irsa.arn
    }
  }
}
