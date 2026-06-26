import { createWriteStream } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const reportsRoot = path.join(repoRoot, "reports");
const runsRoot = path.join(reportsRoot, "runs");
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "");
const reportDir = path.join(runsRoot, timestamp);
const junitPath = path.join(reportDir, "junit.xml");
const outputPath = path.join(reportDir, "output.log");
const summaryJsonPath = path.join(reportDir, "summary.json");
const summaryMdPath = path.join(reportDir, "summary.md");
const latestPath = path.join(reportsRoot, "latest");

const testTargets = process.argv.slice(2);
const testArgs = testTargets.length ? testTargets : ["tests/**/*.test.js"];
const nodeArgs = [
  "--test",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=junit",
  `--test-reporter-destination=${junitPath}`,
  ...testArgs,
];

await mkdir(reportDir, { recursive: true });

const startedAt = new Date();
const output = createWriteStream(outputPath, { flags: "a" });
const child = spawn(process.execPath, nodeArgs, {
  cwd: repoRoot,
  stdio: ["ignore", "pipe", "pipe"],
});

let combinedOutput = "";

const tee = (stream, target) => {
  stream.on("data", (chunk) => {
    combinedOutput += chunk.toString();
    output.write(chunk);
    target.write(chunk);
  });
};

tee(child.stdout, process.stdout);
tee(child.stderr, process.stderr);

const exitCode = await new Promise((resolve) => {
  child.on("close", resolve);
});

await new Promise((resolve) => output.end(resolve));

const completedAt = new Date();
const durationMs = completedAt.getTime() - startedAt.getTime();

const metric = (name) => {
  const match = combinedOutput.match(new RegExp(`^ℹ ${name} (\\d+)`, "m"));
  return match ? Number(match[1]) : null;
};

const failureLines = combinedOutput
  .split(/\r?\n/)
  .filter((line) => line.startsWith("✖ "))
  .map((line) => line.slice(2).trim());

const summary = {
  status: exitCode === 0 ? "passed" : "failed",
  exitCode,
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs,
  command: [process.execPath, ...nodeArgs],
  reportDir: path.relative(repoRoot, reportDir),
  reports: {
    junit: path.relative(repoRoot, junitPath),
    output: path.relative(repoRoot, outputPath),
    summaryJson: path.relative(repoRoot, summaryJsonPath),
    summaryMarkdown: path.relative(repoRoot, summaryMdPath),
  },
  totals: {
    tests: metric("tests"),
    suites: metric("suites"),
    pass: metric("pass"),
    fail: metric("fail"),
    cancelled: metric("cancelled"),
    skipped: metric("skipped"),
    todo: metric("todo"),
  },
  failures: failureLines,
};

const summaryMarkdown = [
  `# StackRank Test Report - ${timestamp}`,
  "",
  `- Status: **${summary.status}**`,
  `- Exit code: ${summary.exitCode}`,
  `- Started: ${summary.startedAt}`,
  `- Completed: ${summary.completedAt}`,
  `- Duration: ${(durationMs / 1000).toFixed(2)}s`,
  `- Tests: ${summary.totals.pass ?? "?"} passed / ${summary.totals.fail ?? "?"} failed / ${summary.totals.tests ?? "?"} total`,
  "",
  "## Files",
  "",
  `- JUnit XML: \`${summary.reports.junit}\``,
  `- Console output: \`${summary.reports.output}\``,
  `- JSON summary: \`${summary.reports.summaryJson}\``,
  "",
  "## Command",
  "",
  "```sh",
  summary.command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" "),
  "```",
  "",
  ...(failureLines.length
    ? [
        "## Failures",
        "",
        ...failureLines.map((line) => `- ${line}`),
        "",
      ]
    : []),
].join("\n");

await writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(summaryMdPath, `${summaryMarkdown}\n`);

try {
  await rm(latestPath, { recursive: true, force: true });
  await symlink(path.relative(reportsRoot, reportDir), latestPath, "dir");
} catch (error) {
  await writeFile(path.join(reportsRoot, "latest.txt"), `${path.relative(repoRoot, reportDir)}\n`);
  console.warn(`Could not update reports/latest symlink: ${error.message}`);
}

console.log(`\nTest report saved to ${path.relative(repoRoot, reportDir)}`);
console.log(`Latest report: ${path.relative(repoRoot, latestPath)}`);

process.exitCode = exitCode;
