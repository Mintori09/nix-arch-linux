export interface Heading {
  level: number;
  title: string;
}

export function slugify(title: string): string {
  const slug = title.toLowerCase();
  const noSpecialChars = slug.replace(/[^\w\s-]/g, "");
  return noSpecialChars.replace(/\s+/g, "-");
}
