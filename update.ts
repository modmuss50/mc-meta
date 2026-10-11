import { access, mkdir, readFile, writeFile } from "node:fs/promises";

const concurrency = 8;
const maxRetries = 3;

await mkdir("./data/versions/", { recursive: true });

type Version = { id: string; url: string };
type Manifest = { versions: Version[] };

async function readOptional(path: string) {
  try {
    return await readFile("./data/" + path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJson(path: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  if (await readOptional(path) !== json) {
    await writeFile("./data/" + path, json, "utf8");
  }
}

async function exists(path: string) {
  try {
    await access("./data/" + path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function downloadJson(url: string, path?: string) {
  console.log("Downloading " + url);
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} downloading ${url}`);
      }
      const data = await res.json();
      if (path !== undefined) await writeJson(path, data);
      return data;
    } catch (e) {
      console.log("Error downloading " + url + " retrying");

      if (i == maxRetries - 1) {
        throw e;
      }
    }
  }
}

const previousJson = await readOptional("version_manifest_v2.json");
const previous: Manifest | undefined = previousJson === undefined
  ? undefined
  : JSON.parse(previousJson);
const previousUrls = new Map(previous?.versions.map(({ id, url }) => [id, url]));

const manifest: Manifest = await downloadJson(
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
);

const versions = manifest.versions;

let nextVersion = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (nextVersion < versions.length) {
    const version = versions[nextVersion++];
    const path = "versions/" + version.id + ".json";
    if (previousUrls.get(version.id) !== version.url || !await exists(path)) {
      await downloadJson(version.url, path);
    }
  }
}));

const latest = versions[0];
await writeJson("latest.json", JSON.parse(
  await readFile("./data/versions/" + latest.id + ".json", "utf8"),
));

await downloadJson(
  "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json",
  "java_versions.json",
);
await downloadJson(
  "https://piston-meta.mojang.com/mc/game/version_manifest.json",
  "version_manifest.json",
);
await downloadJson(
  "https://api.minecraftservices.com/publickeys",
  "publickeys.json",
);

// Commit the change index only after every download succeeds.
await writeJson("version_manifest_v2.json", manifest);
