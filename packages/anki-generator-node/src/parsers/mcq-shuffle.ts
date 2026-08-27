import { MCQParser } from "./mcq.js";

export class MCQShuffleParser extends MCQParser {
  override getTemplateName(): string {
    return "mcq-shuffle";
  }
}
