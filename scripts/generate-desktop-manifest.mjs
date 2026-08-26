#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const ARTIFACT_RULES = [
  {
    match: /^Veritas-Setup\.exe$/,
    descriptor: {
      platform: "windows",
      architecture: "x86_64",
      kind: "installer",
    },
  },
  {
    match:
      /^Veritas_[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?_aarch64\.app\.zip$/,
    descriptor: { platform: "macos", architecture: "aarch64", kind: "app-zip" },
  },
  {
    match: /^Veritas_[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?_aarch64\.dmg$/,
    descriptor: { platform: "macos", architecture: "aarch64", kind: "dmg" },
  },
  {
    match:
      /^Veritas_[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?_amd64\.AppImage$/,
    descriptor: { platform: "linux", architecture: "amd64", kind: "appimage" },
  },
  {
    match: /^Veritas_[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?_amd64\.deb$/,
    descriptor: { platform: "linux", architecture: "amd64", kind: "deb" },
  },
];

function usage() {
  console.error(
    "Usage: node scripts/generate-desktop-manifest.mjs --input-dir DIR --manifest-out FILE --checksums-out FILE --version VERSION --tag TAG --commit SHA",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || index + 1 >= argv.length) usage();
    args.set(key, argv[index + 1]);
    index += 1;
  }
  const required = [
    "--input-dir",
    "--manifest-out",
    "--checksums-out",
    "--version",
    "--tag",
    "--commit",
  ];
  if (required.some((key) => !args.get(key))) usage();
  return {
    inputDir: resolve(args.get("--input-dir")),
    manifestOut: resolve(args.get("--manifest-out")),
    checksumsOut: resolve(args.get("--checksums-out")),
    version: args.get("--version"),
    tag: args.get("--tag"),
    commit: args.get("--commit"),
  };
}

function assertSafeValue(name, value, pattern) {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function descriptorFor(filename) {
  return ARTIFACT_RULES.find((rule) => rule.match.test(filename))?.descriptor;
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertSafeValue(
    "version",
    options.version,
    /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/,
  );
  assertSafeValue(
    "tag",
    options.tag,
    /^(?:desktop-)?v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/,
  );
  assertSafeValue("commit", options.commit, /^[0-9a-f]{7,64}$/i);

  const entries = (await readdir(options.inputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const descriptors = entries.map((filename) => descriptorFor(filename));
  if (
    entries.length !== ARTIFACT_RULES.length ||
    descriptors.some((descriptor) => descriptor === undefined)
  ) {
    throw new Error(
      `Unexpected desktop artifact set. Received ${entries.join(", ")}`,
    );
  }

  const artifacts = [];
  for (const filename of entries) {
    const path = join(options.inputDir, filename);
    const metadata = await stat(path);
    const descriptor = descriptorFor(filename);
    artifacts.push({
      filename,
      platform: descriptor.platform,
      architecture: descriptor.architecture,
      kind: descriptor.kind,
      size: metadata.size,
      sha256: await sha256(path),
    });
  }

  const manifest = {
    schemaVersion: 1,
    product: "Veritas",
    version: options.version,
    tag: options.tag,
    commit: options.commit,
    artifacts,
  };
  const checksums = `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.filename}`).join("\n")}\n`;

  await writeFile(
    options.manifestOut,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(options.checksumsOut, checksums, "utf8");
  console.log(
    `Generated ${basename(options.manifestOut)} and ${basename(options.checksumsOut)} for ${artifacts.length} artifacts.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
