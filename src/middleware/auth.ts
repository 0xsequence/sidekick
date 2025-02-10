import type { FastifyReply } from "fastify";

import type { FastifyRequest } from "fastify";

// Dummy auth middleware
const auth = async (request: FastifyRequest, reply: FastifyReply) => {
    if(['GET', 'HEAD'].includes(request.method)) {
        return;
    }
    const { 'x-secret-key': secretKey } = request.headers;
    if (!secretKey || secretKey !== process.env.SECRET_KEY) {
        return reply.status(401).send({ error: "Unauthorized" });
    }
};

export default auth;
