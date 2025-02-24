# Sequence Sidekick 🧑‍💻

Sequence Sidekick is a companion service that simplifies blockchain interactions for your applications and games. It provides a RESTful API for executing sponsored transactions, managing smart contracts, and handling common Web3 operations without exposing private keys or complex blockchain logic to your frontend.

### Using Docker (Recommended)

Quickstart locally with Docker:
`pnpm docker:start` (Will start Redis, PostgreSQL, and the server)
`curl http://127.0.0.1:3000` should return {"status":"ok"}

Run the sidekick without Docker, locally for development:
1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env`: `cp .env.example .env`
3. Set up your environment variables in `.env`:
4. Generate Prisma client: `pnpm prisma generate`
5. Create database tables: `pnpm prisma migrate dev`
6. Start Redis: `pnpm start:redis`
7. Start the server: `pnpm start`

Instructions to stop and restart the sidekick with Docker:
`pnpm docker:stop` (Will stop all the services)
`pnpm docker:restart` (Will stop and start all the services)

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
# sequence-sidekick
