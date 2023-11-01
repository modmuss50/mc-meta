import { ensureDir } from "https://deno.land/std@0.204.0/fs/mod.ts";
import { PromisePool } from "https://deno.land/x/promise_pool@0.0.3/index.ts";

const pool = new PromisePool({ concurrency: 8 });
const maxRetries = 3;

await ensureDir("./data/versions/");

async function downloadJson(url: string, path: string) {
  console.log("Downloading " + url);
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const json = JSON.stringify(data, null, 2);
      await Deno.writeTextFile("./data/" + path, json);
      return data;
    } catch (e) {
      console.log("Error downloading " + url + " retrying");

      if (i == maxRetries - 1) {
        throw e;
      }
    }
  }
}

const manifest = await downloadJson(
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  "version_manifest_v2.json",
);

const versions: any[] = manifest.versions;

await Promise.all(versions.map((version) => {
  return pool.open(async () => {
    await downloadJson(version.url, "versions/" + version.id + ".json");
  });
}));

const latest = versions[0];
await downloadJson(latest.url, "latest.json");

await downloadJson(
  "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json",
  "java_versions.json",
);
await downloadJson(
  "https://piston-meta.mojang.com/mc/game/version_manifest.json",
  "version_manifest.json",
);
