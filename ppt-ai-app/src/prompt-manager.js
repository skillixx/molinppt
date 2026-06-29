/**
 * Builds prompt payloads for AI PPT workflows.
 */
export class PromptManager {
  /**
   * Builds an outline-generation prompt.
   * @param {{topic?: string, documentText?: string, slideCount: number, theme?: string}} input
   * @returns {object}
   */
  buildOutlinePrompt({ topic, documentText, slideCount, theme }) {
    return {
      kind: "outline",
      topic: topic || "Document generated presentation",
      documentText: documentText || "",
      slideCount,
      theme: theme || "modern",
    };
  }

  /**
   * Builds a deck-generation prompt.
   * @param {{outline: object, template: object}} input
   * @returns {object}
   */
  buildDeckPrompt({ outline, template }) {
    return {
      kind: "deck",
      outline,
      template,
    };
  }

  /**
   * Builds a single-slide regeneration prompt.
   * @param {{slide: object, instruction: string}} input
   * @returns {object}
   */
  buildRegenerateSlidePrompt({ slide, instruction }) {
    return {
      kind: "regenerate_slide",
      slide,
      instruction,
    };
  }
}
