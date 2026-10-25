# BNStream

BNStream is a Node.js service and browser frontend for live-stream records, token metadata, user profiles, premium features, and administrative configuration. The current code integrates Express, Socket.IO, MongoDB, Livepeer-related API calls, and BNB Chain contract reads.

## Run

Install dependencies with npm install, configure the environment variables listed in docs/CONFIGURATION.md, then run npm start. Do not commit local environment files or credential values.

## API areas

The server exposes health, stream, token, user, premium, and administrative routes. See docs/ARCHITECTURE.md and docs/INTEGRATIONS.md for boundaries and review requirements.

## Safety boundary

This repository contains subscription and on-chain functionality. Review authorization, signing, fees, and network selection before using real funds or deploying contracts. A route existing in source is not proof that its access control or business logic is production-ready.