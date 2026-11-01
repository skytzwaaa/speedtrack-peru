import { spawnSync } from "node:child_process";
const windows = process.platform === "win32";
const result = spawnSync(
  windows ? "gradlew.bat" : "./gradlew",
  ["assembleDebug"],
  { cwd: "android", stdio: "inherit", shell: windows },
);
if (result.error)
  console.error("Could not start the Gradle wrapper:", result.error.message);
if (result.signal) console.error(`Gradle was terminated by ${result.signal}.`);
process.exit(result.status ?? 1);
