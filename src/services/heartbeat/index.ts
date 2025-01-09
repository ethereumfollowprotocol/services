import { env } from "#/env";
import { logger } from "#/logger";

export async function sendHeartbeat() {
	try {
		const response = await fetch(`https://nosnch.in/${env.SNITCH_ID}`);
		logger.log("Heartbeat registered");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : error;
		logger.error("EXCEPTION", errorMessage);
	}
}
