import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { readingRoutes } from '../routes/readings.routes';
import sensible from '@fastify/sensible';

export type BuildAppOptions = {
    logger?: boolean;
}
export function initApp(options: BuildAppOptions = {}): FastifyInstance {
    const app = Fastify({
        logger: options.logger ?? true
    });
    app.register(sensible)
    app.get("/health", async () => ({ status: "ok" }));
    app.get("/readings/latest", async (req)=>({ status: "last metre reading" }))
    app.register(readingRoutes, {prefix: "/api"})
    return app;
}