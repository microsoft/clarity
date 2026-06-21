/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/test/**/*.jest.ts"],
    moduleNameMapper: {
        "^@src/(.*)$": "<rootDir>/src/$1",
        "^@clarity-types/(.*)$": "<rootDir>/types/$1",
    },
    transform: {
        "^.+\\.ts$": ["ts-jest", {
            tsconfig: "tsconfig.json",
            // Use full compiler mode (not isolatedModules) so const enum from .d.ts resolves
            isolatedModules: false,
        }],
    },
};
