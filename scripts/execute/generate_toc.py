import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from bs4 import BeautifulSoup
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
        if p.style.name.startswith("Heading"):
            try:
                level = int(p.style.name.split()[-1])
                title = p.text.strip()
                if title:
                    toc.append((level, title))
            except ValueError:
                continue
    return toc


def process_html(file_path):
    """Quét và lấy tiêu đề từ file HTML (h1 -> h6)"""
    toc = []
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

        # Tìm tất cả các thẻ từ h1 đến h6 theo thứ tự xuất hiện trong document
        for tag in soup.find_all(re.compile(r"^h[1-6]$")):
            level = int(tag.name[1])  # 'h2' -> 2
            title = tag.get_text().strip()
            if title:
                toc.append((level, title))
    return toc


def process_epub(file_path):
    """Scan and extract headings from EPUB file (ZIP with XHTML/HTML content)"""
    toc = []
    NS_CONTAINER = "urn:oasis:names:tc:opendocument:xmlns:container"

    with zipfile.ZipFile(file_path, "r") as epub:
        container_xml = epub.read("META-INF/container.xml")
        container = ET.fromstring(container_xml)

        rootfile = container.find(f".//{{{NS_CONTAINER}}}rootfile")
        if rootfile is None:
            print("❌ Error: Không tìm thấy OPF trong container.xml")
            return []

        opf_path = rootfile.get("full-path")
        opf_dir = str(Path(opf_path).parent)

        opf_content = epub.read(opf_path)
        opf_root = ET.fromstring(opf_content)

        opf_ns = opf_root.tag.split("}")[0].lstrip("{") if "}" in opf_root.tag else ""

        def _tag(t):
            return f"{{{opf_ns}}}{t}" if opf_ns else t

        manifest = {}
        for item in opf_root.findall(f".//{_tag('item')}") or []:
            item_id = item.get("id")
            href = item.get("href")
            if item_id and href:
                manifest[item_id] = href

        spine_hrefs = []
        for itemref in opf_root.findall(f".//{_tag('itemref')}") or []:
            idref = itemref.get("idref")
            if idref and idref in manifest:
                spine_hrefs.append(manifest[idref])

        for href in spine_hrefs:
            content_path = str(Path(opf_dir) / href) if opf_dir else href
            try:
                data = epub.read(content_path)
                soup = BeautifulSoup(data, "html.parser")
                for tag in soup.find_all(re.compile(r"^h[1-6]$")):
                    level = int(tag.name[1])
                    title = tag.get_text().strip()
                    if title:
                        toc.append((level, title))
            except KeyError:
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
    elif ext in [".html", ".htm"]:
        print(f"🌐 Đang xử lý file HTML: {file_path}")
        headings = process_html(file_path)
    elif ext == ".epub":
        print(f"📖 Đang xử lý file EPUB: {file_path}")
        headings = process_epub(file_path)
    else:
        print(
            "⚠️ Định dạng file không được hỗ trợ! Chỉ nhận file .md, .docx, .html/.htm hoặc .epub"
        )
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
        target_file = "document.html"  # Đổi file mặc định để test
        print(f"Chạy mặc định với file: {target_file}")

    generate_toc(target_file)
