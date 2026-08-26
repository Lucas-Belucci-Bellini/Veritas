import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const generator = join(repositoryRoot, "scripts/generate-desktop-manifest.mjs");

const artifactNames = [
  "Veritas-Setup.exe",
  "Veritas_0.1.0-alpha.1_aarch64.app.zip",
  "Veritas_0.1.0-alpha.1_aarch64.dmg",
  "Veritas_0.1.0-alpha.1_amd64.AppImage",
  "Veritas_0.1.0-alpha.1_amd64.deb",
];

type ProcessResult = { code: number; stdout: string; stderr: string };

function runGenerator(args: string[]): Promise<ProcessResult> {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [generator, ...args], {
      cwd: repositoryRoot,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) =>
      resolveResult({ code: code ?? -1, stdout, stderr }),
    );
  });
}

function argsFor(inputDir: string, manifestOut: string, checksumsOut: string) {
  return [
    "--input-dir",
    inputDir,
    "--manifest-out",
    manifestOut,
    "--checksums-out",
    checksumsOut,
    "--version",
    "0.1.0-alpha.1",
    "--tag",
    "desktop-v0.1.0-alpha.1",
    "--commit",
    "dcd4a42fe52db5b8f3d298c5d3729ec4a08c2a13",
  ];
}

describe("desktop release manifest generator", () => {
  it("produz manifesto e SHA256SUMS determinísticos para os cinco assets allowlisted", async () => {
    const directory = await mkdtemp(
      join(repositoryRoot, ".tmp-manifest-test-"),
    );
    const inputDir = join(directory, "artifacts");
    const manifestOut = join(directory, "manifest.json");
    const checksumsOut = join(directory, "SHA256SUMS");
    const secondManifestOut = join(directory, "manifest-second.json");
    const secondChecksumsOut = join(directory, "SHA256SUMS-second");

    try {
      for (const [index, filename] of artifactNames.entries()) {
        const nestedDir = join(
          inputDir,
          index % 2 === 0 ? "windows-or-linux" : "macos",
        );
        await mkdir(nestedDir, { recursive: true });
        await writeFile(
          join(nestedDir, filename),
          `fixture-${filename}\n`,
          "utf8",
        );
      }

      const first = await runGenerator(
        argsFor(inputDir, manifestOut, checksumsOut),
      );
      expect(first.code).toBe(0);
      expect(first.stdout).toContain(
        "Generated manifest.json and SHA256SUMS for 5 artifacts.",
      );

      const manifest = JSON.parse(await readFile(manifestOut, "utf8")) as {
        schemaVersion: number;
        version: string;
        tag: string;
        commit: string;
        artifacts: Array<{
          filename: string;
          platform: string;
          architecture: string;
          size: number;
          sha256: string;
        }>;
      };
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        version: "0.1.0-alpha.1",
        tag: "desktop-v0.1.0-alpha.1",
        commit: "dcd4a42fe52db5b8f3d298c5d3729ec4a08c2a13",
      });
      expect(manifest.artifacts.map((artifact) => artifact.filename)).toEqual(
        [...artifactNames].sort((left, right) => left.localeCompare(right)),
      );
      expect(manifest.artifacts).toHaveLength(5);
      expect(
        manifest.artifacts.every(
          (artifact) =>
            artifact.size > 0 && /^[0-9a-f]{64}$/.test(artifact.sha256),
        ),
      ).toBe(true);

      const checksums = await readFile(checksumsOut, "utf8");
      expect(
        checksums
          .split("\n")
          .filter(Boolean)
          .map((line) => line.slice(66)),
      ).toEqual(
        [...artifactNames].sort((left, right) => left.localeCompare(right)),
      );

      const second = await runGenerator(
        argsFor(inputDir, secondManifestOut, secondChecksumsOut),
      );
      expect(second.code).toBe(0);
      expect(await readFile(secondManifestOut, "utf8")).toBe(
        await readFile(manifestOut, "utf8"),
      );
      expect(await readFile(secondChecksumsOut, "utf8")).toBe(checksums);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recusa qualquer arquivo fora da allowlist fail-closed", async () => {
    const directory = await mkdtemp(
      join(repositoryRoot, ".tmp-manifest-test-"),
    );
    const inputDir = join(directory, "artifacts");
    const manifestOut = join(directory, "manifest.json");
    const checksumsOut = join(directory, "SHA256SUMS");

    try {
      await mkdir(inputDir, { recursive: true });
      for (const filename of artifactNames)
        await writeFile(join(inputDir, filename), filename, "utf8");
      await writeFile(
        join(inputDir, "unexpected.bin"),
        "not an installer",
        "utf8",
      );

      const result = await runGenerator(
        argsFor(inputDir, manifestOut, checksumsOut),
      );
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Unexpected desktop artifact set.");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
