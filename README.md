


Austin Local Ticketing Platform – Design Document (MVP → Scalable)







1. Vision





Build a low-fee, high-reliability ticketing platform for local venues in Austin, TX that:



Competes with Ticketmaster and StubHub on fees and reliability
Handles high-traffic ticket drops without crashing
Prevents scalping
Feels polished (wallet integration, QR validation)
Is built using AI-assisted development with iterative UI refinement




Initial market: local Austin venues









2. Core Principles





Drop-Ready Reliability
System must not crash during ticket launches.
Low Fees
Transparent pricing model for venues and customers.
Scalability from Day 1
Kubernetes-native architecture.
AI-Accelerated Development
Use Copilot CLI + screenshot feedback loops to iterate quickly.
Operational Excellence
CI/CD, telemetry, logging, pre-prod at scale.










3. High-Level Architecture







Cloud Provider





Azure preferred (experience advantage), but cloud-agnostic
Kubernetes-based deployment






Core Services







1. API Service





.NET 10 Web API
Runs in small Linux container
Stateless
Horizontally scalable




Responsibilities:



Event management
Ticket inventory
Order creation
Payment orchestration
QR token generation
Auth (users + venues)










2. Background Workers



Separate containerized services draining queues.



Examples:



Order finalization
Payment confirmation reconciliation
Email delivery
Wallet pass generation
Anti-scalping validation checks
Fraud detection










3. Queue System



Behind API layer.



Options:



Azure Service Bus
Kafka
RabbitMQ




Used for:



Purchase events
Payment processing workflows
Notification fan-out
Audit logging










4. Database



Relational DB (strong consistency required)



Entities:



Users
Venues
Events
TicketTypes
Tickets (unique ID, status)
Orders
Payments
CheckIns




Constraints:



Strict transactional integrity on ticket inventory
Prevent overselling
Optimistic concurrency or row-level locking










4. Frontend







Customer Website





Browse events
Purchase tickets
View tickets
Add to wallet
Account management






Venue Portal





Create/manage events
View sales metrics
Download reports
Access QR scanner interface






Ticket Validation App (Web-Based)





Mobile-friendly
Camera-based QR scanner
Real-time validation API
Instant status: Valid / Duplicate / Invalid / Refunded










5. Anti-Scalping Measures





MVP Options:



Phone number verification (OTP)
Limit tickets per account
Rate limiting per IP
CAPTCHA during drop
Identity binding per ticket
QR codes rotating / short-lived validation tokens
Delayed ticket transferability




Future:



ML anomaly detection
Purchase pattern analysis










6. Digital Wallet Integration





Support:



Apple Wallet
Google Wallet




Each ticket:



Unique signed pass
QR embedded
Dynamic updates possible (event changes)




This increases legitimacy + UX polish.









7. Reliability & Scaling Strategy







Ticket Drop Design





Problem: crashes during high-demand releases.



Solution:



Pre-scale API replicas before drop
Load test pre-production at near-production scale
Use queue buffering to protect DB
Strict concurrency control on ticket inventory
Graceful “waiting room” or virtual queue




Optional:



Token-based drop access
Randomized queue ordering










8. Environments







Local





Docker Compose
Local DB
Local queue
Seeded test data
Script to simulate drop traffic






Pre-Production (Full-Scale Simulation)





Mirrors production infra
Scaled replicas
Synthetic traffic generator
End-to-end automated tests




Purpose:



Validate high-load behavior
Validate migrations
Validate wallet generation
Validate QR scanning workflow






Production





Blue/Green or Canary deploys
Gradual traffic shift
Rollback automation










9. CI/CD





Pipeline Requirements:



Linting
Unit tests
Integration tests
Container build
Image scanning
Deploy to:
Dev
Pre-prod
Prod (manual approval)





Deployment:



Helm or Kustomize
GitOps preferred










10. Observability Stack





Kubernetes-native telemetry:



Prometheus (metrics)
Grafana (dashboards)
Loki (logs)
Promtail (log shipping)
OpenTelemetry (traces)




Track:



API latency
Ticket purchase success rate
Drop-time error rate
DB contention
Queue lag
QR validation latency




Alerting:



Slack/Email alerts on drop degradation










11. Payment Integration





Requirements:



PCI-compliant provider (e.g., Stripe)
Idempotent order processing
Webhook validation
Delayed capture option
Refund capability
Venue payout system




Flow:



Create pending order
Lock inventory
Redirect to payment
Confirm via webhook
Finalize ticket issuance
Release lock if payment fails










12. Security





JWT-based authentication
Role-based access (User, VenueAdmin, Scanner)
Signed QR payloads
Short-lived validation tokens
Rate limiting middleware
WAF at ingress










13. AI-Assisted Development Loop





Goal: minimize manual effort.



Workflow:



Run full stack locally
Capture screenshots of UI
Feed screenshots + reference examples
Use Copilot CLI to:
Refactor layout
Improve UX
Generate components

Run visual diff checks
Repeat




UI References:



Ticketmaster
StubHub
Eventbrite
Apple Wallet pass visuals
Airline boarding pass flows




Focus:



Clean checkout flow
Minimal friction
Clear pricing transparency










14. MVP Scope (First 90 Days)





Phase 1:



Single-venue support
Single-event type
Basic purchase + QR
Stripe integration
Basic wallet pass
Scanner web app
Manual payouts




Phase 2:



Multi-venue
Drop optimization
Pre-prod scale testing
Full observability
Anti-scalping improvements










15. Differentiation Strategy





You win by:



Not crashing during drops
Transparent fees
Faster QR validation
Better venue analytics
Austin-first branding
Direct venue relationships










16. Immediate Next Steps





Scaffold:
.NET API
Dockerfile
Helm chart

Define DB schema
Implement:
Event → TicketType → Ticket model

Implement:
Purchase flow with inventory locking

Add Stripe
Deploy to local k8s (kind or minikube)
Set up Prometheus + Grafana + Loki




