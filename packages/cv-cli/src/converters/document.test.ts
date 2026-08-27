import { describe, it } from "node:test";
import assert from "node:assert/strict";

const opfFixture = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>The Great Book</dc:title>
    <dc:creator opf:role="aut">Author Name</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Big Publisher</dc:publisher>
    <dc:identifier id="isbn" opf:scheme="ISBN">978-1234567890</dc:identifier>
    <dc:identifier id="uuid">urn:uuid:some-uuid</dc:identifier>
    <dc:date>2024-01-15</dc:date>
    <dc:description>A compelling description.</dc:description>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="images/cover.jpeg" media-type="image/jpeg"/>
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>`;

const opfNoCover = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>No Cover Book</dc:title>
    <dc:creator>Unknown</dc:creator>
  </metadata>
</package>`;

const opfMinimal = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Minimal</dc:title>
  </metadata>
</package>`;

async function loadModule() {
  return import("./document.ts");
}

describe("parseOpfMetadata", () => {
  it("extracts all metadata fields from complete OPF", async () => {
    const mod = await loadModule();
    const meta = mod.parseOpfMetadata(opfFixture);
    assert.deepStrictEqual(meta, {
      title: "The Great Book",
      author: "Author Name",
      language: "en",
      publisher: "Big Publisher",
      isbn: "978-1234567890",
      description: "A compelling description.",
      pubdate: "2024-01-15",
    });
  });

  it("returns partial metadata when fields are missing", async () => {
    const mod = await loadModule();
    const meta = mod.parseOpfMetadata(opfMinimal);
    assert.strictEqual(meta.title, "Minimal");
    assert.strictEqual(meta.author, undefined);
    assert.strictEqual(meta.isbn, undefined);
  });

  it("handles empty string", async () => {
    const mod = await loadModule();
    const meta = mod.parseOpfMetadata("");
    assert.deepStrictEqual(meta, {});
  });
});

describe("findCoverRef", () => {
  it("finds cover jpeg reference from OPF", async () => {
    const mod = await loadModule();
    const cover = mod.findCoverRef(opfFixture, "OEBPS");
    assert.deepStrictEqual(cover, {
      href: "OEBPS/images/cover.jpeg",
      ext: "jpg",
    });
  });

  it("returns null when no cover meta", async () => {
    const mod = await loadModule();
    const cover = mod.findCoverRef(opfNoCover, "OEBPS");
    assert.strictEqual(cover, null);
  });

  it("returns null for empty OPF", async () => {
    const mod = await loadModule();
    const cover = mod.findCoverRef("", "OEBPS");
    assert.strictEqual(cover, null);
  });
});
