import { buildApp } from './app.ts';

const app = buildApp();

app.listen({ port: 3000 }, (err, address) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
    app.log.info(`Server is running on ${address}`);
});