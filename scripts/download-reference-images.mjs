import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const sourceFile = "apps/web/src/app/interfaces/atm/page.tsx";
const outputDir = "apps/web/public/reference";

const source = readFileSync(sourceFile, "utf8");
const urls = [...source.matchAll(/https:\/\/lh7-rt\.googleusercontent\.com[^"']+/g)].map(
  (match) => match[0],
);

mkdirSync(outputDir, { recursive: true });

let index = 1;
for (const url of urls) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download reference ${index}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const filePath = path.join(
    outputDir,
    `atm-ref-${String(index).padStart(2, "0")}.${extension}`,
  );

  writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  console.log(`${filePath} ${contentType}`);
  index += 1;
}

