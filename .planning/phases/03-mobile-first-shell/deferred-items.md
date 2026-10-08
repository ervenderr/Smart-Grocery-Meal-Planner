# Deferred Items (phase 03)

- RESOLVED (fix(zapier): migration 20261010010000_zapier_webhooks, drift check now exits 0): Pre-existing schema drift: model for `zapier_webhooks` is in schema.prisma but no migration creates the table, so `prisma migrate diff --exit-code` exits 2 (found in 03-02). Unrelated to onboarding; drift check shows no user_preferences differences. Needs its own migration or removal.
