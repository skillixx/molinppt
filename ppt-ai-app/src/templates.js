import { AppError } from "./errors.js";

/**
 * Built-in template catalog used when no external catalog is configured.
 */
export const DEFAULT_TEMPLATES = [
  {
    id: "business",
    name: "Business",
    style: "clean",
    themes: ["modern", "classic", "executive"],
  },
  {
    id: "education",
    name: "Education",
    style: "structured",
    themes: ["lecture", "workshop", "minimal"],
  },
  {
    id: "pitch",
    name: "Pitch",
    style: "storytelling",
    themes: ["startup", "investor", "product"],
  },
];

/**
 * Registry for PPT template metadata.
 */
export class TemplateManager {
  /**
   * Creates a template manager.
   * @param {{templates?: object[]}} input
   */
  constructor({ templates = DEFAULT_TEMPLATES } = {}) {
    this.templates = templates;
  }

  /**
   * Lists all available templates.
   * @returns {object[]}
   */
  listTemplates() {
    return this.templates;
  }

  /**
   * Returns one template by ID.
   * @param {string} templateId
   * @returns {object}
   */
  getTemplate(templateId) {
    const template = this.templates.find((item) => item.id === templateId);
    if (!template) throw new AppError({ code: "TEMPLATE_NOT_FOUND", status: 404, message: "Template not found" });
    return template;
  }
}
