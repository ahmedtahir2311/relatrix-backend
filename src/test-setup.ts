// Sets all required env vars before any module is imported.
// Runs as Jest setupFiles — executes before every test file.
process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.DATABASE_URL = 'postgres://postgres:test@localhost:5432/relatrix_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-used-only-in-unit-tests-min-32-chars!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
// 64 valid hex chars = 32 bytes for AES-256
process.env.ENCRYPTION_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
