---
name: reddit-top-week-scraper
description: Cào bài top tuần của các subreddit qua Firefox, loại trùng bằng cache, xuất file markdown theo từng sub. Dùng skill này bất cứ khi nào người dùng nhắc cào Reddit, top tuần subreddit, quét subreddit, digest Reddit, lấy bài mới Reddit, hoặc liệt kê subreddit kèm top week.
---

# Reddit Top Week Scraper

Mục tiêu là cào các bài top tuần của danh sách subreddit cho trước, bỏ qua những bài đã lấy ở lần chạy trước nhờ cache, rồi ghi kết quả thành từng file tương ứng với từng sub.

## Subreddit

- Anki
- Anticonsumption
- AskReddit
- ClaudeCode
- endeavourOS
- LearnJapanese
- linux
- ObsidianMD
- SideProject
- tauri
- nvim

## Quy trình làm việc

### 1. Xác định danh sách subreddit

Đọc danh sách `tracked_subreddits` từ file cache nếu có. Nếu chưa có hoặc cần thay đổi, hỏi người dùng để xác nhận danh sách subreddit cần cào.

### 2. Mở Firefox có giao diện

Dùng `firefox-devtools` (không dùng headless, không dùng request trực tiếp vì Reddit chặn bot). Điều hướng tới một sub bất kỳ để tạo phiên duyệt hợp lệ, ví dụ `https://www.reddit.com/r/<sub>/top/?t=week`. Đợi trang tải xong trước khi thực thi script.

### 3. Cào bài viết qua evaluate_script

Chia nhỏ mỗi đợt 2 tới 3 sub để tránh cắt ngắn output và tránh bị rate-limit. Đặt khoảng nghỉ ngắn (1-2 giây) giữa các request:

```js
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const res = await fetch(`https://www.reddit.com/r/${s}/top.json?t=week&limit=15`);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const j = await res.json();
```

Với mỗi bài, trích xuất:

- `id`, `title`, `score`, `num_comments`, `permalink` (ghép đầy đủ domain `https://www.reddit.com`)
- `selftext` (cắt khoảng 500 - 1000 ký tự đầu)
- `link_flair_text` (dùng để lọc nội dung)
- Ảnh trực tiếp: chỉ nhận khi `post_hint === 'image'` hoặc URL kết thúc bằng `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. Bỏ qua link báo ngoài, gallery hay video `v.redd.it`.

### 4. Quản lý Cache chống trùng lặp

File cache đặt tại `reddit_digest_week/.seen_urls.json` trong thư mục làm việc hiện tại với cấu trúc:

```json
{
  "tracked_subreddits": ["sub1", "sub2"],
  "seen": {
    "https://www.reddit.com/r/...": "2026-10-11T00:00:00Z"
  }
}
```

- Đọc cache trước khi lọc. Bỏ qua hoàn toàn bài viết có URL đã nằm trong `seen`.
- Dọn dẹp: Tự động loại bỏ các URL trong `seen` đã lưu quá 45 ngày để tránh phình dung lượng file.
- Cập nhật URL các bài mới được chọn và danh sách subreddit vào cache sau khi xử lý xong.

### 5. Lọc bài & Lấy bình luận chất lượng

Với mỗi sub, lọc giữ lại 4 tới 6 bài đáng chú ý nhất:

- Loại bỏ meme nhảm, bài giật tít rỗng (dựa vào `link_flair_text` dạng "Meme/Humor" hoặc bài không có nội dung thảo luận).
- Với mỗi bài được giữ lại, fetch comment kèm delay 1 giây: `https://www.reddit.com<permalink>.json?limit=8`.
- Lấy 4 tới 5 top comments có nội dung thực tế (bỏ qua AutoModerator và bot), trích xuất `author`, `score` và ~350 ký tự đầu.

### 6. Tiêu chuẩn tóm tắt & Ghi file kết quả

Mỗi sub lưu vào một file theo định dạng thư mục ngày `reddit_digest_week/<YYYY-MM-DD>/<Sub>.md` (ví dụ: `reddit_digest_week/2026-10-14/ObsidianMD.md` với `YYYY-MM-DD` là ngày hiện tại chạy cào bài). Lưu ý file cache `.seen_urls.json` vẫn nằm ở thư mục gốc `reddit_digest_week/.seen_urls.json` để dùng chung giữa các lần chạy. Viết dưới dạng văn xuôi liền mạch, phong cách bài phân tích chuyên sâu, **tuyệt đối không dùng ký tự gạch đầu dòng (`-`, `*`, `•`)**. Dùng tiêu đề `###` để phân tách từng bài viết rõ ràng.

#### Tiêu chuẩn của một bản tóm tắt chất lượng cao:

- **Nguyên tắc "So What?":** Không chỉ thuật lại nội dung bề mặt mà phải làm rõ: *Vấn đề cốt lõi là gì? Tại sao người đọc cần quan tâm? Nó ảnh hưởng hoặc phản ánh xu hướng gì trong thực tế?*
- **Tổng hợp (Synthesize) thay vì trích đoạn rời rạc:** Không dịch hay liệt kê từng comment riêng lẻ. Hãy gom nhóm các luồng dư luận chính (ví dụ: phe đồng tình chỉ ra ưu điểm gì, phe phản biện cảnh báo rủi ro gì, những đóng góp kinh nghiệm thực tế nổi bật từ người trong ngành).
- **Độc lập ngữ cảnh (Self-contained):** Người đọc không cần bấm vào link Reddit vẫn hiểu trọn vẹn bối cảnh, luận điểm và diễn biến thảo luận. Link gốc chỉ đóng vai trò đối chiếu.
- **Giữ nhịp điệu cộng đồng:** Phân biệt được sự đùa cợt/meme nội bộ với quan điểm nghiêm túc, làm nổi bật góc nhìn có chuyên môn sâu.

#### Cấu trúc chuẩn cho mỗi bài trong file:

```markdown
# Tổng quan Tuần r/<Sub>

[Đoạn văn nhận định ngắn mở đầu về chủ đề nổi bật của sub trong tuần]

### Tiêu đề bài viết

Bài viết này đạt [Điểm số] điểm với [Số lượng] lượt bình luận. Xem [thảo luận gốc](https://www.reddit.com/r/...).

![image](url_anh_neu_co)

[Đoạn văn phân tích bối cảnh, nội dung cốt lõi và lý do vì sao chủ đề này lại quan trọng hoặc đáng chú ý]

[Đoạn văn tổng hợp các luồng quan điểm đối lập hoặc bổ trợ từ phần bình luận của cộng đồng]

---

## Xu hướng và Nhận định chung

[Đoạn văn đúc kết xu hướng chung của sub trong tuần qua]
```

### 7. Báo cáo

Báo cáo ngắn gọn danh sách các subreddit đã cào, số lượng bài mới được lưu cho từng sub và đường dẫn file Markdown đã tạo. Không cần testcase.
