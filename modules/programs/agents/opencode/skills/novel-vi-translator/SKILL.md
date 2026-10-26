---
name: novel-vi-translator
description: Dịch truyện tiếng Anh sang tiếng Việt, mỗi chương một file markdown format đàng hoàng. Dùng skill này bất cứ khi nào người dùng nói dịch truyện, dịch chap, dịch novel, trans truyện sang tiếng Việt, lưu từng chap markdown, hoặc đưa file chapter-content-*.md nhờ dịch — kể cả khi họ không nói rõ tên skill, chỉ cần có ý dịch truyện là phải dùng.
---

# Dịch truyện Anh → Việt theo chương

Dịch toàn bộ truyện tiếng Anh sang tiếng Việt bằng AI, không viết script dịch máy. Mỗi chương nguồn thành một file markdown tiếng Việt riêng, văn phong tiểu thuyết tự nhiên.

## Khi nào trigger

- User đưa các file kiểu `chapter-content-*.md`, mỗi file gộp nhiều chương, mỗi chương một dòng rất dài, mở đầu kiểu `#1Chapter 1 ...`, lẫn tag máy dịch như `gemini-3.5-flash-lite`, `deepseek-v4-flash`.
- User nói: "dịch tất cả truyện", "dịch như này", "lưu vào từng file markdown", "mỗi file là một chap".

## Quy trình Fast-Path (Hành động ngay, cấm thăm dò thừa thãi)

> [!IMPORTANT]
> **Quy tắc Tối đa 2 Lệnh Chuẩn Bị (Fast-Path Rule):**
> Tuyệt đối KHÔNG viết script Python phân tích/thống kê file, KHÔNG kiểm tra dung lượng min/max, KHÔNG đọc trước hàng loạt chương để mò mẫm tìm tên riêng, KHÔNG viết script chia batch vào file `/tmp/`.
> - **Lệnh 1:** `mkdir -p vi` và lấy danh sách file nguồn cần dịch (ví dụ: `ls chapter-*.md` hoặc kiểm tra xem chương nào chưa có trong `vi/`).
> - **Lệnh 2 (nếu cần):** Đọc nhanh tiêu đề/đoạn đầu của chương 1 để lấy tên nhân vật chính nếu chưa có glossary.
> - **Ngay từ bước tiếp theo:** Phải spawn Subagents dịch ngay lập tức! Mọi logic chia mảng 3–5 chương/subagent phải được Agent tự tính toán trong bộ nhớ (in-memory), không chạy script shell.

### 1. Phân loại nguồn & Chuẩn bị
- **Trường hợp A: Nguồn đã là các file riêng lẻ (`chapter-001-*.md`, ...):**
  - Không cần tiền xử lý hay tách file. Bỏ qua bước tách chương.
  - Kiểm tra các chương chưa có trong `vi/` để dịch tiếp.
- **Trường hợp B: Nguồn là 1 file gộp lớn (`chapter-content-*.md`):**
  - Chỉ dùng đúng 1 lệnh python ngắn gọn để tách ra các file chương nguồn nếu dòng quá dài bị cắt cụt.
- Tạo nhanh bảng tên riêng (Glossary) ngắn gọn cho các nhân vật chính/địa danh xuất hiện ở đầu truyện (ví dụ: Ye You → Diệp Du, Xia Feng → Hạ Phong). Các tên phụ khác subagent tự suy luận dịch chuẩn Hán-Việt.

### 2. Tự động dịch liên tục toàn bộ (Mặc định dùng Subagents song song)

- **Mặc định bắt buộc sử dụng subagents**:
  - Tách và chuẩn bị sẵn các chương/file raw nguồn.
  - Thiết lập bảng thuật ngữ / tên riêng chuẩn (glossary) cố định để truyền kèm vào prompt cho tất cả các subagent, đảm bảo tính nhất quán giữa các chương.
  - **Tối ưu phân bổ (Batching):** Giao **3 đến 5 chương** cho mỗi subagent. Đây là điểm cân bằng vàng giữa chi phí overhead token, bộ nhớ context và tránh chạm trần output token.
  - **Giới hạn luồng chạy đồng thời (Concurrency Limit):** Chỉ chạy song song **tối đa 3 đến 5 subagents cùng lúc**. Nếu có nhiều chương hơn, chia theo hàng đợi (queue) chạy cuốn chiếu từng đợt để tránh nghẽn TPM/RPM (lỗi 429 Rate Limit) và bảo đảm bộ nhớ.
  - **Quy tắc Zero-Overhead Token cho Subagent (Chống gọi lệnh thừa/đốt token):**
    - Nhúng trực tiếp toàn bộ nội dung raw của chương cần dịch vào trong `Prompt` giao việc cho subagent (không bắt subagent phải gọi tool đọc file từ đĩa).
    - Subagent chỉ được thực hiện đúng **duy nhất 1 tool call**: `write_file` để lưu bản dịch hoàn chỉnh vào file đích trong thư mục `vi/`.
    - **Nghiêm cấm** subagent chạy lệnh bash/shell (cấm `ls`, `cat`, `grep`, script python kiểm tra), cấm đọc lại file hay giải thích dông dài sau khi dịch.
