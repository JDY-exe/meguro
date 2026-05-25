import { createApp, createBackendConfig } from "./app.js";

const port = Number(process.env.PORT ?? 4001);
const host = process.env.HOST ?? "0.0.0.0";
const { app } = await createApp(createBackendConfig());

await app.listen({ port, host });
