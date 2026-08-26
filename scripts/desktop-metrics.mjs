import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = join(repoRoot, "src-tauri", "target", "release");
const bundleRoot = join(artifactRoot, "bundle");
const outputDir = join(repoRoot, "artifacts");
const defaultBinary = join(artifactRoot, "veritas");
const defaultWaitMs = 2500;

export function bytesForPath(path) {
  if (!existsSync(path)) return null;
  const entry = statSync(path);
  if (entry.isFile()) return entry.size;
  return null;
}

export function parseLinuxRssKb(statusContents) {
  const match = statusContents.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  return match ? Number(match[1]) : null;
}

export function missingBinaryStatus(binary) {
  return { status: "NOT VERIFIED", reason: `binário ausente: ${binary}` };
}

function readLinuxRssKb(pid) {
  if (process.platform !== "linux") return null;
  try {
    return parseLinuxRssKb(readFileSync(`/proc/${pid}/status`, "utf8"));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

export async function measureStartup(binary, waitMs = defaultWaitMs) {
  if (!existsSync(binary)) return missingBinaryStatus(binary);
  const startedAt = performance.now();
  const child = spawn(binary, [], {
    detached: false,
    stdio: "ignore",
    env: { ...process.env },
  });
  const spawnMs = await new Promise((resolveSpawn, rejectSpawn) => {
    child.once("spawn", () => resolveSpawn(performance.now() - startedAt));
    child.once("error", rejectSpawn);
  }).catch((error) => ({ status: "NOT VERIFIED", reason: error.message }));
  if (typeof spawnMs !== "number") return { startup: spawnMs };
  await wait(waitMs);
  const idleRssKb = readLinuxRssKb(child.pid);
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    wait(1000),
  ]);
  return {
    status: "MEASURED",
    spawn_ms: Number(spawnMs.toFixed(2)),
    idle_rss_kb: idleRssKb,
    simulation_rss_kb: null,
    simulation_status: "NOT VERIFIED",
  };
}

export async function runDesktopMetrics({
  binary = process.env.VERITAS_DESKTOP_BINARY || defaultBinary,
  waitMs = Number(process.env.VERITAS_DESKTOP_METRICS_WAIT_MS || defaultWaitMs),
  capturedAt = new Date().toISOString(),
  jsonPath = process.env.VERITAS_DESKTOP_METRICS_JSON,
  markdownPath = process.env.VERITAS_DESKTOP_METRICS_MD,
} = {}) {
  const files = {
    binary,
    deb: join(bundleRoot, "deb", "Veritas_0.1.0-alpha.1_amd64.deb"),
    appimage: join(
      bundleRoot,
      "appimage",
      "Veritas_0.1.0-alpha.1_amd64.AppImage",
    ),
  };
  const startup = await measureStartup(binary, waitMs);
  const metrics = {
    schema: "veritas.desktop.metrics.v1",
    captured_at: capturedAt,
    platform: process.platform,
    arch: process.arch,
    shell_version: "0.1.0-alpha.1",
    core_version: "0.9.0-rc.15",
    files: Object.fromEntries(
      Object.entries(files).map(([name, path]) => [
        name,
        { path, bytes: bytesForPath(path) },
      ]),
    ),
    startup,
    notes: [
      "Download size é medido pelo tamanho do artefato publicado; installed size depende do sistema e ainda não é medido neste script.",
      "simulation_rss_kb permanece NOT VERIFIED porque a simulação exige interação com a janela e não deve ser inferida a partir do processo ocioso.",
      "Este medidor não envia dados para a rede.",
    ],
  };
  const stamp = capturedAt.replace(/[:.]/g, "-");
  const resolvedJsonPath =
    jsonPath || join(outputDir, `desktop-metrics-${stamp}.json`);
  const resolvedMarkdownPath =
    markdownPath || join(outputDir, `desktop-metrics-${stamp}.md`);
  writeFileSync(resolvedJsonPath, `${JSON.stringify(metrics, null, 2)}\n`);
  writeFileSync(
    resolvedMarkdownPath,
    [
      "# Métricas desktop",
      "",
      `- Captura: ${metrics.captured_at}`,
      `- Plataforma: ${metrics.platform}/${metrics.arch}`,
      `- Shell: ${metrics.shell_version}`,
      "",
      "| Medida | Resultado |",
      "| --- | ---: |",
      ...Object.entries(metrics.files).map(
        ([name, item]) =>
          `| ${name} | ${item.bytes === null ? "NOT VERIFIED" : `${item.bytes} bytes`} |`,
      ),
      `| Startup spawn | ${startup.status === "MEASURED" ? `${startup.spawn_ms} ms` : startup.status} |`,
      `| Memória idle | ${startup.idle_rss_kb === null ? "NOT VERIFIED" : `${startup.idle_rss_kb} kB`} |`,
      "| Memória durante simulação | NOT VERIFIED |",
      "",
      "A captura é local e não envia dados pela rede. O valor de startup é o tempo até o processo ser criado, não uma garantia de que a interface terminou de renderizar.",
      "",
    ].join("\n"),
  );
  return {
    jsonPath: resolvedJsonPath,
    markdownPath: resolvedMarkdownPath,
    metrics,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  runDesktopMetrics().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}
