// Renders newsletter-popup.html to PNG banners (800x1000 and 800x800).
// Usage: node tools/banners/render.mjs [fontsDir]   (fontsDir = node_modules/@fontsource root; optional offline fonts)
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../assets/ads");
const fonts = process.argv[2];
let css = "";
if (fonts) {
  for (const [fam, dir, ws] of [["Hind Siliguri", "hind-siliguri", [500, 600, 700]], ["Baloo Da 2", "baloo-da-2", [600, 800]]])
    for (const w of ws) for (const sub of ["latin", "bengali"]) {
      const f = path.join(fonts, "@fontsource", dir, "files", `${dir}-${sub}-${w}-normal.woff2`);
      if (fs.existsSync(f)) css += `@font-face{font-family:"${fam}";font-weight:${w};src:url("${pathToFileURL(f)}") format("woff2")}`;
    }
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [name, h, cls] of [["newsletter-popup-800x1000", 1000, ""], ["newsletter-popup-800x800", 800, "sq"]]) {
  const page = await browser.newPage({ viewport: { width: 800, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(here, "newsletter-popup.html")).href, { waitUntil: "domcontentloaded" });
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate((c) => { document.getElementById("banner").className = "b " + c; }, cls);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.locator("#banner").screenshot({ path: path.join(out, name + ".png") });
  await page.close();
}
await browser.close();
