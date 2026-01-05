import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { readingRoutes } from './routes/readings.routes.ts';

export type BuildAppOptions = {
    logger?: boolean;
}
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
    const app = Fastify({
        logger: options.logger ?? true
    });

    app.get("/health", async () => ({ status: "ok" }));
    app.register(readingRoutes, {prefix: "/api"})
    return app;
}