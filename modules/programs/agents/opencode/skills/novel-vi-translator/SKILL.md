---
name: novel-vi-translator
description: Dịch truyện tiếng Anh sang tiếng Việt, mỗi chương một file markdown format đàng hoàng. Dùng skill này bất cứ khi nào người dùng nói dịch truyện, dịch chap, dịch novel, trans truyện sang tiếng Việt, lưu từng chap markdown, hoặc đưa file chapter-content-*.md nhờ dịch — kể cả khi họ không nói rõ tên skill, chỉ cần có ý dịch truyện là phải dùng.
---

# Dịch truyện Anh → Việt theo chương

Dịch toàn bộ truyện tiếng Anh sang tiếng Việt bằng AI, không viết script dịch máy. Mỗi chương nguồn thành một file markdown tiếng Việt riêng, văn phong tiểu thuyết tự nhiên.

## Khi nào trigger

- User đưa các file kiểu `chapter-content-*.md`, mỗi file gộp nhiều chương, mỗi chương một dòng rất dài, mở đầu kiểu `#1Chapter 1 ...`, lẫn tag máy dịch như `gemini-3.5-flash-lite`, `deepseek-v4-flash`.
- User nói: "dịch tất cả truyện", "dịch như này", "lưu vào từng file markdown", "mỗi file là một chap".

## Quy trình

### 1. Khảo sát nguồn

- Dùng `read` thư mục để liệt kê file nguồn.
- Kiểm tra độ dài: file thường ~25k ký tự, dòng >2000 ký tự sẽ bị `read` cắt cụt. Không cố đọc nguyên file một lần.
- Tách chương bằng marker `#<số>Chapter`: dùng `bash` + `python3 -c` chỉ để **tách và bọc dòng** (wrap mỗi 600-800 ký tự tại dấu cách gần nhất), tuyệt đối không dịch bằng script. Ví dụ tách ra `/tmp/novel_en/chap_raw_XX.md` để đọc tiếp.

### 2. Xác định danh sách chương thật

- Mỗi marker là một chương. Giữ số chương gốc.
- Nếu chương chỉ chứa thông báo paywall / "AI Translation Requires Registration" / "Security Check Required" thì không bịa truyện. Tạo file ghi chú ngắn giữ mạch số chương, hẹn gặp chương sau.
- Chuẩn hóa tên riêng ngay từ chương 1 và giữ xuyên suốt. Ví dụ gợi ý: Ye You → Diệp Du, Jiang Yumeng → Khương Dư Mộng, Jiang Yaqin → Khương Nhã Cầm, Su Qinglong → Tô Thanh Long, Baiyujing Academy → Học viện Bạch Ngọc Kinh, Magic City → Ma Đô, Daxia → Đại Hạ. Nếu truyện khác, tự đặt bảng tên nhất quán từ đầu.
- Kiểm tra không được để các dữ dính vào nhau.

### 3. Tự động dịch liên tục toàn bộ (Hỗ trợ chạy song song bằng Subagents)

- **Tuyệt đối không dừng lại giữa chừng để hỏi user có dịch tiếp không.** Tự động xử lý lần lượt hoặc song song cho đến khi hoàn thành 100% các chương nguồn.
- **Dịch song song bằng subagents (khuyến khích nếu môi trường hỗ trợ):**
  - Trước khi gọi subagents, thiết lập bảng thuật ngữ / tên riêng chuẩn (glossary) cố định để truyền kèm vào prompt của các subagent, đảm bảo tính nhất quán trên toàn bộ các chương.
  - Chia danh sách chương và kích hoạt các subagent xử lý song song (mỗi subagent nhận 1 hoặc vài chương).
  - Mỗi subagent tự dịch, tự kiểm tra lỗi (regex Hán tự, thẻ tag máy dịch...) và ghi trực tiếp vào file markdown đích tương ứng trong `vi/`.
- **Nếu chạy đơn luồng (không có tool subagent hoặc subagent bị giới hạn):**
  - Dịch cuốn chiếu từng lượt 1-2 chương để đảm bảo chất lượng, sau đó ngay lập tức chuyển sang các chương tiếp theo trong cùng chuỗi hành động mà không dừng lại hỏi user.
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

- **Không dừng lại sau mỗi chương để hỏi người dùng có dịch tiếp không.** Phải chủ động dịch toàn bộ cho đến khi xong hết tất cả các chương.
- Không viết script Python/Node để dịch hàng loạt, không gọi API dịch máy ngoài AI hiện tại.
- Không bịa nội dung cho chương paywall.
- Không gộp nhiều chương vào một file Việt, trừ khi user yêu cầu rõ.