- **Template Prompt chuẩn truyền cho Subagent:**
  ```text
  Nhiệm vụ: Dịch chương truyện sau sang tiếng Việt và lưu trực tiếp vào: <path_đích> (ví dụ: vi/chuong-01-slug.md).

  BẢNG THUẬT NGỮ / TÊN RIÊNG:
  <danh sách tên riêng: Ye You -> Diệp Du, ...>

  QUY TẮC BẮT BUỘC (TIẾT KIỆM TOKEN):
  1. KHÔNG chạy lệnh bash (cấm bash, cấm script python, cấm đọc lại thư mục hay kiểm tra file).
  2. Dịch toàn văn, giữ nguyên ngôi kể, hội thoại mỗi lời một dòng ngoặc kép, không tóm tắt, không sót cảnh, không dính ký tự Hán tự/pinyin.
  3. Format theo chuẩn:
     # Chương <N>: <Tên chương tiếng Việt>

     <nội dung đoạn...>
  4. CHỈ ĐƯỢC GỌI DUY NHẤT 1 TOOL: Dùng `write_file` để lưu nội dung dịch vào file đích. Sau đó trả lời "Xong" và dừng lại ngay lập tức.

  NỘI DUNG CHƯƠNG NGUỒN CẦN DỊCH:
  <dán nội dung raw của chương vào đây>
  ```
- **Tuyệt đối không dừng lại giữa chừng để hỏi user có dịch tiếp không.** Tự động điều phối các subagent xử lý cho đến khi hoàn thành 100% các chương nguồn.
- **Dự phòng (chỉ khi môi trường hoàn toàn không hỗ trợ tạo/gọi subagent):**
  - Dịch cuốn chiếu từng lượt 1-2 chương trong cùng chuỗi hành động và tự động tiếp tục cho đến khi xong toàn bộ mà không dừng lại hỏi user.
- Loại bỏ tag máy như `gemini-3.5-flash-lite`, tiêu đề kép `Chapter 1: ...Chapter 1: ...` — chỉ giữ một tiêu đề Việt.
- Dịch toàn văn, không tóm tắt, không cắt cảnh nhạy cảm, giữ ngôi kể, hội thoại, trình tự gốc.
- Viết tiếng Việt thuần túy, văn ngôn tình / đô thị tự nhiên. Tuyệt đối không để lọt ký tự Hán / pinyin trong output. Sau mỗi file, tự kiểm tra regex `[\u4e00-\u9fff]` — nếu còn là lỗi, sửa ngay.
- Không dùng từ Hán-Việt tối nghĩa khi có từ thuần Việt tương đương.

### 4. Format và lưu file

- Tạo thư mục `vi/` cạnh file nguồn nếu chưa có.
- Tên file: `chuong-XX-slug-tieng-viet-khong-dau.md`. Ví dụ: `chuong-01-bat-luc-nhu-dan-ong.md`.
- Luôn dùng template chính xác này:

```markdown
# Chương <N>: <Tên chương tiếng Việt>

<đoạn 1>

<đoạn 2>

<đoạn 3>
...
```

- Mỗi đoạn cách nhau một dòng trắng. Hội thoại mỗi lời một dòng, giữ dấu ngoặc kép tiếng Việt.
- Dùng `write` để lưu. Sau `write`, nếu phát hiện lẫn Hán tự do gõ vội, dùng `edit` hoặc `bash python3` thay thế từng cụm sang tiếng Việt thuần, rồi đọc lại.

### 5. Quality checklist trước khi báo xong

- [ ] Đủ số file = số chương nguồn, kể cả chương paywall cũng có file ghi chú?
- [ ] Mỗi file mở bằng `# Chương N:`?
- [ ] Không còn tag `gemini`, `deepseek`, tiêu đề kép tiếng Anh?
- [ ] Không còn ký tự `[\u4e00-\u9fff]`?
- [ ] Tên riêng nhất quán giữa các chương?
- [ ] Đã xóa file tạm `.wrapped.txt`, `/tmp/novel_en/`?
- [ ] Đã liệt kê kết quả `vi/` cho user?

## Ví dụ

**Input:**
`chapter-content-15-46-10.md` chứa `#1Chapter 1 She was as helpless as a man.gemini-...`, `#2Chapter 2 ...`, `#3Chapter 3 ...`

**Output:**

- `vi/chuong-01-bat-luc-nhu-dan-ong.md` → `# Chương 1: Cô ấy bất lực như một người đàn ông` + toàn văn Việt
- `vi/chuong-02-thanh-xuan-cua-con-trai.md` → `# Chương 2: Đối với con trai, thanh xuân là quý giá nhất!` + toàn văn Việt
- `vi/chuong-03-hoa-khoi-ba-nam.md` → `# Chương 3: Hoa khôi si tình đã theo đuổi anh ba năm` + toàn văn Việt

**Input paywall:**
`#11Chapter 11 ...AI Translation Requires Registration... #12Security Check Required...`

**Output:**
`vi/chuong-11-....md` chỉ ghi chú: bản gốc không có nội dung truyện, giữ mạch số chương.

## Không làm

- **Tuyệt đối KHÔNG chạy vòng lặp lệnh thăm dò/phân tích trước khi dịch**: Không viết script thống kê min/max size file, không in metadata nhiều lần, không viết script chia batch ra file `/tmp/plan.py`, không đọc hết 3-5 chương đầu chỉ để tìm tên riêng. Càng làm rườm rà càng đốt token và làm gián đoạn tiến độ.
- **Không dừng lại sau mỗi chương để hỏi người dùng có dịch tiếp không.** Phải chủ động điều phối subagents cho đến khi xong hết 100% các chương nguồn.
- Không viết script Python/Node để dịch hàng loạt bằng máy, không gọi API dịch ngoài AI hiện tại.
- Không bịa nội dung cho chương paywall.
- Không gộp nhiều chương vào một file Việt, trừ khi user yêu cầu rõ.
