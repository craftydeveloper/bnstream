# Architecture

The service uses Node.js and Express for HTTP routes, Socket.IO for live events, and MongoDB/Mongoose for persistence. The browser frontend is under frontend/. API route definitions are in server.js; chain and token helpers are in fourmeme-integration.js; Solidity contracts and deployment configuration are under contracts/.

Keep provider calls behind integration modules, validate external responses, and do not treat indexer or contract data as authorization. Sensitive administrative actions must be guarded server-side.