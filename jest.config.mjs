/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary', 'html'],
  coverageThreshold: {
    global: {
      statements: 99,
      branches: 100,
      functions: 98,
      lines: 99,
    },
  },
};
