# 4. Host Deno Backend on EU-Based VPS

Date: 2026-06-15

## Status

Accepted

## Context

The GPX Swimrun Analyzer requires a Deno backend to proxy external
API requests (OpenStreetMap, Komoot) and manage API keys securely.
We need to decide where to host this backend.

Key constraints:

- **C1 (International users):** The service processes geographic
  data from European swimrun athletes and international users
  subject to GDPR-like regulations (CCPA in California, UK GDPR,
  LGPD in Brazil, APPI in Japan)
- **C2 (Location = personal data):** Geographic location data is
  personal data under GDPR when it reveals an individual's
  movements, training patterns, or home location
- **C3 (Operational control):** We want full control over the
  server environment (no vendor lock-in to proprietary edge
  runtimes)
- **C4 (Freemium scaling):** The project uses a freemium model;
  more users = more revenue, so hosting costs should scale with
  usage rather than be fixed overhead

## Quality Criteria

| Criterion | Weight | Constraint | Description |
|-----------|--------|------------|-------------|
| GDPR compliance | High | C1, C2 | Data must stay within EU jurisdiction; no transfers to US without adequate safeguards |
| Data sovereignty | High | C1, C2 | Server operator must be EU-based or offer EU-only data residency |
| Cost scalability | High | C4 | Usage-based billing preferred; costs should scale with revenue from freemium users |
| Operational control | Medium | C3 | SSH access, custom runtimes, own TLS certificates |
| Latency to EU users | Medium | C1 | <100ms round-trip for API proxy calls within Europe |
| Vendor independence | Medium | C3 | Standard Linux VPS; easy to migrate between providers |
| Uptime/reliability | Medium | — | 99.9% or better SLA |
| Maintenance burden | Low | — | Acceptable to manage OS updates and Deno installation manually |

## Options

### Option A: EU-based VPS provider (chosen)

Run Deno on a standard Linux VPS from an EU-headquartered provider
with EU-only data centres.

Candidate providers:

- **Hetzner** (Germany) — CX22: 2 vCPU, 4 GB RAM, 40 GB SSD, €4.35/month
- **Scaleway** (France) — DEV1-S: 2 vCPU, 2 GB RAM, 20 GB SSD, €4.56/month
- **OVHcloud** (France) — Starter: 1 vCPU, 2 GB RAM, 20 GB SSD, €3.50/month
- **TransIP/team.blue** (Netherlands) — VPS S: 1 vCPU, 1 GB RAM, 50 GB SSD, €6/month
- **Thalassa Cloud** (Netherlands) — dgp-small: 1 vCPU, 2 GB RAM, 1 Gbps VPC, €0.0072/hr (~€5.18/month); usage-based billing (https://thalassa.cloud/)

#### Pros

- Full GDPR compliance: data never leaves EU, provider subject to EU law
- Predictable base cost; can upgrade VPS tier as user base grows
  with freemium revenue
- Full SSH/root access, install any Deno version
- No proprietary runtime quirks
- Easy to add disk-based caching, SQLite, or other local storage
- Can run multiple services on same VPS (frontend, backend, monitoring)

#### Cons

- Manual server maintenance (OS updates, security patches, Deno upgrades)
- No auto-scaling; requires manual tier upgrade as user base grows
  (acceptable at early stage; can migrate to usage-based EU
  provider like Scaleway Serverless later)
- Requires own deployment pipeline (systemd + git pull, or Docker)
- Must manage TLS certificates (Let's Encrypt / Caddy)

### Option B: Deno Deploy (US-based, Deno Company)

Use Deno's managed edge platform.

#### Pros

- Zero ops: automatic deploys from GitHub
- Global edge network, low latency worldwide
- Generous free tier for low-traffic apps
- Built-in KV store for caching

#### Cons

- Deno Company is US-based (incorporated in Delaware)
- Data may traverse US infrastructure; EU data residency not
  guaranteed even with "EU region" selection
- No SSH access, limited runtime control
- Proprietary limitations (no npm packages requiring native
  binaries, no file system persistence)
- Vendor lock-in to Deno Deploy APIs (KV, BroadcastChannel)
- Free tier may change; no long-term pricing guarantee

### Option C: Large US cloud with EU region (AWS, GCP, Azure)

Use a US-headquartered hyperscaler with an EU data centre region.

#### Pros

- EU data centre available
- Rich managed services (load balancing, monitoring, databases)
- Auto-scaling if needed

#### Cons

- US-headquartered company; subject to US CLOUD Act (compelled
  disclosure regardless of data location)
- Complex GDPR compliance: requires DPA, SCCs, and ongoing
  monitoring of legal adequacy decisions
- Higher cost for comparable specs (minimum ~€15–30/month)
- Over-engineered for a single lightweight Deno process
- Vendor lock-in to cloud-specific services

## Decision

**Option A: EU-based VPS provider.**

We will host the Deno backend on a VPS from an EU-headquartered
provider (Hetzner, Scaleway, or OVHcloud) located in an EU data
centre.

Rationale:

1. **GDPR** — EU provider + EU data centre = no international data
   transfers, no CLOUD Act exposure, no need for SCCs or transfer
   impact assessments
2. **Cost** — €4–6/month is sufficient for a lightweight API proxy
   serving low concurrent traffic
3. **Control** — We can install Deno directly, use file-system
   caching (SQLite or flat files), and manage the full stack
4. **Simplicity** — A single VPS running Deno with systemd is the
   simplest production setup for this project's scale
5. **No lock-in** — Standard Linux; can migrate to any other EU VPS
   provider by copying files and DNS update

## Consequences

- Requirement 15 (Deno Backend) acceptance criterion 9 is updated:
  the backend SHALL NOT depend on Deno Deploy-specific APIs; it
  SHALL use standard Deno APIs and file-system or SQLite-based
  caching
- The backend SHALL be containerized (Docker) from the start to
  enable future migration to Kubernetes (with HPA) or EU-based
  FaaS (Scaleway Serverless, OVH Functions) for auto-scaling and
  scale-to-zero
- Initial deployment: Docker container on VPS with systemd or
  docker-compose
- Growth path: VPS → managed K8s cluster (Scaleway Kapsule,
  Hetzner K8s, OVH Managed Kubernetes) with Horizontal Pod
  Autoscaler, or EU-based FaaS for scale-to-zero
- TLS termination via Caddy or nginx reverse proxy with Let's
  Encrypt
- Server maintenance (OS patches, Deno updates) is a manual
  responsibility at VPS stage; reduced at K8s/FaaS stage
- ADR-0003 reference to "Deno Deploy free tier" is superseded by
  this decision for the backend hosting location
- CI/CD pipeline deploys to VPS via SSH (e.g. GitHub Actions with
  SSH deploy key); later via container registry + K8s rollout

## References

- European Commission. (2018). *General Data Protection Regulation (GDPR)*. https://gdpr.eu/
- Hetzner. (n.d.). *Cloud pricing*. https://www.hetzner.com/cloud/
- US Department of Justice. (2018). *CLOUD Act*. https://www.justice.gov/dag/cloudact
