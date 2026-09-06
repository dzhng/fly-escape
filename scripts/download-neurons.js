#!/usr/bin/env node
/**
 * Fetch MaleCNS v1.0 flat-connectome feathers from public GCS HTTPS.
 * Skips files that already exist with the expected size (same as scripts/download_data.py).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const BASE =
  "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome";

const FILES = [
  {
    name: "body-annotations-male-cns-v1.0-minconf-0.5.feather",
    size: 14483314,
  },
  {
    name: "body-neurotransmitters-male-cns-v1.0.feather",
    size: 43282834,
  },
  {
    name: "connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather",
    size: 502169298,
  },
];

const outDir = path.resolve(__dirname, "..", "data", "raw");

function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = client.get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        file.close();
        fs.unlink(dest, () => {});
        fetchToFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error("HTTP " + res.statusCode + " for " + url));
        return;
      }
      const total = Number(res.headers["content-length"]) || 0;
      let got = 0;
      let lastLog = 0;
      res.on("data", (chunk) => {
        got += chunk.length;
        if (total > 0 && got - lastLog > 5 * 1024 * 1024) {
          lastLog = got;
          const pct = Math.min(100, (100 * got) / total);
          process.stdout.write(
            "\r  " +
              pct.toFixed(1) +
              "% (" +
              Math.floor(got / (1024 * 1024)) +
              " / " +
              Math.floor(total / (1024 * 1024)) +
              " MiB)"
          );
        }
      });
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          if (total > 0) process.stdout.write("\n");
          resolve();
        });
      });
    });
    req.on("error", (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function ensureFile(file) {
  const name = file.name;
  const size = file.size;
  const dest = path.join(outDir, name);
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(dest)) {
    const actual = fs.statSync(dest).size;
    if (actual === size) {
      console.log("OK exists " + name + " (" + actual + " bytes)");
      return;
    }
    console.log(
      "Partial/mismatched " +
        name +
        ": " +
        actual +
        " vs " +
        size +
        "; re-fetching"
    );
    fs.unlinkSync(dest);
  }
  const url = BASE + "/" + name;
  console.log("Fetching " + url);
  console.log("  -> " + dest);
  await fetchToFile(url, dest);
  const saved = fs.statSync(dest).size;
  console.log("  saved " + saved + " bytes");
  if (saved !== size) {
    console.error("WARNING: size " + saved + " != catalogued " + size);
  }
}

async function main() {
  for (const file of FILES) {
    await ensureFile(file);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
