# Contributing

- Document API changes and test input validation and authorization boundaries.
- Never commit private keys, API key values, database credentials, or real user data.
- Prefer read-only provider access; any transaction or payout change needs a separate security and financial-risk review.
- Keep frontend and server responsibilities clear and handle third-party outages.
- Run npm test and follow docs/RELEASE_CHECKLIST.md before release.