---
name: fmhy-tool-evaluator
description: >-
  Evaluate tool lists (especially FMHY wiki pages) by REAL-WORLD WORKFLOW VALUE and
  split them into "worth using" vs "not worth it" markdown reports. Triggers whenever
  the user wants to judge whether tools are actually useful/hữu ích today, rank or
  score a list of apps/tools/extensions, decides "which of these should I keep" from a
  wiki/index page, or pastes a URL to an FMHY tools page (social-media-tools,
  video-tools, internet-tools, text-tools, ...) asking what's worth using. Also fires
  on Vietnamese phrasings like "đánh giá tool", "cái nào đáng dùng", "chấm điểm công
  cụ", "tool nào hữu ích thật sự". The key lens: how much does using it actually boost
  productivity/convenience — NOT how popular or how "easy for beginners" it is.
---

# FMHY Tool Evaluator

Đánh giá danh sách công cụ (mặc định: một trang wiki FMHY) và chia làm 2 nhóm —
**Hữu ích** và **Không hữu ích lắm** — dựa trên **giá trị workflow thực tế**, không dựa
trên độ phổ biến hay độ dễ dùng.

## Khi nào dùng

- User dán một URL trang FMHY tools (hoặc bất kỳ list công cụ nào) và hỏi công cụ nào đáng dùng.
- User muốn "lấy hết list này, đánh giá thành 2 loại".
- User muốn viết lại prompt tự chấm điểm, hoặc tự đánh giá lại một list cũ.

## Input / Output

**Input:** URL tới trang wiki (vd `https://fmhy.net/social-media-tools`) — hoặc nội dung
markdown đã được dán sẵn.

**Output (3 file, đặt trong thư mục làm việc hiện tại):**

1. `grading-prompt.md` — prompt tự chấm điểm (rubric đầy đủ, sẵn sàng copy-paste).
2. `<trang>-huu-ich.md` — các công cụ HỮU ÍCH, có cột **Tác động workflow**.
3. `<trang>-khong-huu-ich.md` — các công cụ KHÔNG HỮU ÍCH LẮM, tách 2 nhóm nội bộ:
   **Hỏng/chết** và **Nghe hay nhưng không đáng**.

## Quy trình

### Bước 1 — Lấy nội dung

- Nếu có URL: dùng `webfetch` để lấy trang dạng markdown. Nếu kết quả bị cắt cụt, đọc phần
  còn lại từ file output đã lưu (webfetch tự lưu file khi dài).
- Nếu người dùng dán sẵn markdown: dùng luôn.
- Ghi chú rằng có thể có phần `Base64 Encoded Link` cảnh báo ở đầu — bỏ qua, chỉ quan tâm
  nội dung tool.

### Bước 2 — Trích xuất danh sách công cụ

- Mỗi mục thường có dạng `[Tên](url) - Mô tả ngắn`, gom thành nhóm theo heading
  (`## X Tools`, `### Sub-section`).
- Giữ cả link + mô tả gốc. Với mục liệt kê nhiều công cụ trên 1 dòng (cách nhau bằng `/`),
  tách riêng từng công cụ nhưng giữ chung nhóm để không phình file.
- Bỏ qua các liên kết điều hướng không phải công cụ (vd link sang trang khác dạng
  `[...](/other-page#anchor)`).

### Bước 3 — Chấm điểm từng công cụ (khung 10đ)

**Trục A — Khả thi (tối đa 4đ):** còn hoạt động, không bị nền tảng chặn, có bảo trì.

- Còn chạy ổn, không bị API/ToS chặn: 2đ
- Không dựa vào API nền tảng đã chết (X/Twitter trả phí, Pushshift bị gỡ, ...): 1đ
- Có bảo trì (commit/release gần, tác giả phản hồi): 1đ

**Trục W — Giá trị workflow (tối đa 6đ):** khi dùng thật, nó tăng năng suất/thuận tiện hơn
như thế nào so với làm tay hoặc công cụ mặc định.

- **5–6đ — Tăng năng suất mạnh:** tự động hóa tác vụ lặp lại (tải/bọc/xóa/xuất hàng loạt),
  tìm trong bể dữ liệu lớn, sinh output 1 nút, thay cả chuỗi thao tác. Khai thác mỗi tuần.
