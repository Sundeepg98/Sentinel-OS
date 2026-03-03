---
label: Infra Security & Identity
type: playbook
icon: ShieldCheck
---

## Q: Mutual TLS (mTLS) Implementation
How do you enforce service-to-service authentication in a zero-trust Kubernetes environment without hardcoding credentials in every pod?

### The Trap Response
"I will store API keys in Kubernetes Secrets and mount them as environment variables in each service."

### Why it fails
Static secrets are easily leaked and hard to rotate. Environment variables are visible to anyone with access to the pod's metadata. This approach does not provide true "identity-based" security or encryption-in-transit by default.

### Optimal Staff Response
I would implement a **Service Mesh** (like Linkerd or Istio). The mesh automatically issues short-lived, cryptographically signed X.509 certificates to each pod via a sidecar proxy (Envoy). These sidecars perform **mutual TLS (mTLS)** handshakes for every internal request, ensuring both identity verification and wire encryption without the application code ever seeing a secret key.

---

## Q: Secret Management & IaC
How do you safely manage database passwords in a Pulumi stack that is version-controlled in a public or shared GitHub repo?

### The Trap Response
"I will put the password in a `config.yaml` file and add that file to `.gitignore`."

### Why it fails
If another developer clones the repo, the infrastructure won't build because the config is missing. If you accidentally commit it once, it's in the Git history forever. It makes CI/CD automation impossible without manual file injection.

### Optimal Staff Response
I use **Pulumi Secrets** with a specialized KMS provider (AWS KMS or HashiCorp Vault). I run `pulumi config set --secret password <value>`, which encrypts the value using a master key before saving it to the stack file. The resulting ciphertext is safe to commit. During `pulumi up`, the provider dynamically decrypts the value in memory, ensuring secrets never touch the disk in plain text.
