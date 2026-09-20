import type { ParsedResult, ParserOptions } from "../types/index.js";

export abstract class BaseParser {
  abstract getFieldNames(): readonly string[];
  abstract getTemplateName(): string;
  abstract parse(rawJson: string, options?: ParserOptions): Promise<ParsedResult>;
}

