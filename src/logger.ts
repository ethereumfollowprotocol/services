import { createConsola } from "consola";

export const logger = createConsola({
	// when running in docker, we don't want to end up with double tags: efp-indexer efp-indexer
	defaults: { tag: "efp-services" },
	formatOptions: {
		date: true,
		colors: true,
	},
});
