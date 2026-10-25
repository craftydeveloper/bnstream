# Release checklist

- [ ] Keep secrets outside the repository and apply least privilege.
- [ ] Verify middleware protects every administrative route.
- [ ] Validate request schemas and limits for write endpoints.
- [ ] Confirm chain ID and contract addresses; use a test network for contract changes.
- [ ] Review subscription, tip, and fee behavior with clear consent and failure handling.
- [ ] Check database backup and recovery procedures.
- [ ] Test provider outages, rate limits, and event-channel authorization.
- [ ] Publish API documentation and rollback steps before release.