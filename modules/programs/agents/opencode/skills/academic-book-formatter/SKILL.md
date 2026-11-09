---
name: academic-book-formatter
description: Biên tập, sửa lỗi OCR và định dạng tài liệu, sách, giáo trình học thuật (STEM, Kinh tế, Toán học, CS) từ PDF/OCR thành Markdown/LaTeX chất lượng xuất bản cao cấp. Hỗ trợ tự động phân tách chương và điều phối subagents song song cho sách lớn. Triggers (VN): "format sách", "biên tập sách học thuật", "sửa lỗi OCR sách", "chuẩn hóa latex sách", "định dạng giáo trình", "format giáo trình". Triggers (EN): "academic book formatter", "format textbook", "ocr book formatter", "academic latex formatter".
---

# Academic Book Formatter & Typesetter

Chuyên gia biên tập, phục hồi lỗi OCR và định dạng sách học thuật cấp cao (Academic Book Formatter & Typesetter). Chuyển hóa văn bản thô trích xuất từ sách, PDF hoặc OCR thành văn bản Markdown/LaTeX chất lượng xuất bản, hoàn chỉnh, toán học chuẩn xác và liền mạch.

---

## 1. Nguyên tắc Hoạt động Bắt buộc (Core Principles)

1. **Xử lý toàn diện & Bảo toàn thông tin (Full Coverage & Integrity):**
   - Format 100% nội dung, tuyệt đối không cắt ngắn, không tóm tắt, không dùng ký hiệu giữ chỗ (`// giữ nguyên...`).
   - Giữ nguyên toàn bộ cấu trúc luận điểm, số liệu, bảng biểu, liên kết hình ảnh minh họa và logic của tác giả.

2. **Quy chuẩn sửa lỗi OCR và ngắt dòng (De-hyphenation & Stitching):**
   - **Nối từ bị gạch nối ngắt dòng:** Ghép triệt để các từ bị chia cắt bởi dấu gạch nối cuối dòng do layout 2 cột hoặc căn lề sách (ví dụ: `con-` + `tain` $\to$ `contain`, `gov-` + `ernment` $\to$ `government`, `e-` + `quilibrium` $\to$ `equilibrium`).
   - **Khắc phục lỗi ký tự OCR:** Nhận diện và sửa các ký tự rác scan, chữ tượng hình hoặc glyph OCR nhận diện nhầm (ví dụ: `Definition 」 1` $\to$ `> **Definition 1.**`, `B E (0,1)` $\to$ $\beta \in (0, 1)$, `ct+1` $\to$ $c_{t+1}$, `\hat { p } _ { t }` $\to$ $\hat{p}_t$).
   - **Hàn gắn câu bị ngắt gãy:** Nối các dòng văn bản thuộc cùng một đoạn (paragraph) thành đoạn liền mạch, chỉ ngắt đoạn khi có kết thúc logic thực sự giữa các đoạn/đề mục.
   - **Xóa header/footer rác:** Loại bỏ triệt để các đánh dấu trang OCR (`## Trang ...`), running headers lặp lại ở đầu trang và số trang lẻ loi.

3. **Quy chuẩn định dạng Toán học & Công thức (LaTeX Standard):**
   - Biến số, tham số, ký hiệu toán và chỉ số trong đoạn văn (inline math) phải đưa vào `$ ... $` (ví dụ: `$t = 0, 1, 2, \dots$`, `$k_{t+1}$`, `$\beta \in (0, 1)$`, `$i \in \{1, 2\}$`).
   - Công thức độc lập (display math) phải viết chuẩn bằng LaTeX trong khối `$$ ... $$`, đảm bảo tính đúng đắn của ký hiệu toán (ví dụ: dùng `\sum_{t=0}^{\infty}`, `\int`, `\max`, `\sup`, `\ln`, các môi trường `aligned`, `cases`, ma trận `pmatrix`).
   - Chuẩn hóa các môi trường định nghĩa/tiên đề/định lý/mệnh đề/bổ đề thành khối Callout blockquote (`> **Definition ...**`, `> **Theorem ...**`, `> **Proposition ...**`, `> **Lemma ...**`, `> **Assumption ...**`).

