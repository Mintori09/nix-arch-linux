import os
import re
import sys

from docx import Document


def slugify(title):
    """Chuyển đổi tiêu đề thành anchor link slug (Ví dụ: '1. Cài đặt' -> '1-cài-đặt')"""
    slug = title.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)  # Xóa ký tự đặc biệt
    slug = re.sub(r"\s+", "-", slug)  # Thay khoảng trắng thành '-'
    return slug


def process_markdown(file_path):
    """Quét và lấy tiêu đề từ file Markdown"""
    toc = []
    in_code_block = False

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                continue

            match = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
            if match:
                level = len(match.group(1))
                title = match.group(2).strip()
                toc.append((level, title))
    return toc


def process_docx(file_path):
    """Quét và lấy tiêu đề từ file Word (.docx) dựa trên Style Heading"""
    toc = []
    doc = Document(file_path)

    for p in doc.paragraphs:
        # Kiểm tra style của paragraph có phải là Heading không (Ví dụ: 'Heading 1', 'Heading 2'...)
        if p.style.name.startswith("Heading"):
            try:
                # Lấy cấp độ từ tên Style (Ví dụ: 'Heading 2' -> level = 2)
                level = int(p.style.name.split()[-1])
                title = p.text.strip()
                if title:  # Bỏ qua dòng trống
                    toc.append((level, title))
            except ValueError:
                # Đề phòng trường hợp style có tên đặc biệt không chứa số ở cuối
                continue
    return toc


def generate_toc(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: Không tìm thấy file '{file_path}'")
        return

    ext = os.path.splitext(file_path)[1].lower()

    # Nhận diện đuôi file để xử lý
    if ext == ".md":
        print(f"📝 Đang xử lý file Markdown: {file_path}")
        headings = process_markdown(file_path)
    elif ext == ".docx":
        print(f"📄 Đang xử lý file Word Docx: {file_path}")
        headings = process_docx(file_path)
    else:
        print("⚠️ Định dạng file không được hỗ trợ! Chỉ nhận file .md hoặc .docx")
        return

    if not headings:
        print("📭 Không tìm thấy tiêu đề nào trong file.")
        return

    # Tạo nội dung mục lục dạng Markdown
    toc_lines = []
    for level, title in headings:
        indent = "  " * (level - 1)
        slug = slugify(title)
        toc_lines.append(f"{indent}- [{title}](#{slug})")

    # In kết quả
    print("\n## MỤC LỤC GENERATED:\n")
    print("\n".join(toc_lines))
    print("\n" + "-" * 40 + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
    else:
        # Bạn có thể đổi tên file mặc định ở đây để test nhanh
        target_file = "document.docx"
        print(f"Chạy mặc định với file: {target_file}")

    generate_toc(target_file)
