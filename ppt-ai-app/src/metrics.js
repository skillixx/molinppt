/**
 * In-memory metrics registry that renders a Prometheus-compatible text snapshot.
 */
export class MetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.summaries = new Map();
  }

  /**
   * Increments a labeled counter.
   * @param {string} name
   * @param {Record<string, string | number | boolean>} labels
   * @param {number} value
   * @returns {void}
   */
  increment(name, labels = {}, value = 1) {
    const key = metricKey(name, labels);
    const current = this.counters.get(key) || { name, labels: normalizeLabels(labels), value: 0 };
    current.value += value;
    this.counters.set(key, current);
  }

  /**
   * Observes a numeric value as count and sum series.
   * @param {string} name
   * @param {Record<string, string | number | boolean>} labels
   * @param {number} value
   * @returns {void}
   */
  observe(name, labels = {}, value = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const key = metricKey(name, labels);
    const current = this.summaries.get(key) || { name, labels: normalizeLabels(labels), count: 0, sum: 0 };
    current.count += 1;
    current.sum += numeric;
    this.summaries.set(key, current);
  }

  /**
   * Renders metrics in the Prometheus text exposition format.
   * @returns {string}
   */
  renderPrometheus() {
    const lines = [];
    for (const metric of [...this.counters.values()].sort(compareMetrics)) {
      lines.push(`${metric.name}${renderLabels(metric.labels)} ${formatMetricValue(metric.value)}`);
    }
    for (const metric of [...this.summaries.values()].sort(compareMetrics)) {
      lines.push(`${metric.name}_count${renderLabels(metric.labels)} ${formatMetricValue(metric.count)}`);
      lines.push(`${metric.name}_sum${renderLabels(metric.labels)} ${formatMetricValue(metric.sum)}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function metricKey(name, labels) {
  const normalized = normalizeLabels(labels);
  return `${name}:${JSON.stringify(normalized)}`;
}

function normalizeLabels(labels) {
  return Object.fromEntries(Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, String(value)]));
}

function renderLabels(labels) {
  const entries = Object.entries(labels);
  if (!entries.length) return "";
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(",")}}`;
}

function escapeLabel(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function formatMetricValue(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function compareMetrics(left, right) {
  return `${left.name}${JSON.stringify(left.labels)}`.localeCompare(`${right.name}${JSON.stringify(right.labels)}`);
}
