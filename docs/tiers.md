# How the tiers are set

Each question belongs to a topic. A topic's tier comes from how often it appears in job ads.

- Source: 537 QA job ads from Polish job boards, scanned between 2026-11-03 and 2026-11-23, deduplicated by company and title. A topic counts when the ad text matches one of its keyword patterns.
- **Core**: the topic appears in 30% or more of those ads, or it is set to Core by hand (marked below). Only the first 5 Core questions of each topic in each file stay Core; the rest are Standard.
- **Standard**: 10% to 30%.
- **Niche**: under 10%.

Ad share is a rough signal of what gets asked, not a measure of it.

| Topic | Share of ads | Tier | Set by hand |
|---|---|---|---|
| Web application testing (`web-testing`) | 96.3% | Core |  |
| Stakeholders and communication (`stakeholders`) | 91.4% | Core |  |
| Test automation in general (`fw-automation`) | 72.1% | Core | yes |
| Analytical thinking, independence, problem solving (`soft-skills`) | 70.8% | Core |  |
| Requirements analysis (`requirements`) | 70.6% | Core |  |
| REST and HTTP (`api-rest`) | 70.4% | Core | yes |
| Defects and root cause (`test-bugs`) | 62.4% | Core |  |
| Test levels and types (`test-levels`) | 58.8% | Core |  |
| CI/CD (`ci-cd`) | 50.5% | Core | yes |
| Test design techniques (`test-design`) | 48.2% | Core |  |
| Jira, Xray, TestRail, Zephyr (`test-mgmt-tools`) | 46.6% | Core |  |
| Agile, Scrum, Kanban (`agile`) | 44.9% | Core | yes |
| SQL (`sql-core`) | 43.4% | Core | yes |
| Leading and mentoring (`lead-mentor`) | 42.6% | Core |  |
| Postman and API tools (`api-tools`) | 40.2% | Core |  |
| Java, C# and other languages (`java-dotnet`) | 38.0% | Core |  |
| Linux, logs, monitoring (`linux-observability`) | 35.8% | Core |  |
| AI coding tools (`ai-tools`) | 35.0% | Core | yes |
| Test strategy and planning (`test-strategy`) | 33.7% | Core | yes |
| ISTQB and terminology (`istqb`) | 33.5% | Core |  |
| Performance and load testing (`performance`) | 32.8% | Core |  |
| Manual and exploratory testing (`test-manual`) | 31.8% | Core |  |
| Playwright overall (`pw-general`) | 31.5% | Core | yes |
| Selenium, Cypress, WebdriverIO (`tools-other-e2e`) | 31.1% | Core |  |
| Integrations and webhooks (`api-integration`) | 30.9% | Core |  |
| AWS and cloud (`cloud-aws`) | 28.7% | Standard |  |
| Release management and go/no-go (`release`) | 28.5% | Standard |  |
| Quality metrics and KPIs (`metrics`) | 28.5% | Standard |  |
| Framework design (`fw-architecture`) | 28.3% | Core | yes |
| Security testing (`security`) | 27.0% | Standard |  |
| Documentation (`docs`) | 25.9% | Standard |  |
| Mobile testing (`mobile-general`) | 25.5% | Standard |  |
| Python (`python`) | 24.8% | Standard |  |
| Risk-based testing (`test-risk`) | 22.5% | Standard |  |
| Git workflows (`git`) | 21.0% | Standard |  |
| Test data management (`fw-test-data`) | 20.1% | Core | yes |
| React and frontend basics (`react-frontend`) | 19.2% | Standard |  |
| Jenkins (`ci-jenkins`) | 18.8% | Standard |  |
| UAT (`test-uat`) | 17.7% | Standard |  |
| Azure DevOps and Azure (`ci-azure`) | 16.0% | Standard |  |
| Docker and Kubernetes (`docker-k8s`) | 14.5% | Standard |  |
| GitLab CI (`ci-gitlab`) | 13.8% | Standard |  |
| TypeScript (`ts-core`) | 13.4% | Core | yes |
| OOP, SOLID, design patterns, clean code (`oop-patterns`) | 13.0% | Standard |  |
| JavaScript (`js-core`) | 12.8% | Core | yes |
| Data pipelines, ETL, warehouses (`data-testing`) | 12.7% | Standard |  |
| GitHub Actions (`ci-github`) | 11.2% | Standard |  |
| Shift left and quality culture (`shift-left`) | 10.8% | Standard |  |
| BDD, TDD, Gherkin (`bdd`) | 10.4% | Standard |  |
| Testing AI and LLM systems (`ai-testing`) | 9.5% | Niche |  |
| Kafka and message queues (`messaging`) | 8.8% | Niche |  |
| Jest, Vitest, Mocha and unit tests (`unit-frameworks`) | 8.6% | Niche |  |
| Microservices (`microservices`) | 8.6% | Niche |  |
| SOAP, gRPC (`api-soap`) | 7.4% | Niche |  |
| OAuth, JWT, sessions (`api-auth`) | 6.9% | Niche |  |
| Prompting and MCP (`ai-prompting`) | 6.7% | Niche |  |
| Async, Promises, event loop (`js-async`) | 6.5% | Core | yes |
| Appium, Detox, Maestro (`mobile-appium`) | 6.3% | Niche |  |
| Cross-browser and device emulation (`pw-browsers`) | 5.4% | Core | yes |
| Flaky tests (`fw-flaky`) | 5.4% | Core | yes |
| Contract testing (`api-contract`) | 4.7% | Niche |  |
| NoSQL (`db-nosql`) | 4.5% | Niche |  |
| Reporters (`pw-reporting`) | 3.9% | Core | yes |
| Accessibility (`a11y`) | 3.7% | Niche |  |
| SaaS and multi-tenant (`multitenant-saas`) | 3.5% | Niche |  |
| WebSockets and realtime (`pw-websockets`) | 3.4% | Core | yes |
| Workers, parallelism and sharding (`pw-parallel`) | 3.4% | Core | yes |
| CloudWatch, New Relic, AppConfig (`ops-monitoring`) | 2.8% | Niche |  |
| Cosmos DB, Spark, Databricks (`data-platforms`) | 2.6% | Niche |  |
| Network mocking, route and HAR (`pw-network`) | 2.4% | Core | yes |
| Trace viewer and debugging (`pw-debug`) | 2.0% | Core | yes |
| Compatibility and localisation (`cross-compat`) | 1.9% | Niche |  |
| Page Object Model (`fw-pom`) | 1.5% | Core | yes |
| Fixtures and hooks (`pw-fixtures`) | 0.9% | Core | yes |
| OData, Auth0, Keycloak, NestJS (`api-providers`) | 0.4% | Niche |  |
| GraphQL (`api-graphql`) | 0.4% | Niche |  |
| Component testing (`pw-component`) | 0.2% | Core | yes |
| Auto-waiting and web-first assertions (`pw-waits-assertions`) | 0.0% | Core | yes |
| Visual regression (`pw-visual`) | 0.0% | Core | yes |
| Playwright locators (`pw-locators`) | 0.0% | Core | yes |
| Config and projects (`pw-config`) | 0.0% | Core | yes |
| Auth and storage state (`pw-auth`) | 0.0% | Core | yes |
| APIRequestContext and API tests in Playwright (`pw-api`) | 0.0% | Core | yes |
| Artillery (`performance-artillery`) | 0.0% | Niche |  |
| Migrating between test tools (`migration-frameworks`) | 0.0% | Niche |  |
