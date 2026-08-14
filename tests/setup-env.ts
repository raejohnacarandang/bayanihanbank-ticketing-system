// Test-only environment. Every vitest run targets a dedicated test database so
// that resetState()/seedIfEmpty() in tests can never wipe the real
// (bayanihan_bank) data. The test DB is created automatically on first run.
process.env.NODE_ENV = "test";
process.env.DB_NAME = "bayanihan_bank_test";
process.env.DEMO_MODE = "true";
