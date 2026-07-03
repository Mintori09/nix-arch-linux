---
name: vietnamese-document-summarizer
description: Summarize documents, chat logs, forum threads, or articles in Vietnamese. Trigger this skill whenever the user asks to summarize, translate, or extract key information from a file in Vietnamese, especially when they specify format preferences like bulleted lists, avoiding tables, or removing metadata (such as author names, dates, or usernames).
---

# Tóm tắt tài liệu tiếng Việt — chất lượng cao

Tóm tắt tài liệu, luồng thảo luận, hoặc bài viết sang tiếng Việt dạng danh sách.
Loại bỏ rác UI và metadata. Thích ứng theo loại tài liệu.

## Quy trình thực hiện

### 1. Phát hiện loại tài liệu

Xác định loại nội dung trước khi xử lý:

| Loại                | Đặc điểm nhận biết                                                           | Cách tóm tắt                                                 |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Forum thread**    | `u/username`, `comment score`, `reply`, `parent comment`, nested indentation | Gom luồng reply theo chủ đề, giữ cấu trúc hỏi-đáp            |
| **Chat log**        | Timestamp, tên người dùng, dòng ngắn xen kẽ                                  | Gom theo chủ đề hội thoại, giữ quan điểm các bên             |
| **Article / blog**  | Tiêu đề, đoạn văn, heading, không reply                                      | Bóc tách ý chính mỗi section                                 |
| **Email**           | `From:`, `Subject:`, `> quoted text`                                         | Tóm tắt nội dung chính, lược bỏ quoted history               |
| **Code discussion** | Code blocks, `diff`, stack trace, error log                                  | Giữ nguyên code mẫu, tóm tắt giải thích                      |
| **Transcript**      | Speaker labels, timestamp `[00:12:34]`                                       | Gom theo chủ đề, loại bỏ filler words                        |
| **Hỗn hợp (mixed)** | Có dấu hiệu của nhiều loại                                                   | Chọn chế độ linh hoạt, ưu tiên giữ nội dung kỹ thuật         |
| **Không xác định**  | Không có dấu hiệu rõ ràng                                                    | Fallback: xử lý như article, ưu tiên giữ cấu trúc nguyên bản |

### 2. Lọc và làm sạch (Preprocessing)

Loại bỏ theo thứ tự:

1. **Rác UI:** Quảng cáo, nút share, `Promoted`, `Cancel`, `Skip`, `Check for AI`, `Join now`, `Subscribe`, `Unsubscribe`
2. **Rác cấu trúc:** Dòng trống lặp (>2 dòng liên tiếp), separator lines (`---`, `***`, `___`)
3. **Rác tab:** Content từ tab đang mở hiển thị trong link preview
4. **Metadata:** Tên người đăng (`u/`, `OP`), điểm số, timestamp, trừ khi có ích cho ngữ cảnh
5. **Reply cũ (quoted text):** Trong email, giữ tối đa 1 cấp quoted text

**Giữ lại:**

