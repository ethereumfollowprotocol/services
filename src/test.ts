import { gracefulExit } from 'exit-hook'

import { ensMetadata } from "#/services/ensMetadata";
// import { sendHeartbeat } from "#/services/heartbeat";
import { leaderboard } from "#/services/leaderboard";
import { recentFollows } from "#/services/recentFollows";
import { recommended } from "#/services/recommended";
import { efpCache } from "./services/efpCache";
import { mutuals } from "./services/mutuals";

async function main() {
  await ensMetadata();
}

main().then(() => {
  gracefulExit()
}).catch((error) => {
  console.error('Error:', error);
})