# Sequence Sidekick 🧑‍💻

Sidekick is a companion service, fully open source,that simplifies blockchain interactions for your applications and games. It provides a RESTful API for executing sponsored transactions, managing smart contracts, and handling common Web3 operations without exposing private keys or complex blockchain logic to your frontend.

When executing any transaction with Sidekick, the caller will not be the EOA of the PRIVATE KEY you're using for Sidekick, but a Sequence Smart Wallet created for your EOA.
You can get the address by making a GET request to the `/sidekick/wallet-address` endpoint.

## Setup

- Copy `.env.example` to `.env`: `cp .env.example .env`
- Set up your environment variables in `.env`:

## Using Docker (Recommended)

Quickstart locally with Docker with only one command:
`pnpm docker:start` (Will start Redis, PostgreSQL, and the server)
`curl http://127.0.0.1:3000` should return {"status":"ok"}

Instructions to stop and restart the sidekick with Docker:
`pnpm docker:stop` (Will stop all the services)
`pnpm docker:restart` (Will stop and start all the services)

### Run the sidekick without Docker, locally for development:
1. Install dependencies: `pnpm install`
2. Generate Prisma client: `pnpm prisma generate`
3. Create database tables: `pnpm prisma migrate dev`
4. Start Redis: `pnpm start:redis`
5. Start the server: `pnpm start`

Instructions to stop Redis:
`pnpm stop:redis` (Will stop Redis)

Instructions to start Redis:
`pnpm start:redis` (Will start Redis)

Instructions to test the sidekick:
`pnpm run test` (Will run the tests)
`pnpm run test:watch` (Will run the tests in watch mode)
`pnpm run test:coverage` (Will run the tests and generate a coverage report)

Instructions to run the sidekick in development mode:
`pnpm run dev` (Will start the server in development mode)
`pnpm run dev:withRedis` (Will start the server and Redis in development mode)

## Analytics & Monitoring

Sidekick provides several tools for monitoring, metrics, and alerting. Here's where to find each:

### Grafana Dashboard
- **Purpose:** Visualize metrics and monitor the health and performance of Sidekick services.
- **Access:** [http://localhost:3001](http://localhost:3001)
- **Default Login:**  
  - **Username:** `admin`  
  - **Password:** `admin`
- **Note:** Grafana is pre-configured to use Prometheus as a data source. Dashboards are provisioned from `monitoring/grafana/provisioning/dashboards`.

### Metrics Endpoint (Prometheus Scrape Target)
- **Purpose:** Exposes Prometheus-compatible metrics for Sidekick.
- **Access:** [http://localhost:3000/metrics](http://localhost:3000/metrics)
- **Note:** This endpoint is scraped by Prometheus (see `monitoring/prometheus/prometheus.yml` for config).

### Prometheus
- **Purpose:** Query, visualize, and explore collected metrics.
- **Access:** [http://localhost:9090](http://localhost:9090)
- **Note:** Prometheus is configured via `monitoring/prometheus/prometheus.yml` and alert rules in `monitoring/prometheus/alerts.yml`.

### Prometheus Alerts (Alertmanager)
- **Purpose:** View and manage alerting rules and notifications.
- **Access:** [http://localhost:9093](http://localhost:9093)
- **Note:** Alertmanager is configured via `monitoring/alertmanager/alertmanager.yml`.

### Blackbox Exporter
- **Purpose:** Probe endpoints over HTTP, HTTPS, TCP, and ICMP for uptime and latency monitoring.
- **Access:** [http://localhost:9115](http://localhost:9115)
- **Note:** Used by Prometheus for external endpoint checks.

### DEBUG mode

Sidekick provides a DEBUG mode that will give you detailed logs so you can see what's happening under the hood, add DEBUG="true" as an environment variable to your .env file to turn it on.

### Tenderly

Sidekick is integrated with Tenderly, you can use it to simulate transactions, deployments, or get a transaction simulation URL and debug directly from the Tenderly UI with just one click. For the best results, we recommend that your contracts are verified.
To use Tenderly, you need to add the following environment variables to your .env file:

TENDERLY_ACCESS_KEY=...
TENDERLY_ACCOUNT_SLUG=..
TENDERLY_PROJECT_SLUG=..

### Contract Verification

Sidekick automatically verifies contracts at deployment time, it checks if a contract is already verified, if not it will verify it.
For now, this only works for the following contracts:

- ERC20 (/deploy/erc20/:chainId)
- ERC721 (/deploy/erc721/:chainId)
- ERC1155 (/deploy/erc1155/:chainId)

To turn automatic verification on you need the following environment variables:

VERIFY_CONTRACT_ON_DEPLOY=true
ETHERSCAN_API_KEY=...

Verification for other contract templates will be added soon.

---

More documentation here: https://docs.sequence.xyz/solutions/sidekick/overview
