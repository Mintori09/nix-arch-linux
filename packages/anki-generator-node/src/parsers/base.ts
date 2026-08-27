import type { ParsedResult } from "../types/index.js";

export abstract class BaseParser {
  abstract getFieldNames(): readonly string[];
  abstract getTemplateName(): string;
  abstract parse(rawJson: string): Promise<ParsedResult>;
}
