# Sequence Engine

Setup instructions:

1. Install dependencies: `pnpm install`
2. Create a `.env` and set it up

Instructions to run the engine without Docker:
`pnpm start:redis` (Will start Redis)
`pnpm start` (Will start the server)

Instructions to run the engine with Docker:
`pnpm docker:start` (Will start Redis, PostgreSQL, and the server)
`curl http://127.0.0.1:3000` should return {"status":"ok"}

Instructions to stop and restart the engine with Docker:
`pnpm docker:stop` (Will stop all the services)
`pnpm docker:restart` (Will stop and start all the services)

Instructions to stop Redis:
`pnpm stop:redis` (Will stop Redis)

Instructions to start Redis:
`pnpm start:redis` (Will start Redis)

Instructions to test the engine:
`pnpm run test` (Will run the tests)
`pnpm run test:watch` (Will run the tests in watch mode)
`pnpm run test:coverage` (Will run the tests and generate a coverage report)

Instructions to run the engine in development mode:
`pnpm run dev` (Will start the server in development mode)
# sequence-engine
