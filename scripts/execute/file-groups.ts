export type FileGroup = {
  description: string;
  extensions: string[];
};

export const fileGroups: Record<string, FileGroup> = {
  subtitles: {
    description: "Subtitle files",
    extensions: ["srt", "vtt", "ass", "ssa", "sub"],
  },
  images: {
    description: "Image files",
    extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "svg"],
  },
  text: {
    description: "Text files",
    extensions: ["txt", "md", "log"],
  },
};

export const fileGroupNames = Object.keys(fileGroups);
