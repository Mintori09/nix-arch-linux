import os
import re
import sys
import warnings

# Suppress ebooklib and other third-party parsing warnings
warnings.filterwarnings("ignore")


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

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
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
    from docx import Document

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


def process_html(file_path):
    """Quét và lấy tiêu đề từ file HTML (.html, .htm)"""
    from bs4 import BeautifulSoup

    toc = []
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f, "html.parser")

    for heading in soup.find_all(re.compile(r"^h[1-6]$", re.I)):
        try:
            level = int(heading.name[1])
            title = heading.get_text().strip()
            if title:
                toc.append((level, title))
        except (ValueError, IndexError):
            continue

    return toc


def process_epub(file_path):
    """Quét và lấy tiêu đề từ file EPUB (.epub) qua mục lục sách (TOC) hoặc thẻ heading nội dung"""
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(file_path)
    toc = []

    def extract_from_toc_items(items, level=1):
        extracted = []
        for item in items:
            if isinstance(item, epub.Link):
                if item.title and item.title.strip():
                    extracted.append((level, item.title.strip()))
            elif isinstance(item, (list, tuple)):
                if len(item) == 2:
                    section, children = item
                    if hasattr(section, "title") and section.title and section.title.strip():
                        extracted.append((level, section.title.strip()))
                        extracted.extend(extract_from_toc_items(children, level + 1))
                    else:
                        extracted.extend(extract_from_toc_items(item, level))
                else:
                    for sub in item:
                        extracted.extend(extract_from_toc_items([sub], level))
            elif hasattr(item, "title") and item.title and item.title.strip():
                extracted.append((level, item.title.strip()))
        return extracted

    # 1. Thử lấy từ TOC metadata của EPUB
    if hasattr(book, "toc") and book.toc:
        toc = extract_from_toc_items(book.toc, level=1)

    # 2. Nếu TOC metadata trống, quét các thẻ heading (h1-h6) từ nội dung HTML của từng chương
    if not toc:
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            for heading in soup.find_all(re.compile(r"^h[1-6]$", re.I)):
                try:
                    level = int(heading.name[1])
                    title = heading.get_text().strip()
                    if title:
                        toc.append((level, title))
                except (ValueError, IndexError):
                    continue

    return toc


def process_pdf(file_path):
    """Quét và lấy tiêu đề / bookmarks từ file PDF (.pdf)"""
    import pypdf

    reader = pypdf.PdfReader(file_path)
    toc = []

    def extract_outline(outlines, level=1):
        extracted = []
        for item in outlines:
            if isinstance(item, list):
                extracted.extend(extract_outline(item, level + 1))
            else:
                title = getattr(item, "title", None)
                if title and str(title).strip():
                    extracted.append((level, str(title).strip()))
        return extracted

    try:
        if reader.outline:
            toc = extract_outline(reader.outline, level=1)
    except Exception:
        pass

    return toc


HANDLERS = {
    ".md": ("Markdown", process_markdown),
    ".docx": ("Word Docx", process_docx),
    ".epub": ("EPUB Book", process_epub),
    ".html": ("HTML", process_html),
    ".htm": ("HTML", process_html),
    ".pdf": ("PDF", process_pdf),
}


def generate_toc(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: Không tìm thấy file '{file_path}'")
        return

    ext = os.path.splitext(file_path)[1].lower()

    if ext not in HANDLERS:
        supported = ", ".join(sorted(HANDLERS.keys()))
        print(f"⚠️ Định dạng file '{ext}' không được hỗ trợ! Các định dạng hỗ trợ: {supported}")
        return

    label, handler = HANDLERS[ext]
    print(f"📄 Đang xử lý file {label}: {file_path}")

    try:
        headings = handler(file_path)
    except Exception as e:
        print(f"❌ Lỗi khi đọc file '{file_path}': {e}")
        return

    if not headings:
        print("📭 Không tìm thấy tiêu đề hoặc mục lục nào trong file.")
        return

    # Tạo nội dung mục lục dạng Markdown
    toc_lines = []
    for level, title in headings:
        indent = "  " * max(0, level - 1)
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
