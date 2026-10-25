import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9223";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9223",
  `--user-data-dir=${join(tmpdir(), `skyline-preview-${randomUUID()}`)}`, "about:blank",
], { stdio: "ignore", windowsHide: true });

async function wait(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`${debug}/json/version`)).ok) break; } catch {}
    await wait(200);
  }
  const pages = await (await fetch(`${debug}/json/list`)).json();
  const page = pages.find((item) => item.type === "page");
  if (!page) throw new Error("Edge page not found");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  });
  function send(method, params = {}) {
    const requestId = ++id;
    return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
  }
  async function waitFor(expression, timeoutMs = 3000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.result.value) return;
      await wait(60);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[390, 844], [390, 650], [390, 500], [320, 568]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: `${origin}/interfaces/player` });
    await waitFor("!!document.querySelector('.preview-player-header-team') && document.querySelector('.preview-player-map-image')?.naturalWidth > 0 && document.documentElement.scrollHeight <= innerHeight && document.querySelector('.preview-player-header-copy').getBoundingClientRect().right <= document.querySelector('.preview-player-header-team').getBoundingClientRect().left", 5000);
    const result = await send("Runtime.evaluate", { expression: "JSON.stringify({ team: document.querySelector('.preview-player-header-team')?.textContent, balanceLabel: document.querySelector('.preview-player-balance-total small')?.textContent, overview: document.querySelector('.preview-player-overview')?.textContent, headerFits: (() => { const logo = document.querySelector('.preview-player-header-copy').getBoundingClientRect(); const name = document.querySelector('.preview-player-header-team').getBoundingClientRect(); const timer = document.querySelector('.preview-player-timer').getBoundingClientRect(); return logo.right <= name.left && name.right <= timer.left; })(), image: document.querySelector('.preview-player-map-image')?.naturalWidth > 0, pins: document.querySelectorAll('.preview-player-map-pin').length, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, liveScreen: !!document.querySelector('.player-home') })", returnByValue: true });
    const state = JSON.parse(result.result.value);
    if (state.team !== "Команда Альфа" || state.balanceLabel !== "Баланс" || !state.overview?.includes("предприятий") || !state.headerFits || !state.image || state.pins !== 4 || state.width > width || state.height > height || state.liveScreen) throw new Error(`${width}x${height}: ${JSON.stringify(state)}`);
    const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-preview-${width}x${height}.png`, Buffer.from(image.data, "base64"));
    for (let attempt = 0; attempt < 15; attempt++) {
      const opened = await send("Runtime.evaluate", { expression: "!!document.querySelector('.preview-player-map-detail')", returnByValue: true });
      if (opened.result.value) break;
      await send("Runtime.evaluate", { expression: "document.querySelector('.preview-player-map-pin')?.click()" });
      await wait(150);
    }
    await waitFor("!!document.querySelector('.preview-player-map-detail')");
    const detail = await send("Runtime.evaluate", { expression: "!!document.querySelector('.preview-player-map-detail')", returnByValue: true });
    if (!detail.result.value) throw new Error(`${width}x${height}: marker did not open`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-assets-heading h2')");
    await waitFor("(() => { const list = document.querySelector('.preview-assets-list'); return !!list && list.classList.contains('has-more') === (list.scrollHeight - list.clientHeight > 2); })()");
    const assets = await send("Runtime.evaluate", { expression: "JSON.stringify({ title: document.querySelector('.preview-assets-heading h2')?.textContent, rows: document.querySelectorAll('.preview-asset-row').length, building: document.querySelector('.preview-assets-summary > div:last-child')?.textContent, resources: document.querySelectorAll('.preview-resource').length, listFits: document.querySelector('.preview-assets-list')?.scrollHeight - document.querySelector('.preview-assets-list')?.clientHeight <= 2, hint: document.querySelector('.preview-assets-list')?.classList.contains('has-more'), cue: !!document.querySelector('.preview-assets-list-wrap .preview-scroll-more'), scrollbar: getComputedStyle(document.querySelector('.preview-assets-list')).scrollbarWidth, icon: document.querySelector('.preview-resource--energy svg')?.innerHTML, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })", returnByValue: true });
    const assetState = JSON.parse(assets.result.value);
    if (assetState.title !== "Ваши активы" || assetState.rows !== 4 || !assetState.building.startsWith("2") || assetState.resources !== 6 || assetState.hint === assetState.listFits || assetState.cue !== assetState.hint || assetState.scrollbar !== "none" || assetState.width > width || assetState.height > height) throw new Error(`${width}x${height}: ${JSON.stringify(assetState)}`);
    const assetsLayout = await send("Runtime.evaluate", { expression: "JSON.stringify({ merged: !!document.querySelector('.preview-player-overview .preview-player-balance + .preview-assets-summary') && document.querySelectorAll('.preview-player-balance').length === 1, shared: document.querySelector('.preview-player-overview')?.textContent === " + JSON.stringify(state.overview) + ", static: !document.querySelector('.preview-assets-summary button'), sameRow: (() => { const balance = document.querySelector('.preview-player-overview .preview-player-balance').getBoundingClientRect(); const summary = document.querySelector('.preview-assets-summary').getBoundingClientRect(); return balance.right <= summary.left && Math.abs((balance.top + balance.bottom) / 2 - (summary.top + summary.bottom) / 2) < 2; })(), balanceFits: document.querySelector('.preview-player-balance-total strong').getBoundingClientRect().right <= document.querySelector('.preview-assets-summary').getBoundingClientRect().left, fits: [...document.querySelectorAll('.preview-assets-summary-value')].every((value) => value.scrollWidth <= value.clientWidth && value.getBoundingClientRect().right <= value.parentElement.getBoundingClientRect().right + 1), swapped: document.querySelector('.preview-resources-grid').getBoundingClientRect().bottom < document.querySelector('.preview-assets-heading').getBoundingClientRect().top, yields: [...document.querySelectorAll('.preview-resource-yield')].map((item) => item.textContent).join('|') === '+26 ед./кв|+60 ед./кв|+24 ед./кв|0 ед./кв|0 ед./кв|0 ед./кв', compact: document.querySelector('.preview-player-overview').getBoundingClientRect().height <= 74 })", returnByValue: true });
    if (Object.values(JSON.parse(assetsLayout.result.value)).some((value) => !value)) throw new Error(`${width}x${height}: assets layout ${assetsLayout.result.value}`);
    const assetsImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-assets-${width}x${height}.png`, Buffer.from(assetsImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-assets-filters button')[2]?.click()" });
    const filtered = await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-asset-row').length", returnByValue: true });
    if (filtered.result.value !== 1) throw new Error(`${width}x${height}: building filter failed`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-asset-row')?.click()" });
    const dialog = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-asset-dialog')?.textContent.includes('36 ед.')", returnByValue: true });
    if (!dialog.result.value) throw new Error(`${width}x${height}: asset detail failed`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-asset-close')?.click(); document.querySelectorAll('.preview-player-nav button')[2]?.click()" });
    await waitFor("!!document.querySelector('.preview-market-list.has-more')");
    const market = await send("Runtime.evaluate", { expression: "JSON.stringify({ oldHeading: !!document.querySelector('.preview-market-heading'), oldHelp: !!document.querySelector('.preview-market-help'), rows: document.querySelectorAll('.preview-market-row').length, yields: [...document.querySelectorAll('.preview-market-copy small')].every((item) => item.textContent.includes('ед./квартал')), rates: document.querySelectorAll('.preview-market-rates button').length, unitRates: [...document.querySelectorAll('.preview-market-rates button strong')].every((item) => item.textContent.endsWith('₽/ед.') && item.scrollWidth <= item.clientWidth), firstRate: document.querySelector('.preview-market-rates button')?.textContent, hint: document.querySelector('.preview-market-list')?.classList.contains('has-more'), cue: !!document.querySelector('.preview-market-list-wrap .preview-scroll-more'), scrollbar: getComputedStyle(document.querySelector('.preview-market-list')).scrollbarWidth, icon: document.querySelector('.preview-market-rates button svg')?.innerHTML, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })", returnByValue: true });
    const marketState = JSON.parse(market.result.value);
    if (marketState.oldHeading || marketState.oldHelp || marketState.rows !== 6 || !marketState.yields || marketState.rates !== 6 || !marketState.unitRates || !marketState.firstRate.replace(/\s/g, "").includes("60₽/ед.") || !marketState.hint || !marketState.cue || marketState.scrollbar !== "none" || marketState.icon !== assetState.icon || marketState.width > width || marketState.height > height) throw new Error(`${width}x${height}: market ${JSON.stringify(marketState)}`);
    const marketOverview = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-player-overview')?.textContent", returnByValue: true });
    if (marketOverview.result.value !== state.overview) throw new Error(`${width}x${height}: market overview differs`);
    const marketImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-market-${width}x${height}.png`, Buffer.from(marketImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "const list = document.querySelector('.preview-market-list'); list.scrollTop = list.scrollHeight; list.dispatchEvent(new Event('scroll'))" });
    await wait(50);
    const bottomHint = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-list')?.classList.contains('has-more') || !!document.querySelector('.preview-market-list-wrap .preview-scroll-more')", returnByValue: true });
    if (bottomHint.result.value) throw new Error(`${width}x${height}: scroll hint did not clear at bottom`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-rates button')?.click()" });
    const rateFiltered = await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-market-row').length", returnByValue: true });
    if (rateFiltered.result.value !== 1) throw new Error(`${width}x${height}: rate filter failed`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-rates button')?.click()" });
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-rates button')?.click()" });
    const marketFiltered = await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-market-row').length", returnByValue: true });
    if (marketFiltered.result.value !== 1) throw new Error(`${width}x${height}: market rate selection failed`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-buy')?.click()" });
    await wait(100);
    await send("Runtime.evaluate", { expression: "document.querySelector('[aria-label=\"Увеличить количество\"]')?.click()" });
    await wait(100);
    const marketDialog = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-confirm')?.textContent", returnByValue: true });
    if (!marketDialog.result.value?.replace(/\s/g, "").includes("48000")) throw new Error(`${width}x${height}: market quantity failed: ${marketDialog.result.value}`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-market-confirm')?.click()" });
    const purchase = await send("Runtime.evaluate", { expression: "JSON.stringify({ balance: document.querySelector('.preview-player-balance-total strong')?.textContent, assets: document.querySelector('.preview-assets-summary-value strong')?.textContent })", returnByValue: true });
    if (!purchase.result.value.replace(/\s/g, "").includes("80000")) throw new Error(`${width}x${height}: market purchase failed ${purchase.result.value}`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-assets-heading h2')");
    const purchasedAsset = await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('.preview-asset-row')].some((row) => row.textContent.includes('ТЭЦ-1 · 2 шт.') && row.textContent.includes('52 ед./кв')) && document.querySelector('.preview-assets-summary > div:last-child')?.textContent.startsWith('4') && document.querySelector('.preview-assets-summary-value strong')?.textContent === '8'", returnByValue: true });
    if (!purchasedAsset.result.value) throw new Error(`${width}x${height}: purchased building missing from assets`);
    const updatedOverview = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-player-overview')?.textContent", returnByValue: true });
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[3]?.click()" });
    await waitFor("document.querySelectorAll('.preview-tender-card').length === 2");
    const tendersOverview = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-player-overview')?.textContent", returnByValue: true });
    if (tendersOverview.result.value !== updatedOverview.result.value) throw new Error(`${width}x${height}: tenders overview differs`);
    const tenders = await send("Runtime.evaluate", { expression: "JSON.stringify({ cards: document.querySelectorAll('.preview-tender-card').length, expanded: document.querySelectorAll('.preview-tender-card.is-expanded').length, progress: document.querySelector('.preview-tender-overall b')?.textContent, bars: document.querySelectorAll('.preview-tender-overall [role=progressbar]').length, collapsed: [...document.querySelectorAll('.preview-tender-detail')].every((detail) => detail.getAttribute('aria-hidden') === 'true' && detail.getBoundingClientRect().height < 1), rulesOnPage: !!document.querySelector('.preview-tenders-scroll .preview-tenders-rules'), width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })", returnByValue: true });
    const tenderState = JSON.parse(tenders.result.value);
    if (tenderState.cards !== 2 || tenderState.expanded !== 0 || tenderState.progress !== "68%" || tenderState.bars !== 2 || !tenderState.collapsed || tenderState.rulesOnPage || tenderState.width > width || tenderState.height > height) throw new Error(`${width}x${height}: tenders ${JSON.stringify(tenderState)}`);
    const tenderImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-tenders-${width}x${height}.png`, Buffer.from(tenderImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-tenders-heading button')?.click()" });
    const help = await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-tender-dialog .preview-tenders-rules > div').length === 3 && document.querySelector('.preview-tender-dialog')?.textContent.includes('не возвращаются')", returnByValue: true });
    if (!help.result.value) throw new Error(`${width}x${height}: tender help failed`);
    const tenderHelpImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-tender-help-${width}x${height}.png`, Buffer.from(tenderHelpImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-tender-dialog .preview-asset-close')?.click(); document.querySelector('.preview-tender-banner')?.click()" });
    await wait(380);
    const expandedTender = await send("Runtime.evaluate", { expression: "JSON.stringify({ bars: document.querySelectorAll('.preview-tender-card.is-expanded [role=progressbar]').length, resources: [...document.querySelectorAll('.preview-tender-card.is-expanded .preview-tender-line > span')].map((item) => item.textContent), segmented: [...document.querySelectorAll('.preview-tender-card.is-expanded .preview-tender-line .preview-tender-track')].every((bar) => bar.children.length === 2 && bar.querySelector('.is-team')) })", returnByValue: true });
    const expandedState = JSON.parse(expandedTender.result.value);
    if (expandedState.bars !== 7 || expandedState.resources.join('|') !== 'Металл|Энергия|Дерево|Газ|Уголь|Жильё' || !expandedState.segmented) throw new Error(`${width}x${height}: tender details ${expandedTender.result.value}`);
    const expandedTenderImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-tender-expanded-${width}x${height}.png`, Buffer.from(expandedTenderImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-tender-contribute')?.click()" });
    const donation = await send("Runtime.evaluate", { expression: "!!document.querySelector('.preview-tender-dialog select')", returnByValue: true });
    if (!donation.result.value) throw new Error(`${width}x${height}: tender contribution dialog failed`);
    await send("Runtime.evaluate", { expression: "const input = document.querySelector('.preview-tender-dialog input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '2'); input.dispatchEvent(new Event('input', { bubbles: true }));" });
    await wait(50);
    await send("Runtime.evaluate", { expression: "document.querySelector('form.preview-tender-dialog')?.requestSubmit()" });
    const donated = await send("Runtime.evaluate", { expression: "JSON.stringify({ progress: document.querySelector('.preview-tender-overall b')?.textContent, metal: document.querySelector('.preview-tender-lines .preview-tender-line strong')?.textContent, dialogClosed: !document.querySelector('.preview-tender-dialog') })", returnByValue: true });
    const donatedState = JSON.parse(donated.result.value);
    if (donatedState.progress !== "69%" || donatedState.metal !== "62 / 85 ед." || !donatedState.dialogClosed) throw new Error(`${width}x${height}: tender donation ${donated.result.value}`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[1]?.click()" });
    await waitFor("document.querySelector('.preview-resource--metal strong')?.textContent === '16 ед.'");
    const stockAfterDonation = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-resource--metal strong')?.textContent", returnByValue: true });
    if (stockAfterDonation.result.value !== "16 ед.") throw new Error(`${width}x${height}: donated resources did not leave stock`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[3]?.click()" });
    await waitFor("document.querySelector('.preview-tender-overall b')?.textContent === '69%'");
    const persisted = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-tender-overall b')?.textContent", returnByValue: true });
    if (persisted.result.value !== "69%") throw new Error(`${width}x${height}: tender progress reset after tab switch`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-tender-banner')[1]?.click()" });
    const secondTender = await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-tender-card.is-expanded').length === 1 && document.querySelectorAll('.preview-tender-card')[1].classList.contains('is-expanded')", returnByValue: true });
    if (!secondTender.result.value) throw new Error(`${width}x${height}: second tender did not expand`);
    await wait(380);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-tender-banner')[1]?.click()" });
    await wait(380);
    const closedTender = await send("Runtime.evaluate", { expression: "JSON.stringify({ expanded: document.querySelectorAll('.preview-tender-card.is-expanded').length, collapsed: [...document.querySelectorAll('.preview-tender-detail')].every((detail) => detail.getBoundingClientRect().height < 1 && detail.getAttribute('aria-hidden') === 'true') })", returnByValue: true });
    if (closedTender.result.value !== '{"expanded":0,"collapsed":true}') throw new Error(`${width}x${height}: tender did not collapse: ${closedTender.result.value}`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-resource-sell')");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-resource-sell')?.click()" });
    await waitFor("!!document.querySelector('.preview-sale-dialog')");
    const saleDialog = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-sale-dialog')?.textContent.includes('Энергия') && document.querySelector('.preview-sale-dialog')?.textContent.includes('60 ₽/ед.') && document.documentElement.scrollWidth <= innerWidth", returnByValue: true });
    if (!saleDialog.result.value) throw new Error(`${width}x${height}: resource sale dialog failed`);
    const saleImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-resource-sale-${width}x${height}.png`, Buffer.from(saleImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "(() => { const slider = document.querySelector('.preview-sale-slider'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(slider, '2'); slider.dispatchEvent(new Event('input', { bubbles: true })); })()" });
    await waitFor("document.querySelector('#preview-sale-amount')?.value === '2'");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-sale-dialog .preview-market-confirm')?.click()" });
    await waitFor("!document.querySelector('.preview-sale-dialog') && document.querySelector('.preview-resource--energy strong')?.textContent === '24 ед.'");
    const saleResult = await send("Runtime.evaluate", { expression: "document.querySelector('.preview-player-balance-total strong')?.textContent.replace(/\\s/g, '')", returnByValue: true });
    if (saleResult.result.value !== '80120₽') throw new Error(`${width}x${height}: resource sale did not credit balance: ${saleResult.result.value}`);
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[4]?.click()" });
    await waitFor("document.querySelectorAll('.preview-combination-card').length === 8");
    const productionDefault = await send("Runtime.evaluate", { expression: "(() => { const nav = document.querySelectorAll('.preview-player-nav button'); const label = nav[4]?.querySelector('span'); return nav[4]?.textContent === 'Производство' && document.querySelectorAll('.preview-contracts-tabs button')[0]?.getAttribute('aria-selected') === 'true' && label?.getBoundingClientRect().left >= nav[4].getBoundingClientRect().left && label?.getBoundingClientRect().right <= nav[4].getBoundingClientRect().right; })()", returnByValue: true });
    if (!productionDefault.result.value) throw new Error(`${width}x${height}: production is not the default screen`);
    await waitFor("getComputedStyle(document.querySelector('.preview-player-view')).opacity === '1' && document.querySelector('.preview-player-view')?.getAttribute('aria-hidden') === 'false'");
    const catalog = await send("Runtime.evaluate", { expression: "JSON.stringify({ cards: document.querySelectorAll('.preview-combination-card').length, disabled: document.querySelectorAll('.preview-combination-actions .is-self:disabled').length, narrow: document.documentElement.scrollWidth <= innerWidth, height: document.documentElement.scrollHeight <= innerHeight, overviewHidden: getComputedStyle(document.querySelector('.preview-player-overview')).display === 'none' })", returnByValue: true });
    const catalogState = JSON.parse(catalog.result.value);
    if (catalogState.cards !== 8 || catalogState.disabled !== 0 || !catalogState.narrow || !catalogState.height || !catalogState.overviewHidden) throw new Error(`${width}x${height}: combinations ${catalog.result.value}`);
    const combinationImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-combinations-${width}x${height}.png`, Buffer.from(combinationImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-contracts-partner')");
    const contractsLayout = await send("Runtime.evaluate", { expression: "JSON.stringify({ nav: document.querySelectorAll('.preview-player-nav button').length, production: document.querySelectorAll('.preview-production-grid--own .preview-production-tile').length, partners: document.querySelectorAll('.preview-contracts-partner').length, rows: document.querySelectorAll('.preview-production-grid--partner .preview-production-tile').length, ownEnergy: [...document.querySelectorAll('.preview-production-grid--own .preview-production-tile:first-child .preview-production-tile-values strong')].map((cell) => cell.textContent).join('|'), partnerEnergy: [...document.querySelectorAll('.preview-production-grid--partner .preview-production-tile:first-child .preview-production-tile-values strong')].map((cell) => cell.textContent).join('|'), overflow: document.documentElement.scrollWidth > innerWidth })", returnByValue: true });
    const contractsState = JSON.parse(contractsLayout.result.value);
    if (contractsState.nav !== 5 || contractsState.production !== 6 || contractsState.partners !== 3 || contractsState.rows !== 6 || contractsState.ownEnergy !== "26|24" || contractsState.partnerEnergy !== "26|14" || contractsState.overflow) throw new Error(`${width}x${height}: production layout ${contractsLayout.result.value}`);
    const productionImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-contracts-production-${width}x${height}.png`, Buffer.from(productionImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[0]?.click()" });
    await waitFor("document.querySelectorAll('.preview-combination-card').length === 8");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-combinations-levels button')[1]?.click()" });
    await waitFor("document.querySelectorAll('.preview-combination-card').length === 4");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-combinations-levels button')[0]?.click()" });
    await waitFor("document.querySelectorAll('.preview-combination-card').length === 8");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-combination-card .is-self')?.click()" });
    await waitFor("!!document.querySelector('.preview-combination-dialog')");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-combination-dialog .preview-contracts-primary')?.click()" });
    await waitFor("!document.querySelector('.preview-combination-dialog') && document.querySelector('.preview-combination-card')?.textContent.includes('Готово: 1')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-combination-card')[1]?.querySelector('.is-team')?.click()" });
    await waitFor("!!document.querySelector('.preview-combination-dialog select')");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-combination-dialog .preview-contracts-primary')?.click()" });
    await waitFor("document.querySelectorAll('.preview-combination-card')[1]?.textContent.includes('Запрос: Команда Бета')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[1]?.click()" });
    await waitFor("document.querySelector('.preview-production-grid--own .preview-production-tile:first-child .preview-production-tile-values span:last-child strong')?.textContent === '19'");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[2]?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-card--incoming')");
    const incomingImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-contracts-incoming-${width}x${height}.png`, Buffer.from(incomingImage.data, "base64"));
    if (height <= 568) {
      await send("Runtime.evaluate", { expression: "document.querySelector('.preview-contracts-scroll').scrollTop = document.querySelector('.preview-contracts-scroll').scrollHeight" });
      const actionsReachable = await send("Runtime.evaluate", { expression: "(() => { const area = document.querySelector('.preview-contracts-scroll').getBoundingClientRect(); return [...document.querySelectorAll('.preview-contract-actions button')].every((button) => { const box = button.getBoundingClientRect(); return box.top >= area.top && box.bottom <= area.bottom; }); })()", returnByValue: true });
      if (!actionsReachable.result.value) throw new Error(`${width}x${height}: contract actions not reachable`);
    }
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contract-status-tabs button')[0]?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-card--active')");
    const activeImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-contracts-active-${width}x${height}.png`, Buffer.from(activeImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-contract-card--active .preview-contract-secondary')?.click()" });
    await waitFor("document.querySelector('.preview-contract-card--active .preview-contract-secondary')?.textContent.includes('Отменить')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contract-status-tabs button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-card--incoming .is-primary')");
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-contract-card--incoming .is-primary')?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-card--active') && document.querySelectorAll('.preview-contract-card--active').length === 2");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-contracts-partner')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-filters button')[3]?.click()" });
    await waitFor("document.querySelectorAll('.preview-contracts-partner').length === 2");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-filters button')[0]?.click(); document.querySelector('.preview-contracts-partner-body .preview-contracts-primary')?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-dialog')");
    const offerImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-contracts-offer-${width}x${height}.png`, Buffer.from(offerImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-contract-dialog')?.requestSubmit()" });
    await waitFor("document.querySelectorAll('.preview-contracts-offers article').length === 1");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[1]?.click()" });
    await waitFor("!!document.querySelector('.preview-assets-heading')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-player-nav button')[4]?.click()" });
    await waitFor("!!document.querySelector('.preview-contracts-tabs')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contracts-tabs button')[2]?.click()" });
    await waitFor("!!document.querySelector('.preview-contract-status-tabs')");
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.preview-contract-status-tabs button')[2]?.click()" });
    await waitFor("document.querySelectorAll('.preview-contract-card--outgoing').length === 1");
    await waitFor("getComputedStyle(document.querySelector('.preview-player-view')).opacity === '1'");
    const contractImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/player-contracts-list-${width}x${height}.png`, Buffer.from(contractImage.data, "base64"));
    await send("Runtime.evaluate", { expression: "document.querySelector('.preview-contract-card--outgoing .preview-contract-secondary')?.click()" });
    await waitFor("!!document.querySelector('.preview-contracts-empty')");
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
