import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseContentFiles } from "./loader";

function collectYamlFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith(".yaml")) {
        files[`./${relative(join(process.cwd(), "src", "content"), full).replace(/\\/g, "/")}`] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return files;
}

try {
  const content = parseContentFiles(collectYamlFiles(join(process.cwd(), "src", "content", "phase-01")));
  console.log(`内容校验通过：${content.phases.length}阶段，${content.divineChoices.length}神意，${content.oracles.length}神谕，${content.events.length}事件`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
