import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { readingRoutes } from './routes/readings.routes.ts';
import { getLatestReading } from './respositories/sensorReadingRepo.ts';
import sensible from '@fastify/sensible';

export type BuildAppOptions = {
    logger?: boolean;
}
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
    const app = Fastify({
        logger: options.logger ?? true
    });
    app.register(sensible)
    app.get("/health", async () => ({ status: "ok" }));
    app.get("/readings/latest", async (req)=>{
        const {device} = req.query as {device: string};
        if(!device) return app.httpErrors.badRequest("device is required");
        const row = await getLatestReading(device);
        if(!row) return app.httpErrors.notFound("no reading yet")
        return row
    })
    app.register(readingRoutes, {prefix: "/api"})
    return app;
}