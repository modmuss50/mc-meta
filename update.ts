import { ensureDir } from "https://deno.land/std@0.93.0/fs/mod.ts";

console.log("Updating");

await ensureDir("./data/versions/");

async function getJson(url: string) {
  let res = await fetch(url);
  let json = res.json();
  return json;
}

async function downloadJson(url: string, path: string) {
  const res = await fetch(url);
  const data = await res.json();
  const json = JSON.stringify(data, null, 2);
  await Deno.writeTextFile("./data/" + path, json);
}

await downloadJson(
  "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json",
  "java_versions.json"
);
await downloadJson(
  "https://launchermeta.mojang.com/mc/game/version_manifest.json",
  "version_manifest.json"
);
await downloadJson(
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json",
  "version_manifest_v2.json"
);

let manifest = await getJson(
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
);
let versions: any[] = manifest.versions;

let tasks = versions.map((version) => {
  return downloadJson(version.url, "versions/" + version.id + ".json");
});

await Promise.all(tasks);

let latest = versions[0];
await downloadJson(latest.url, "latest.json");
