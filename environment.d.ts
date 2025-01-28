interface EnvironmentVariables {
    readonly DATABASE_URL: string;
    readonly ENABLE_DATABASE_LOGGING: string;
    readonly ENS_API_URL: string;
    readonly SLEEP_INTERVAL: number;
    readonly RECENT_FOLLOWS_INTERVAL: number;
    readonly LEADERBOARD_RANKING_INTERVAL: number;
    readonly RECOMMENDED_INTERVAL: number;
    readonly ENSMETADATA_INTERVAL: number;
    readonly HEARTBEAT_INTERVAL: number;
    readonly HEARTBEAT_URL: string;
    readonly EFP_CACHE_INTERVAL: number;
    readonly EFP_MUTUALS_INTERVAL: number;
    readonly GITHUB_ACCESS_TOKEN: string;
    readonly GITHUB_LIST_PATH: string;
}

declare module "bun" {
	interface Env extends EnvironmentVariables {}
}

declare namespace NodeJs {
	interface ProcessEnv extends EnvironmentVariables {}
}
