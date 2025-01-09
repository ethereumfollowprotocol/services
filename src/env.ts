import { raise } from "./utilities";

export const env = Object.freeze({
    ENABLE_DATABASE_LOGGING: getEnvVariable("ENABLE_DATABASE_LOGGING"),
    ENS_API_URL: getEnvVariable("ENS_API_URL"),
    DATABASE_URL: getEnvVariable("DATABASE_URL"),
    RECENT_FOLLOWS_INTERVAL: getEnvVariable("RECENT_FOLLOWS_INTERVAL"),
    LEADERBOARD_RANKING_INTERVAL: getEnvVariable("LEADERBOARD_RANKING_INTERVAL"),
    RECOMMENDED_INTERVAL: getEnvVariable("RECOMMENDED_INTERVAL"),
    ENSMETADATA_INTERVAL: getEnvVariable("ENSMETADATA_INTERVAL"),
    SNITCH_ID: getEnvVariable("SNITCH_ID"),
    HEARTBEAT_INTERVAL: getEnvVariable("HEARTBEAT_INTERVAL"),
    EFP_CACHE_INTERVAL: getEnvVariable("EFP_CACHE_INTERVAL"),
    EFP_MUTUALS_INTERVAL: getEnvVariable("EFP_MUTUALS_INTERVAL"),
    GITHUB_ACCESS_TOKEN: getEnvVariable("GITHUB_ACCESS_TOKEN"),
    GITHUB_LIST_PATH: getEnvVariable("GITHUB_LIST_PATH")
});

function getEnvVariable<T extends keyof EnvironmentVariables>(name: T) {
    return process.env[name] ?? raise(`environment variable ${name} not found`);
}
