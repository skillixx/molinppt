const baseUrl = process.env.ACCEPTANCE_BASE_URL || "http://127.0.0.1:5177";
const launchTicket = process.env.ACCEPTANCE_LAUNCH_TICKET;
const entitlementId = process.env.ACCEPTANCE_ENTITLEMENT_ID ? Number(process.env.ACCEPTANCE_ENTITLEMENT_ID) : undefined;

if (!launchTicket) {
  throw new Error("ACCEPTANCE_LAUNCH_TICKET is required for real Moling acceptance");
}

const launch = await fetch(`${baseUrl}/enter?ticket=${encodeURIComponent(launchTicket)}`, { redirect: "manual" });
if (launch.status !== 302) throw new Error(`launch failed: ${launch.status}`);
const cookie = launch.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("launch did not return a session cookie");

const me = await get("/api/me");
const templates = await get("/api/templates");
if (!me.user?.user_id) throw new Error("current user check failed");
if (templates.templates.length < 3 || !templates.templates.every((template) => template.themes?.length)) {
  throw new Error("template catalog failed");
}

const initialBalance = await get(entitlementId ? `/api/billing/balance?entitlement_id=${entitlementId}` : "/api/billing/balance");
const resolvedEntitlementId = entitlementId || Number(initialBalance.entitlement_id);
if (!resolvedEntitlementId) throw new Error("entitlement resolution failed");
const expectedDebit = 8;

const template = templates.templates[0];
const outline = await post("/api/ppt/outlines", {
  topic: "真实墨灵验收",
  slide_count: 3,
  template_id: template.id,
  theme: template.themes[0],
});
const edited = await patch(`/api/ppt/outlines/${outline.outline.id}`, {
  slides: outline.outline.slides.map((slide, index) => ({
    ...slide,
    title: `${slide.title} - real acceptance ${index + 1}`,
  })),
});
if (edited.outline.status !== "outline_edited") throw new Error("outline edit failed");

const deck = await post("/api/ppt/decks", {
  outline_id: outline.outline.id,
  entitlement_id: resolvedEntitlementId,
});
if (deck.task.status !== "succeeded") throw new Error("deck generation did not succeed");
const task = await get(`/api/ppt/tasks/${deck.task.id}`);
if (task.task.status !== "succeeded" || task.task.progress !== 100) throw new Error("task status failed");

const regenerated = await post(`/api/ppt/decks/${deck.deck.id}/slides/${deck.deck.slides[0].id}/regenerate`, {
  instruction: "改写为真实验收版",
  entitlement_id: resolvedEntitlementId,
});
if (!regenerated.slide?.title) throw new Error("slide regeneration failed");

const preview = await fetch(`${baseUrl}/api/ppt/decks/${deck.deck.id}/preview`, { headers: { cookie } });
if (!preview.ok || !(await preview.text()).includes("真实墨灵验收")) throw new Error("preview failed");
const pptx = await post(`/api/ppt/decks/${deck.deck.id}/exports`, { format: "pptx" });
const pdf = await post(`/api/ppt/decks/${deck.deck.id}/exports`, { format: "pdf" });
const downloadedPptx = await downloadFile(pptx.file);
const downloadedPdf = await downloadFile(pdf.file);
const logs = await get("/api/logs");
const finalBalance = await get(`/api/billing/balance?entitlement_id=${resolvedEntitlementId}`);

if (!pptx.file?.id || !pdf.file?.id || downloadedPptx.byteLength === 0 || downloadedPdf.byteLength === 0) {
  throw new Error("exports or downloads failed");
}
if (!logs.logs.some((log) => log.action === "file_downloaded" && log.resourceId === pptx.file.id)) {
  throw new Error("download log failed");
}
assertBalanceDeducted({ initialBalance, finalBalance, expectedDebit });

console.log(JSON.stringify({
  status: "passed",
  user_id: me.user.user_id,
  entitlement_id: resolvedEntitlementId,
  initial_remaining: initialBalance.balance?.remaining,
  final_remaining: finalBalance.balance?.remaining,
  expected_debit: expectedDebit,
  outline_id: outline.outline.id,
  deck_id: deck.deck.id,
  task_id: task.task.id,
  regenerated_slide_id: regenerated.slide.id,
  pptx_file_id: pptx.file.id,
  pdf_file_id: pdf.file.id,
  pptx_download_bytes: downloadedPptx.byteLength,
  pdf_download_bytes: downloadedPdf.byteLength,
  log_count: logs.logs.length,
}, null, 2));

/**
 * Sends a JSON GET request in the real Moling acceptance flow.
 * @param {string} path
 * @returns {Promise<object>}
 */
async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Sends a JSON POST request in the real Moling acceptance flow.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<object>}
 */
async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Sends a JSON PATCH request in the real Moling acceptance flow.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<object>}
 */
async function patch(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Downloads an exported file and verifies the filename header.
 * @param {{id: string, fileName: string}} file
 * @returns {Promise<ArrayBuffer>}
 */
async function downloadFile(file) {
  const response = await fetch(`${baseUrl}/api/files/${file.id}`, { headers: { cookie } });
  const disposition = response.headers.get("content-disposition") || "";
  if (!response.ok || !disposition.includes(`filename="${file.fileName}"`)) {
    throw new Error(`download failed: ${file.id}`);
  }
  return response.arrayBuffer();
}

/**
 * Verifies that paid acceptance operations consumed the expected credits.
 * @param {{initialBalance: object, finalBalance: object, expectedDebit: number}} input
 * @returns {void}
 */
function assertBalanceDeducted({ initialBalance, finalBalance, expectedDebit }) {
  const initial = Number(initialBalance.balance?.remaining);
  const final = Number(finalBalance.balance?.remaining);
  if (!Number.isFinite(initial) || !Number.isFinite(final) || initial - final !== expectedDebit) {
    throw new Error(`credit deduction failed: expected ${expectedDebit}, got ${initial - final}`);
  }
}
