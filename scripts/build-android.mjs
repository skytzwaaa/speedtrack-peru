import { spawnSync } from "node:child_process";
const windows = process.platform === "win32";
const result = spawnSync(
  windows ? "gradlew.bat" : "./gradlew",
  ["assembleDebug"],
  { cwd: "android", stdio: "inherit", shell: windows },
);
process.exit(result.status ?? 1);