- **3–4đ — Tiện lợi, có lợi:** bớt vài bước so với làm tay, không bắt buộc nhưng rõ ràng nhanh hơn.
- **0–2đ — Không thêm năng suất:** cosmetic/giải trí/hoài niệm, làm tay cũng nhanh tương
  đương, dùng 1–2 lần rồi bỏ.

**Ngưỡng:** Tổng **≥ 7/10 → HỮU ÍCH**; dưới 7 → KHÔNG HỮU ÍCH LẮM.

**Quy tắc mạnh (overrides tổng điểm):**

1. A ≤ 1 (chết hoàn toàn, hoặc phụ thuộc API bị cắt) → luôn KHÔNG HỮU ÍCH LẮM.
2. W ≤ 2 (chạy tốt nhưng không giúp gì workflow) → luôn KHÔNG HỮU ÍCH LẮM.
3. Chỉ mục/index hoặc trang hướng dẫn vẫn cập nhật, dùng được → mặc định HỮU ÍCH.

**Tránh chấm lệch:**

- Đừng trừ điểm vì công cụ khó cài/CLI/tự-host. Đo bằng chính giá trị workflow cho người
  dùng đúng nhu cầu.
- Đừng cộng điểm vì tên nghe hay hoặc thương hiệu lớn.
- Với công cụ phục vụ nền tảng ngách (Pixelfed, Peertube, một mạng nhỏ): đánh giá đúng cho
  đối tượng thực của nó. Nếu với người dùng nền tảng đó nó tiết kiệm thời gian rõ rệt → W
  cao, vẫn HỮU ÍCH. Nếu chỉ là bản list instance trùng lặp (không sinh thêm giá trị) → W thấp.

### Bước 4 — Ghi file hữu ích (`<trang>-huu-ich.md`)

- Title + dòng giải thích nguồn và tiêu chí.
- Giữ nguyên cấu trúc nhóm của trang gốc (Discord, Reddit, YouTube, ...).
- Mỗi công cụ trong bảng: `Công cụ | Mô tả | Tác động workflow`.
  Cột **Tác động workflow** nêu cụ thể: tự động hóa được gì / bớt được bước nào / tiết kiệm
  thời gian ra sao / dùng khi nào — so với làm tay.
- Ghi các công cụ liên quan trên cùng một dòng gốc thành một hàng.
- Cuối file: mục **Thống kê** (số lượng mỗi nhóm) + lưu ý rằng đánh giá cần tái chạy định kỳ.

### Bước 5 — Ghi file không hữu ích (`<trang>-khong-huu-ich.md`)

- Chia 2 nhóm nội bộ:
  - **Hỏng / chết** — công cụ mất, bị chặn, bỏ rơi, host đã sập. Kèm lý do cụ thể.
  - **Nghe hay nhưng không đáng** — chạy tốt nhưng không giúp ích workflow (cosmetic, chữa
    cháy 1 lần, làm tay cũng nhanh, giải trí/hoài niệm). Kèm lý do vì sao W thấp.
- Giữ link gốc để người dùng tự kiểm tra lại.

### Bước 6 — Ghi file prompt (`grading-prompt.md`)

Tạo bản đầy đủ, copy-paste được, gồm: vai trò, 2 trục A/W, thang điểm W, ngưỡng, quy tắc
mạnh, hướng dẫn bối cảnh hóa, định dạng đầu ra từng công cụ. Tham khảo cấu trúc từ đúng
prompt mà bạn vừa dùng để chấm — đây là "bằng chứng" cho việc chấm điểm, nên phải khớp chính
xác với khung ở Bước 3.

## Nguyên tắc phong cách

- Viết tài liệu tiếng Việt (người dùng giao tiếp tiếng Việt), giữ tên công cụ và thuật ngữ
  kỹ thuật tiếng Anh.
- Giải thích **tại sao** một công cụ rơi vào nhóm này — 1–2 câu, cụ thể, có thể kiểm chứng
  lại được (vd: "X API trả phí → bot vỡ").
- Đừng phồng file bằng mô tả dài dòng. Cột mô tả giữ ngắn, cột **Tác động workflow** là nơi
  thể hiện giá trị.
- Đánh giá dựa trên kiến thức tới thời điểm hiện tại; luôn ghi chú rằng trạng thái công cụ
  thay đổi theo thời gian.
