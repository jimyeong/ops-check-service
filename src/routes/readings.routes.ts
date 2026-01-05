import type { FastifyInstance } from "fastify";

export async function readingRoutes(app: FastifyInstance) {
    app.get("/readings", async () => {
        return { data: [] }
    });
    app.post("/readings", async (request) => {
        return { ok: true, receicved: request.body }
    })
}