- Code blocks (` ``` `) — giữ nguyên, thêm giải thích tiếng Việt nếu cần
- URLs ngắn gọn — chỉ giữ nếu là tài liệu tham khảo quan trọng
- Trích dẫn trực tiếp — đặt trong `> blockquote` kèm attribution (không phải tên thật)
- Thuật ngữ kỹ thuật — giữ nguyên tiếng Anh + giải thích trong ngoặc nếu cần

### 3. Xử lý tài liệu dài (Chunking)

Nếu tài liệu > 4000 từ:

- Chia thành các chunk ~2000 từ, overlap 200 từ
- Tóm tắt từng chunk riêng
- Gom các tóm tắt chunk, loại bỏ trùng lặp, tổng hợp thành bản cuối

### 4. Tự động xác định độ sâu tóm tắt

AI tự quyết định độ chi tiết dựa vào đặc điểm tài liệu — **không hỏi người dùng**:

| Mức                   | Khi nào dùng                                                                                              | Cấu trúc output                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Ngắn (TL;DR only)** | Tài liệu < 200 từ, hoặc nội dung đơn giản (1-2 ý), hoặc rõ ràng là update ngắn / changelog / announcement | Chỉ TL;DR (1-3 bullet)                                          |
| **Vừa (Standard)**    | Mặc định. Tài liệu 200-3000 từ, hoặc nhiều chủ đề nhưng không quá phức tạp                                | TL;DR + `##` headings + bullets                                 |
| **Dài (Detailed)**    | Tài liệu > 3000 từ, hoặc nội dung kỹ thuật phức tạp, hoặc nhiều lớp tranh luận                            | TL;DR + `##` headings + bullets + sub-bullets + line references |

Dấu hiệu để chọn **Detailed**: có code blocks dài, nhiều quoted reply lồng nhau, multiple sections với luồng argument riêng, changelog với nhiều version/thời điểm.

### 5. Định dạng output

**Cấu trúc chuẩn:**

```
TL;DR:
- 1-2 dòng tóm tắt ngắn nhất
- Không quá 30 từ

## [Nhóm chủ đề 1] (lines 12-45)
- Ý chính A
- Ý chính B
  - Chi tiết con (nếu cần)

## [Nhóm chủ đề 2]
...
```

**Quy tắc:**

- Dùng `* ` cho bullet, thụt lề 2 spaces cho sub-bullet
- **Không tạo bảng biểu**
- **Không đưa tên tác giả / người đăng** trừ khi được yêu cầu
- **Heading dạng `##`** để phân nhóm, **không dùng `#`** (dành cho TL;DR)
- **Độ dài:** Mỗi bullet tối đa 2 dòng. Nếu dài hơn → tách thành bullet con
- **Code blocks:** Bọc trong ` ``` ` nếu là code gốc, xuống bullet giải thích bên dưới
- **Số liệu / thống kê:** Luôn giữ số gốc, không làm tròn. VD: "giảm 23.7%" — không viết thành "khoảng 24%"
- **Version numbers, dates, paths, command lines:** Giữ nguyên tuyệt đối, không paraphrase, không thêm "khoảng", "cỡ"
- **Thuật ngữ:** Giữ nguyên tiếng Anh nếu là thuật ngữ kỹ thuật. VD: "cần có API endpoint mới" (không dịch thành "điểm cuối giao diện lập trình")
- **Map sections → line numbers:** Nếu file có line numbers, thêm `(lines X-Y)` sau mỗi heading để tra cứu nhanh

### 6. Xử lý tình huống đặc biệt (Edge Cases)

| Tình huống                                                         | Cách xử lý                                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Sau cleaning không còn gì**                                      | Báo: "⚠️ Tài liệu chỉ chứa rác UI/metadata, không có nội dung để tóm tắt."                                                          |
| **Encoding lỗi**                                                   | Phát hiện dấu tiếng Việt hiển thị sai (dấu hỏi/dấu ngã lẫn lộn, `dấu` sai vị trí), cố gắng khôi phục. Nếu không chắc → báo ở TL;DR  |
| **Không detect được loại**                                         | Fallback: xử lý như article, output ở mức vừa (standard)                                                                            |
| **Song ngữ mạnh**                                                  | Tách rõ: tóm tắt phần tiếng Việt, giữ nguyên thuật ngữ tiếng Anh. Nếu tài liệu chủ yếu là tiếng Anh → vẫn summarize bằng tiếng Việt |
| **File đầu vào bị thiếu context** (ví dụ: reply không có post gốc) | Thêm ⚠️ ở heading tương ứng. VD: "⚠️ Chỉ có reply, thiếu post gốc — có thể hiểu sai ngữ cảnh"                                       |
| **Chunking không khả thi** (file quá ngắn nhưng yêu cầu xử lý)     | Bỏ qua chunking, xử lý toàn bộ                                                                                                      |
| **Có nhiều file cùng lúc**                                         | Tóm tắt từng file riêng, sau đó tổng hợp cross-file ở cuối                                                                          |

### 7. Xử lý khi không chắc chắn (Confidence Flagging)

Nếu không chắc về một phần nội dung, **không hallucinate** — dùng ⚠️:

- `⚠️ Phần này có thể thiếu ngữ cảnh — ...`
- `⚠️ Có vẻ người dùng đề cập đến X, nhưng không rõ ràng`
- `⚠️ Số liệu này không nhất quán giữa các phần — giữ nguyên số gốc: ...`

### 8. Kiểm tra chất lượng (Quality Checklist)

Trước khi xuất kết quả, tự kiểm tra:

- [ ] Đã loại bỏ rác UI và metadata chưa?
- [ ] Mức độ chi tiết (ngắn/vừa/dài) đã phù hợp với tài liệu chưa?
- [ ] Có ít nhất 1 heading `##` phân loại nội dung?
- [ ] Mỗi bullet có đủ 1 ý hoàn chỉnh (không bị cụt)?
- [ ] Không có bảng biểu?
- [ ] Có code blocks không? Nếu có, đã giữ nguyên chưa?
- [ ] Số liệu, version, dates, paths có bị làm tròn hoặc paraphrase không?
- [ ] Thuật ngữ kỹ thuật có bị dịch sai không?
- [ ] Tài liệu gốc có song ngữ không? Đã tóm tắt đúng phần tiếng Việt?
- [ ] Có ⚠️ nào cần thêm không?
- [ ] Line references đã đúng?
- [ ] Nếu input từ file — đã lưu markdown ra đúng thư mục chưa? Tên file đúng loại tài liệu chưa?

Nếu thiếu checklist item nào → sửa trước khi xuất.

### 9. Ngôn ngữ

- Tóm tắt bằng tiếng Việt tự nhiên, mạch lạc, chính xác
- Giữ nguyên tên riêng (người, công ty, sản phẩm)
- Với thuật ngữ lần đầu xuất hiện: `tên_tiếng_Anh (giải thích tiếng Việt)`. VD: `scalability (khả năng mở rộng)`
- Tránh dùng từ Hán-Việt quá khó hiểu. Ưu tiên từ thuần Việt nếu có

### 10. Auto-save ra file markdown

Sau khi quality check pass, tự động lưu summary ra file markdown:

**Xác định file path:**

- Nếu input từ file (Read tool có filePath tuyệt đối) → output cùng thư mục
- Nếu input là text paste (không có file path) → chỉ in ra terminal, bỏ qua auto-save

**Đặt tên file (theo loại tài liệu):**

| Loại               | Filename                           |
| ------------------ | ---------------------------------- |
| Forum thread       | `{filename}-thread-summary.md`     |
| Chat log           | `{filename}-chat-summary.md`       |
| Article / blog     | `{filename}-article-summary.md`    |
| Email              | `{filename}-email-summary.md`      |
| Code discussion    | `{filename}-code-summary.md`       |
| Transcript         | `{filename}-transcript-summary.md` |
| Hỗn hợp / không rõ | `{filename}-summary.md`            |

Với `{filename}` là tên file gốc (bỏ extension). VD: `thong-bao-cap-nhat.txt` → `thong-bao-cap-nhat-article-summary.md`.

**Cách lưu:**

1. Dùng `write` tool với filePath đã xác định để ghi markdown output
2. Sau khi lưu, thêm dòng thông báo: `📝 Đã lưu: {absolute-path}`
3. Output ra terminal như bình thường (in full summary + thông báo file đã lưu)

### 11. Tương tác sau output

Sau khi xuất bản tóm tắt, chủ động hỏi:

> Bạn muốn mở rộng mục nào không? Hoặc muốn summary ở độ sâu khác (ngắn hơn / chi tiết hơn)?

### 12. Ví dụ minh họa (Few-shot Examples)

#### Ví dụ 1: Forum thread về lỗi phần mềm

**Đầu vào (forum thread):**

```
u/dev123 • 5h
Sau khi update lên v2.4.1, app bị crash khi mở modal. Log: TypeError: Cannot read properties of undefined (reading 'config'). Rollback về v2.4.0 thì OK.

u/admin • 4h
Bạn đã clear cache chưa? Thử `rm -rf node_modules/.cache` rồi build lại.

u/dev123 • 3h
Rồi, vẫn crash. Có vẻ do breaking change từ dependency `react-modal@4.0`. Chạy `npm ls react-modal` thấy version 4.0.0.

u/admin • 2h
Đã reproduce. Hotfix ở PR #892. Tạm thời downgrade react-modal xuống 3.x.
```

**Đầu ra (chế độ vừa - standard):**

```
TL;DR:
- Crash khi mở modal sau update v2.4.1, nguyên nhân do react-modal@4.0 breaking change

## Lỗi (lines 1-2)
- App crash khi mở modal sau update v2.4.1
- Log: `TypeError: Cannot read properties of undefined (reading 'config')`
- Rollback về v2.4.0 thì hoạt động bình thường

## Khắc phục (lines 3-8)
- Clear cache không hiệu quả
- Root cause: breaking change từ `react-modal@4.0`
- Hotfix ở PR #892; workaround là downgrade react-modal xuống 3.x
```

#### Ví dụ 2: Article ngắn

**Đầu vào:**

```
Hôm nay tôi giới thiệu về công cụ mới: Opencode CLI.
Đây là AI coding assistant chạy trên terminal. Nó hỗ trợ 20+ ngôn ngữ và framework.
Nổi bật nhất là khả năng multi-agent: bạn có thể dispatch task cho nhiều agent cùng lúc.
Hiện tại Opencode có sẵn 30+ skills để tự động hóa quy trình dev.
Chi tiết: https://opencode.ai
```

**Đầu ra (chế độ ngắn - TL;DR only):**

```
TL;DR:
- Opencode CLI là AI coding assistant chạy terminal, hỗ trợ 20+ ngôn ngữ
- Nổi bật: multi-agent dispatch, 30+ skills tự động hóa quy trình dev
```

#### Ví dụ 3: Tài liệu kỹ thuật dài

**Đầu vào:**
_[File dài ~4000 từ về migration kiến trúc microservice]_

**Đầu ra (chế độ dài - detailed):**

```
TL;DR:
- Migration từ monolith sang microservice, chia làm 3 phase, ưu tiên service auth trước

## Lý do migration (lines 5-30)
- Monolith không scale được: deployment 45 phút, 1 bug ở module A ảnh hưởng toàn bộ
- Cần hỗ trợ 3 platform mới trong Q3, monolith không đáp ứng kịp

## Kiến trúc đích (lines 32-120)
- 5 services: auth, product, order, payment, notification
- Message queue: RabbitMQ (không phải Kafka — trade-off: độ phức tạp thấp hơn)
- API Gateway: Kong, kèm rate limiting và circuit breaker
- ⚠️ Mục "service discovery" chưa có quyết định cuối cùng — đang cân nhắc Consul vs Kubernetes DNS

## Lộ trình (lines 122-200)
- Phase 1: Tách auth service, dùng database riêng (PostgreSQL mới, không dùng chung DB cũ)
  - Thời gian: 3 tuần
  - Migration data: script ở `scripts/migrate-auth.ts`
- Phase 2: Tách product + order (tuần 4-8)
- Phase 3: Payment + notification, monitoring, gradual sunset monolith (tuần 9-12)

## Rủi ro (lines 201-250)
- Data consistency giữa các service chưa có giải pháp rõ — đề xuất Sagas pattern nhưng chưa approve
- Đội QA hiện tại chưa trained cho distributed testing
```
