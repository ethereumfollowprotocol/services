import { colors } from "consola/utils";
import { env } from "#/env";
import { logger } from "#/logger";
import { sleep } from "#/utilities";

import { ensMetadata } from "#/services/ensMetadata";
import { sendHeartbeat } from "#/services/heartbeat";
import { leaderboard } from "#/services/leaderboard";
import { recentFollows } from "#/services/recentFollows";
import { recommended } from "#/services/recommended";
import { efpCache } from "./services/efpCache";
import { mutuals } from "./services/mutuals";
import { log } from "node:console";

class ServiceManager {
	private serviceQueue: (() => Promise<void>)[] = [];
	private serviceRunning: (() => Promise<void>)[] = [];

	constructor() {}

	public addService(service: () => Promise<void>): void {
		this.serviceQueue.push(service);
	}

	public async checkServiceQueue(): Promise<void> {
		while (this.serviceQueue.length > 0) {
			const service = this.serviceQueue.shift();
			logger.log(`Starting service ${colors.green(service?.name as string)}`);
			if (service && !this.serviceRunning.includes(service)) {
				try {
					this.serviceRunning.push(service);
					service();
					this.serviceRunning = this.serviceRunning.filter(
						(s) => s !== service,
					);
				} catch (error) {
					logger.error(
						`Error in service ${colors.red(service?.name as string)}: ${error}`,
					);
				}
			}
		}
	}
}

async function main() {
	const services = [
		{
			service: recentFollows,
			interval: env.RECENT_FOLLOWS_INTERVAL || 120000,
		},
		{
			service: leaderboard,
			interval: env.LEADERBOARD_RANKING_INTERVAL || 120000,
		},
		{
			service: recommended,
			interval: env.RECOMMENDED_INTERVAL || 120000,
		},
		{
			service: ensMetadata,
			interval: env.ENSMETADATA_INTERVAL || 180000,
		},
		{
			service: sendHeartbeat,
			interval: env.HEARTBEAT_INTERVAL || 300000,
		},
		{
			service: efpCache,
			interval: env.EFP_CACHE_INTERVAL || 120000,
		},
        {
			service: mutuals,
			interval: env.EFP_MUTUALS_INTERVAL|| 120000,
		},
	];

	logger.box("EFP SERVICE MANAGER");
	const serviceManager = new ServiceManager();

    logger.log("Executing start up services...");
    await sendHeartbeat();
    await leaderboard();
    await mutuals();
    await leaderboard();
    // await ensMetadata();

	logger.log("Registering Services...");
	for (const { service, interval } of services) {
		setInterval(() => {
			serviceManager.addService(service);
		}, interval);
	}
    logger.log("[Running]");
	for (;;) {
		try {
			logger.log(colors.gray("..."));
			await serviceManager.checkServiceQueue();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : error;
			logger.error("EXCEPTION", errorMessage);
		}

		await sleep(1000);
	}
}

main();
