// Dev-only helper: screenshot the 3D world + sample canvas pixels.
import { chromium } from "playwright-core";
import fs from "node:fs";

const url = process.env.SHOT_URL || "http://localhost:3000/world";
const out = process.env.SHOT_OUT || "screenshots/world.png";
const viewport = process.env.SHOT_MOBILE
  ? { width: 390, height: 844 }
  : { width: 1440, height: 900 };

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
await page.goto(url, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: out });

const info = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return { canvas: false };
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  let renderer = null;
  let pixelStats = null;
  if (gl) {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "n/a";
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let nonBlack = 0;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] + buf[i + 1] + buf[i + 2] > 24) nonBlack++;
    }
    pixelStats = { w, h, nonBlackPct: +((100 * nonBlack) / (w * h)).toFixed(2) };
  }
  return {
    canvas: true,
    hasGl: !!gl,
    renderer,
    pixelStats,
    dataUrl: canvas.toDataURL("image/png").slice(0, 100000),
  };
});

if (info.dataUrl) {
  const b64 = info.dataUrl.split(",")[1];
  fs.writeFileSync(out.replace(".png", "-canvas.png"), Buffer.from(b64, "base64"));
}
delete info.dataUrl;
console.log(JSON.stringify({ out, info, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
