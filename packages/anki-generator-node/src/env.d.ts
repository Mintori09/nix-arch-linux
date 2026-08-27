declare module "anki-apkg-export" {
  export class Exporter {
    constructor(
      deckName: string,
      options: { template: string; sql: { Database: new (...args: any[]) => any } },
    );
    addMedia(filename: string, data: Buffer): void;
    addCard(front: string, back: string, options?: { tags?: string[] | string }): void;
    save(): Promise<Buffer>;
    _update(query: string, params: Record<string, any>): void;
    _getId(table: string, col: string, ts: number): number;
    _getNoteId(guid: string, ts: number): number;
    _getCardId(nid: number, ts: number): number;
    topModelId: number;
    topDeckId: number;
  }

  const _default: (
    deckName: string,
    template?: { questionFormat?: string; answerFormat?: string; css?: string },
  ) => Exporter;
  export default _default;
}
