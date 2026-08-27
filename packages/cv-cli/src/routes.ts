import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import {
  ffmpeg,
  imageMagick,
  pandoc,
  libreOffice,
  sanitizeImagePaths,
  xlsx2csvConverter,
  markitdownConverter,
  yq,
  pdfToImage,
  mhtmlToImage,
  type ToolConverter,
} from "./converters/index.ts";
import {
  mdToPdf,
  epubToPdf,
  mdToHtml,
  epubToMd,
} from "./converters/document.ts";

const H264_AAC = ["-c:v", "libx264", "-c:a", "aac"] as const;
const VP9_OPUS = ["-c:v", "libvpx-vp9", "-c:a", "libopus"] as const;
const MP3_AUDIO = ["-vn", "-b:a", "192k"] as const;

export const ROUTES: Record<string, ToolConverter> = {
  "mp4:mkv": ffmpeg(H264_AAC),
  "mkv:mp4": ffmpeg(H264_AAC),
  "mov:mp4": ffmpeg(H264_AAC),
  "avi:mp4": ffmpeg(H264_AAC),
  "webm:mp4": ffmpeg(H264_AAC),
  "flv:mp4": ffmpeg(H264_AAC),
  "mp4:webm": ffmpeg(VP9_OPUS),
  "mkv:webm": ffmpeg(VP9_OPUS),
  "mp4:mp3": ffmpeg(MP3_AUDIO),
  "wav:mp3": ffmpeg(MP3_AUDIO),
  "flac:mp3": ffmpeg(MP3_AUDIO),
  "m4a:mp3": ffmpeg(MP3_AUDIO),
  "ogg:mp3": ffmpeg(MP3_AUDIO),
  "mp3:wav": ffmpeg(["-vn"]),
  "mp3:ogg": ffmpeg(["-vn"]),
  "gif:mp4": ffmpeg(["-movflags", "+faststart", "-pix_fmt", "yuv420p"]),
  "png:jpg": imageMagick(),
  "svg:png": imageMagick(),
  "jpg:png": imageMagick(),
  "webp:png": imageMagick(),
  "heic:jpg": imageMagick(),
  "png:webp": imageMagick(),
  "jpg:webp": imageMagick(),
  "webp:jpg": imageMagick(),
  "tiff:png": imageMagick(),
  "bmp:png": imageMagick(),
  "icns:png": imageMagick(),
  "mhtml:png": mhtmlToImage("png"),
  "mhtml:jpg": mhtmlToImage("jpg"),
  "mhtml:webp": mhtmlToImage("webp"),
  "md:pdf": mdToPdf(),
  "md:docx": pandoc(),
  "doc:md": {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      const tmpDir = await mkdtemp(path.join(tmpdir(), "cv-doc-"));
      try {
        const docxPath = path.join(
          tmpDir,
          `${path.basename(input, path.extname(input))}.docx`,
        );
        await libreOffice("docx").convert(input, docxPath, context);
        await pandoc().convert(docxPath, output, context);
        const mdMediaDir = `${output.replace(/\.[^/.]+$/, "")}_media/`;
        await sanitizeImagePaths(output, mdMediaDir, context.dryRun);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    },
  },
  "docx:md": pandoc(),
  "md:html": mdToHtml(),
  "html:md": markitdownConverter(),
  "docx:html": pandoc({ from: "docx", to: "html" }),
  "txt:md": pandoc(),
  "rst:md": pandoc({ from: "rst", to: "markdown" }),
  "md:epub": pandoc({
    from: "markdown",
    to: "epub",
    paramsFromContext: (context, _input, output) => {
      return ["-M", `title:${path.basename(output).replace(/\.[^/.]+$/, "")}`];
    },
  }),
  "docx:epub": pandoc({
    from: "docx",
    to: "epub",
    paramsFromContext: (context, _input, output) => {
      return ["-M", `title:${path.basename(output).replace(/\.[^/.]+$/, "")}`];
    },
  }),
  "epub:md": epubToMd(),
  "epub:pdf": epubToPdf(),
  "docx:pdf": libreOffice("pdf"),
  "docx:txt": pandoc({ from: "docx", to: "plain" }),
  "xlsx:pdf": libreOffice("pdf"),
  "xlsx:csv": xlsx2csvConverter(),
  "pptx:pdf": libreOffice("pdf"),
  "odt:pdf": libreOffice("pdf"),
  "ods:pdf": libreOffice("pdf"),
  "odp:pdf": libreOffice("pdf"),
  "doc:pdf": libreOffice("pdf"),
  "xls:pdf": libreOffice("pdf"),
  "ppt:pdf": libreOffice("pdf"),
  "pdf:png": pdfToImage("png", "png"),
  "pdf:jpg": pdfToImage("jpeg", "jpg"),
  "pdf:webp": pdfToImage("png", "webp"),
  "json:yaml": yq("json", "yaml"),
  "yaml:json": yq("yaml", "json"),
  "toml:json": yq("toml", "json"),
  "yaml:toml": yq("yaml", "toml"),
  "toml:yaml": yq("toml", "yaml"),
  "json:toml": yq("json", "toml"),
  "json:csv": yq("json", "csv"),
  "csv:json": yq("csv", "json"),
  "xml:json": yq("xml", "json"),
};