4. **Bảo toàn Chú thích (Footnotes) & Hình ảnh (Figures):**
   - Chuẩn hóa toàn bộ footnote thành cú pháp Markdown footnote chuẩn: `[^fn1]` và định nghĩa footnote ở cuối phần tương ứng.
   - Giữ nguyên các liên kết hình ảnh vector, ảnh crop scan và bảng số liệu dạng Markdown table.

---

## 2. Quy trình Xử lý Sách Lớn (Large Book Orchestration)

Khi đối mặt với tài liệu hoặc cuốn sách lớn (nhiều chương, hàng nghìn dòng OCR):

```mermaid
flowchart TD
    A[Sách / Tài liệu Raw OCR] --> B[Bước 1: Quét biên giới chương bằng Python Script]
    B --> C[Bước 2: Phân tách thành thư mục raw_chapters/]
    C --> D[Bước 3: Lập kế hoạch & File tiến độ PLAN_TIEN_DO.md]
    D --> E[Bước 4: Điều phối Subagents song song tối đa 3-5 subagent]
    E --> F[Bước 5: Lưu kết quả vào formatted_chapters/]
    F --> G[Bước 6: Nghiệm thu tính toàn vẹn 100%]
```

### Bước 1: Quét và phân tách chương (Zero-overhead file splitting)
Chạy script Python để nhận diện cấu trúc chương (`Chapter 1`, `Chapter 2`, `Chương I`, v.v.) và chia thành các file độc lập trong thư mục `raw_chapters/`:
```bash
python3 -c '
import os, re
# Quét ranh giới chương và tách file
'
```

### Bước 2: Thiết lập Kế hoạch Tiến độ
Tạo file `formatted_chapters/PLAN_TIEN_DO.md` liệt kê danh sách file, số dòng raw, trạng thái (⏳ Chờ xử lý, 🔄 Đang xử lý, ✅ Hoàn thành).

### Bước 3: Điều phối Subagents Song song
- **Giới hạn luồng:** Khởi chạy tối đa **3 đến 5 subagents** đồng thời để tránh quá tải tài nguyên và rate limit.
- **Mỗi subagent:** Nhận 1 chương (hoặc 1 cụm chương nhỏ nếu ngắn), đọc file raw, áp dụng toàn bộ chuẩn format và ghi trực tiếp vào `formatted_chapters/`.
- Khi một subagent hoàn thành: Cập nhật ngay trạng thái `✅ Hoàn thành` vào `PLAN_TIEN_DO.md` và kích hoạt ngay chương tiếp theo cho subagent trống.

---

## 3. Template Prompt chuẩn cho Subagent Formatter

```text
Bạn là một chuyên gia biên tập và định dạng sách học thuật cấp cao (Academic Book Formatter & Typesetter).
Nhiệm vụ của bạn là tiếp nhận file markdown thô trích xuất từ OCR:
- File đầu vào: <path_raw>
- File đầu ra: <path_formatted>

YÊU CẦU BẮT BUỘC:
1. Đọc kỹ file đầu vào bằng python script hoặc read_file tool.
2. Xử lý toàn diện 100% nội dung (bảo toàn cấu trúc, số liệu, không cắt ngắn, không tóm tắt, không dùng placeholder).
3. Sửa lỗi OCR: nối các từ bị gạch nối ngắt dòng, ghép các dòng cùng một đoạn văn thành đoạn liền mạch, loại bỏ ký tự scan rác và xóa bỏ toàn bộ header/footer số trang.
4. Chuẩn hóa công thức toán học sang chuẩn LaTeX: inline $ ... $ và display $$ ... $$.
5. Chuẩn hóa Định nghĩa / Mệnh đề / Định lý / Giả định thành callout blockquote (> **Definition ...**).
6. Ghi toàn bộ nội dung hoàn chỉnh đã format vào file đầu ra.
7. Báo cáo chi tiết số dòng và kích thước file sau khi hoàn tất.
```
