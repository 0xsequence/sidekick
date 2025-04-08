# Sequence Sidekick 🧑‍💻

Sidekick is a companion service, fully open source,that simplifies blockchain interactions for your applications and games. It provides a RESTful API for executing sponsored transactions, managing smart contracts, and handling common Web3 operations without exposing private keys or complex blockchain logic to your frontend.

When executing any transaction with Sidekick, the msg.sender will not be the EOA of the PRIVATE KEY you're using for Sidekick, but a Sequence Smart Wallet address created for your EOA.
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

More documentation here: https://docs.sequence.xyz/solutions/sidekick/overview
