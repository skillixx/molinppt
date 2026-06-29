import { AppError } from "./errors.js";

/**
 * Registry for PPT template metadata.
 */
export class TemplateManager {
  /**
   * Creates a template manager.
   * @param {{templates?: object[]}} input
   */
  constructor({ templates = [] } = {}) {
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
