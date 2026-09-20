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

describe("mdToEpub", () => {
  it("converts directory of markdown files to epub in dry-run with natural sorting and auto metadata/cover", async () => {
    const mod = await loadModule();
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");

    const tmp = await mkdtemp(path.join(tmpdir(), "cv-test-md-epub-"));
    try {
      // Create chapters out of order
      await writeFile(path.join(tmp, "chapter-10.md"), "# Chapter 10");
      await writeFile(path.join(tmp, "chapter-1.md"), "# Chapter 1");
      await writeFile(path.join(tmp, "chapter-2.md"), "# Chapter 2");
      await writeFile(
        path.join(tmp, "metadata.json"),
        JSON.stringify({ title: "Custom Novel Title", author: "Alice" }),
      );
      await writeFile(path.join(tmp, "cover.jpg"), "fake jpg");

      const executedCommands: string[][] = [];
      const origLog = console.log;
      console.log = (msg?: unknown) => {
        if (typeof msg === "string" && msg.includes("[dry-run]")) {
          executedCommands.push(msg.split(" "));
        }
      };

      try {
        const converter = mod.mdToEpub();
        await converter.convert(tmp, "/tmp/out.epub", {
          dryRun: true,
          flags: {},
          route: "dir:epub",
          passthroughArgs: [],
        });
      } finally {
        console.log = origLog;
      }

      assert.strictEqual(executedCommands.length, 1);
      const cmdStr = executedCommands[0].join(" ");
      assert.ok(cmdStr.includes("pandoc"));
      // Verify natural sorting: chapter-1 before chapter-2 before chapter-10
      const idx1 = cmdStr.indexOf("chapter-1.md");
      const idx2 = cmdStr.indexOf("chapter-2.md");
      const idx10 = cmdStr.indexOf("chapter-10.md");
      assert.ok(idx1 !== -1 && idx2 !== -1 && idx10 !== -1);
      assert.ok(idx1 < idx2, "chapter-1 must come before chapter-2");
      assert.ok(idx2 < idx10, "chapter-2 must come before chapter-10");

      // Verify metadata & cover
      assert.ok(cmdStr.includes(`--metadata-file=${path.join(tmp, "metadata.json")}`));
      assert.ok(cmdStr.includes(`--epub-cover-image=${path.join(tmp, "cover.jpg")}`));
      // Title already in metadata.json, so -M title: should NOT be present
      assert.ok(!cmdStr.includes("-M title:"), "Should not override title if present in metadata");
      assert.ok(cmdStr.includes("--toc"), "Should include --toc by default");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("adds fallback title if metadata does not contain title", async () => {
    const mod = await loadModule();
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");

    const tmp = await mkdtemp(path.join(tmpdir(), "cv-test-no-meta-"));
    try {
      await writeFile(path.join(tmp, "ch1.md"), "# Chapter 1");

      const executedCommands: string[][] = [];
      const origLog = console.log;
      console.log = (msg?: unknown) => {
        if (typeof msg === "string" && msg.includes("[dry-run]")) {
          executedCommands.push(msg.split(" "));
        }
      };

      try {
        const converter = mod.mdToEpub();
        await converter.convert(tmp, "/tmp/my-story.epub", {
          dryRun: true,
          flags: {},
          route: "dir:epub",
          passthroughArgs: [],
        });
      } finally {
        console.log = origLog;
      }

      assert.strictEqual(executedCommands.length, 1);
      const cmdStr = executedCommands[0].join(" ");
      assert.ok(cmdStr.includes("-M title:my-story"));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("handles multiple input files passed via context.inputs", async () => {
    const mod = await loadModule();
    const executedCommands: string[][] = [];
    const origLog = console.log;
    console.log = (msg?: unknown) => {
      if (typeof msg === "string" && msg.includes("[dry-run]")) {
        executedCommands.push(msg.split(" "));
      }
    };

    try {
      const converter = mod.mdToEpub();
      await converter.convert("a.md", "/tmp/book.epub", {
        dryRun: true,
        flags: { toc: false },
        route: "md:epub",
        passthroughArgs: [],
        inputs: ["a.md", "b.md", "c.md"],
      });
    } finally {
      console.log = origLog;
    }

    assert.strictEqual(executedCommands.length, 1);
    const cmdStr = executedCommands[0].join(" ");
    assert.ok(cmdStr.includes("pandoc a.md b.md c.md"));
    assert.ok(!cmdStr.includes("--toc"), "TOC should be omitted when flags.toc is false");
  });
});
