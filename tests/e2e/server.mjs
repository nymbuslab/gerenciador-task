import { createServer } from "node:http";
import next from "next";

const hostname = "127.0.0.1";
const port = 3100;
const app = next({ dev: false, hostname, port });
const handler = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => handler(request, response));
server.listen(port, hostname);

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
