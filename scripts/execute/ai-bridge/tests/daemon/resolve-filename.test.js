import { describe, it, expect } from "vitest";

function resolveFilename(name) {
  if (!name) return "";

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")

    .replace(
      /[^a-zA-Z0-9_-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF]/g,
      "_",
    )

    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

describe("resolveFilename()", () => {
  it("nên xử lý tốt tiếng Anh cơ bản và ký tự số", () => {
    expect(resolveFilename("Hello World 2026")).toBe("hello_world_2026");
    expect(resolveFilename("file-name_v1")).toBe("file-name_v1");
  });

  it("nên xử lý tốt tiếng Việt (bỏ dấu, chuyển đ -> d, viết thường)", () => {
    expect(resolveFilename("Báo Cáo Tài Chính")).toBe("bao_cao_tai_chinh");
    expect(resolveFilename("Đường Đời")).toBe("duong_doi");
    expect(resolveFilename("Khánh Hòa _ Nha Trang")).toBe(
      "khanh_hoa_nha_trang",
    );
  });

  // it("nên giữ nguyên ký tự tiếng Nhật (Kanji, Hiragana, Katakana)", () => {
  //   expect(resolveFilename("日本語のファイル名")).toBe("日本語のファイル名");
  //   expect(resolveFilename("プロジェクトA")).toBe("プロジェクトa"); // Chữ A latin bị viết thường
  // });

  it("nên dọn dẹp các ký tự đặc biệt và dấu cách thừa", () => {
    expect(resolveFilename("file/name*với?ký@tự!đặc#biệt")).toBe(
      "file_name_voi_ky_tu_dac_biet",
    );
    expect(resolveFilename("___tên_file_bị_dính_gạch___")).toBe(
      "ten_file_bi_dinh_gach",
    );
    expect(resolveFilename("tiếng Nhật (2026) #1")).toBe("tieng_nhat_2026_1");
  });

  it("nên xử lý an toàn các trường hợp dữ liệu trống/sai", () => {
    expect(resolveFilename("")).toBe("");
    expect(resolveFilename(null)).toBe("");
    expect(resolveFilename(undefined)).toBe("");
  });
});
