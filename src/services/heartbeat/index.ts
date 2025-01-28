import { env } from "#/env";
import { logger } from "#/logger";

export async function sendHeartbeat() {
	try {
		const response = await fetch(`${env.HEARTBEAT_URL}`);
        const result = await response.text();
		logger.log("Heartbeat registered");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : error;
		logger.error("EXCEPTION", errorMessage);
	}
}
