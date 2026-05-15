#!/usr/bin/env node
import { main } from "../mmcp.js";
main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`mmcp: ${message}`);
    process.exitCode = 1;
});
//# sourceMappingURL=mmcp.js.map