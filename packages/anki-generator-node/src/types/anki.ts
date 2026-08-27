import type { Buffer } from "node:buffer";

export interface VocabItem {
  word: string;
  ipa: string;
  word_class: string;
  definition: string;
  meaning_vn: string;
  meaning_jp: string;
  example: string;
  example_vn: string;
  example_jp: string;
  collocations: string;
  image_prompt: string;
}

export interface GrammarItem {
  pattern: string;
  formula: string;
  explanation: string;
  meaning_vn: string;
  meaning_jp: string;
  example: string;
  example_vn: string;
  example_jp: string;
  usage_notes: string;
  image_prompt?: string;
}

export interface MCQItem {
  question: string;
  options: Record<string, string>;
  answer: string; // "a", "b", "c", "d" etc.
  explanation?: string;
}

export interface MCQListeningItem {
  image?: string;
  image_prompt?: string;
  audio?: string;
  audio_text?: string;
  question?: string;
  options: Record<string, string>;
  answer: string | string[]; // "a", "a, b" or ["a", "b"]
  explanation?: string;
}

export interface BasicItem {
  front: string;
  back: string;
}

export interface JpVocabItem {
  meta?: {
    id?: string;
    jlpt_level?: string;
    frequency_rank?: number;
    tags?: string[];
  };
  vocabulary: {
    kanji_expression: string;
    kana_reading: string;
    furigana_format: string;
    pitch_accent?: string;
    pitch_graph_url?: string;
    part_of_speech: string;
    meaning_vi: string;
  };
  context?: {
    sentence_jp?: string;
    sentence_furigana?: string;
    sentence_translation?: string;
    cloze_front?: string;
  };
  media?: {
    word_audio?: string;
    sentence_audio?: string;
    image_hint?: string;
  };
  notes?: {
    mnemonic?: string;
    nuance?: string;
  };
}

export interface JpGrammarItem {
  meta?: {
    id?: string;
    jlpt_level?: string;
    tags?: string[];
  };
  grammar: {
    pattern: string;
    reading?: string;
    formula: string;
    meaning_vi: string;
    meaning_en?: string;
    meaning_jp?: string;
    explanation?: string;
  };
  example?: {
    sentence_jp?: string;
    sentence_furigana?: string;
    sentence_translation?: string;
    sentence_translation_vi?: string;
    sentence_translation_en?: string;
  };
  media?: {
    pattern_audio?: string;
    sentence_audio?: string;
    image_hint?: string;
  };
  notes?: {
    usage_notes?: string;
    usage_notes_en?: string;
    related_grammar?: string;
  };
}

export interface ParsedCard {
  frontKeyField: string;
  fields: Record<string, string>;
}

export interface MediaAsset {
  filename: string;
  buffer: Buffer;
}

export interface ParsedResult {
  cards: ParsedCard[];
  media: MediaAsset[];
}
