const baseUrl = process.env.ACCEPTANCE_BASE_URL || "http://127.0.0.1:5177";
const entitlementId = Number(
  process.env.ACCEPTANCE_ENTITLEMENT_ID
    || process.env.LOCAL_MOLING_ENTITLEMENT_ID
    || process.env.MOLING_DEFAULT_ENTITLEMENT_ID
    || process.env.PPT_DEFAULT_ENTITLEMENT_ID
    || 88,
);

const launch = await fetch(`${baseUrl}/enter?ticket=local_acceptance`, { redirect: "manual" });
if (launch.status !== 302) throw new Error(`launch failed: ${launch.status}`);
const cookie = launch.headers.get("set-cookie").split(";")[0];
const templates = await get("/api/templates");
if (templates.templates.length < 3 || !templates.templates.every((template) => template.themes?.length)) {
  throw new Error("template catalog failed");
}
const initialBalance = await get("/api/billing/balance");
if (Number(initialBalance.entitlement_id) !== entitlementId) throw new Error("balance entitlement mismatch");

const outline = await post("/api/ppt/outlines", {
  topic: "第三阶段验收",
  slide_count: 3,
  template_id: "business",
  theme: "modern",
});
await patch(`/api/ppt/outlines/${outline.outline.id}`, {
  slides: outline.outline.slides.map((slide, index) => ({
    ...slide,
    title: `${slide.title} - edited ${index + 1}`,
  })),
});
const deck = await post("/api/ppt/decks", {
  outline_id: outline.outline.id,
  entitlement_id: entitlementId,
});
const task = await get(`/api/ppt/tasks/${deck.task.id}`);
if (task.task.status !== "succeeded" || task.task.progress !== 100) throw new Error("task status failed");
const regenerated = await post(`/api/ppt/decks/${deck.deck.id}/slides/${deck.deck.slides[0].id}/regenerate`, {
  instruction: "改写为验收版",
  entitlement_id: entitlementId,
});
if (!regenerated.slide?.title) throw new Error("slide regeneration failed");
const preview = await fetch(`${baseUrl}/api/ppt/decks/${deck.deck.id}/preview`, { headers: { cookie } });
if (!preview.ok || !(await preview.text()).includes("第三阶段验收")) throw new Error("preview failed");
const pptx = await post(`/api/ppt/decks/${deck.deck.id}/exports`, { format: "pptx" });
const pdf = await post(`/api/ppt/decks/${deck.deck.id}/exports`, { format: "pdf" });
const logs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie } }).then((response) => response.json());
if (!pptx.file?.id || !pdf.file?.id || logs.logs.length < 5) throw new Error("exports or logs failed");

console.log(JSON.stringify({
  status: "passed",
  outline_id: outline.outline.id,
  deck_id: deck.deck.id,
  task_id: task.task.id,
  regenerated_slide_id: regenerated.slide.id,
  pptx_file_id: pptx.file.id,
  pdf_file_id: pdf.file.id,
  log_count: logs.logs.length,
}, null, 2));

/**
 * Sends a JSON GET request in the acceptance flow.
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
 * Sends a JSON POST request in the acceptance flow.
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
 * Sends a JSON PATCH request in the acceptance flow.
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
