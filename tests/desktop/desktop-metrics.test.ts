import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bytesForPath,
  measureStartup,
  missingBinaryStatus,
  parseLinuxRssKb,
  runDesktopMetrics,
} from "../../scripts/desktop-metrics.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe("desktop metrics helpers", () => {
  it("interpreta VmRSS válido e rejeita conteúdo sem a linha esperada", () => {
    expect(parseLinuxRssKb("Name:\tveritas\nVmRSS:\t170532 kB\n")).toBe(170532);
    expect(parseLinuxRssKb("Name:\tveritas\nVmSize:\t170532 kB\n")).toBeNull();
    expect(parseLinuxRssKb("VmRSS: inválido kB")).toBeNull();
  });

  it("mede somente arquivos regulares e retorna null para caminhos ausentes", () => {
    expect(bytesForPath(fileURLToPath(import.meta.url))).toBeGreaterThan(0);
    expect(
      bytesForPath(join(testDirectory, "arquivo-que-nao-existe")),
    ).toBeNull();
    expect(bytesForPath(testDirectory)).toBeNull();
  });

  it("classifica um binário ausente como NOT VERIFIED", async () => {
    const binary = join(tmpdir(), "veritas-binary-que-nao-existe");
    expect(missingBinaryStatus(binary)).toEqual({
      status: "NOT VERIFIED",
      reason: `binário ausente: ${binary}`,
    });
    await expect(measureStartup(binary, 0)).resolves.toEqual(
      missingBinaryStatus(binary),
    );
  });

  it("gera JSON e Markdown determinísticos sem exigir o binário nem rede", async () => {
    const directory = await mkdtemp(join(tmpdir(), "veritas-desktop-metrics-"));
    const jsonPath = join(directory, "metrics.json");
    const markdownPath = join(directory, "metrics.md");
    const binary = join(directory, "missing-veritas");

    try {
      const result = await runDesktopMetrics({
        binary,
        waitMs: 0,
        capturedAt: "2026-08-25T12:00:00.000Z",
        jsonPath,
        markdownPath,
      });
      const json = JSON.parse(
        await readFile(jsonPath, "utf8"),
      ) as typeof result.metrics;
      const markdown = await readFile(markdownPath, "utf8");

      expect(result.jsonPath).toBe(jsonPath);
      expect(result.markdownPath).toBe(markdownPath);
      expect(json.captured_at).toBe("2026-08-25T12:00:00.000Z");
      expect(json.startup).toEqual(missingBinaryStatus(binary));
      expect(json.files.binary.bytes).toBeNull();
      expect(markdown).toContain("Memória durante simulação | NOT VERIFIED");
      expect(markdown).toContain(
        "A captura é local e não envia dados pela rede.",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
