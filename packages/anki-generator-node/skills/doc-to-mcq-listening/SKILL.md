---
name: doc-to-mcq-listening
description: >-
  Convert audio/video files, listening test materials (TOEIC, JLPT, IELTS), transcripts, conversations, or media URLs/paths into JSON listening multiple-choice questions (MCQ Listening) flashcards for Anki.
  Use this skill whenever the user provides audio/video/image media, listening transcripts, TOEIC Part 1-4, JLPT Choukai, or asks to generate listening trắc nghiệm / câu hỏi nghe hiểu.
  Automatically adapts explanation based on whether the question has an image or is audio-only:
  - For Audio-Only questions: Explains using transcript clues and why other options are wrong.
  - For Image + Audio questions (Graphic Synthesis): Explains by mapping audio clues directly to the graphic/table in the image to deduce the answer.
  Triggers on Vietnamese phrases like "tạo trắc nghiệm nghe", "làm trắc nghiệm listening", "tạo mcq listening", "tạo câu hỏi nghe hiểu anki", "tạo trắc nghiệm toeic listening", "tạo trắc nghiệm jlpt choukai".
---

# Doc to MCQ Listening Flashcard

Convert listening exam materials, audio/video recordings, dialogues, or listening questions (e.g., TOEIC Part 1-4, JLPT Choukai N1-N5, IELTS Listening) into a structured JSON array of Multiple-Choice Listening Questions ready for use with `--type mcq-listening` in the `anki-generator-node` project.

## When triggered

When the user provides audio/video/image media (local path or URL), transcripts, or listening questions:

1. **Phân loại dạng câu hỏi**:
   - **Dạng 1: Câu hỏi CHỈ CÓ AUDIO (Audio-only)** — Phần lớn câu hỏi TOEIC Part 2/3/4, JLPT Mondai 3/4/5. Người học chỉ cần nghe audio để chọn đáp án.
   - **Dạng 2: Câu hỏi KẾT HỢP CẢ AUDIO VÀ ẢNH (Image + Audio Graphic Synthesis)** — Dạng "Look at the graphic" (bảng biểu, lịch trình, menu, bản đồ, tranh miêu tả). Người nói trong audio chỉ đưa ra manh mối gián tiếp, người học bắt buộc phải nhìn hình để tra cứu/đối chiếu ra đáp án.

2. **Formulate High-Quality Questions**:
   - Clear question prompt.
   - 3 to 4 plausible answer choices (`a`, `b`, `c`, `d`).
   - Specify the answer key (`"a"`, `"b"`, etc.).

3. **QUY TẮC VIẾT EXPLANATION THEO TỪNG DẠNG**:

   ### A. Đối với câu hỏi CHỈ CÓ AUDIO (Không có ảnh):
   - **1. Transcript (Văn bản gốc)**: Lời thoại đầy đủ.
   - **2. Dịch nghĩa tiếng Việt**: Bản dịch tiếng Việt của lời thoại.
   - **3. Giải thích đáp án đúng**: Dẫn chứng trực tiếp từ câu nói trong audio.
   - **4. Giải thích các đáp án sai**: Phân tích vì sao các phương án khác sai (thông tin sai, bẫy từ đồng âm, không được nhắc đến).

   ### B. Đối với câu hỏi CÓ HÌNH ẢNH (Kết hợp Audio + Hình ảnh):
   - **1. Transcript (Văn bản gốc)**: Lời thoại đầy đủ.
   - **2. Dịch nghĩa tiếng Việt**: Bản dịch tiếng Việt của lời thoại.
   - **3. Logic suy luận kết hợp Audio & Hình ảnh (BẮT BUỘC KHI CÓ ẢNH)**:
     - **Manh mối từ bài nghe (Audio clue)**: Người nói đưa ra chi tiết/tiêu chí gì trong audio?
     - **Đối chiếu trên Hình ảnh / Đồ thị (Graphic mapping)**: Manh mối trong audio map trực tiếp sang mục/dòng/số hiệu nào trên hình ảnh để chọn đáp án đúng.
   - **4. Giải thích các đáp án sai**: Giải thích vì sao các lựa chọn khác trên hình ảnh không khớp với manh mối nghe được.

4. **Output Valid JSON**: Output a JSON array strictly conforming to the schema below.
5. **Provide Build Command**: Recommend compiling with `--type mcq-listening`.

---

## Schema & Output Format

```json
[
  {
    "image": "path/to/image.png hoặc https://.../image.png", // CHỈ CUNG CẤP KHI CÂU HỎI CÓ HÌNH ẢNH
    "audio": "path/to/audio.mp3 hoặc https://.../audio.mp3", // File audio hoặc URL
    "question": "Nội dung câu hỏi",
    "options": {
      "a": "Lựa chọn A",
      "b": "Lựa chọn B",
      "c": "Lựa chọn C",
      "d": "Lựa chọn D"
    },
    "answer": "a",
    "explanation": "..."
  }
]
```

---

## Examples

### Ví dụ 1: Câu hỏi CHỈ CÓ AUDIO (Audio-Only)

```json
[
  {
    "audio": "https://example.com/audio/part3_hotel.mp3",
    "question": "Why is the man calling the hotel?",
    "options": {
      "a": "To cancel a reservation",
      "b": "To request an early check-in",
      "c": "To ask for driving directions",
      "d": "To report a billing error"
    },
    "answer": "b",
    "explanation": "### 1. Transcript (Văn bản gốc)\nMan: Hello, I have a reservation under John Davis for this evening. My flight lands at 10:00 AM, so I was wondering if it's possible to check into my room before the standard 3:00 PM check-in time?\nWoman: Let me check our availability for today, Mr. Davis.\n\n### 2. Dịch nghĩa tiếng Việt\nNam: Xin chào, tôi có đặt phòng dưới tên John Davis vào tối nay. Chuyến bay của tôi hạ cánh lúc 10:00 sáng, nên tôi muốn hỏi liệu có thể nhận phòng trước giờ nhận phòng tiêu chuẩn 3:00 chiều được không?\nNữ: Để tôi kiểm tra phòng trống hôm nay giúp ông nhé, ông Davis.\n\n### 3. Giải thích đáp án đúng\n• **Đúng (b) To request an early check-in**: Người nam hỏi '*is it possible to check into my room before the standard 3:00 PM check-in time?*' (có thể nhận phòng trước 3h chiều không), chính là yêu cầu nhận phòng sớm (early check-in).\n\n### 4. Giải thích các đáp án sai\n• **Sai (a)**: Người nam không hủy đặt phòng (cancel).\n• **Sai (c)**: Không hỏi đường đi (directions).\n• **Sai (d)**: Không khiếu nại về hóa đơn (billing error)."
  }
]
```

### Ví dụ 2: Câu hỏi KẾT HỢP AUDIO + ẢNH (Image + Audio)

```json
[
  {
    "image": "media/conference_schedule.png",
    "audio": "media/part3_conference.mp3",
    "question": "Look at the graphic. Which room will the speakers go to?",
    "options": {
      "a": "Room 101",
      "b": "Room 204",
      "c": "Room 305",
      "d": "Room 402"
    },
    "answer": "b",
    "explanation": "### 1. Transcript (Văn bản gốc)\nMan: Are you heading to the keynote now?\nWoman: Yes, I'm going to hear Dr. Thorne talk about Machine Learning in Healthcare.\nMan: Oh great, let's walk over together.\n\n### 2. Dịch nghĩa tiếng Việt\nNam: Cậu có đang tới buổi thuyết trình chính không?\nNữ: Có, mình đang đi nghe Tiến sĩ Thorne nói về Học máy trong Y tế.\nNam: Ồ tuyệt quá, tụi mình cùng đi nhé.\n\n### 3. Logic suy luận kết hợp Audio & Hình ảnh\n• **Manh mối từ bài nghe (Audio clue)**: Người nữ nói sẽ đi nghe diễn giả *'Dr. Thorne'* thuyết trình chủ đề *'Machine Learning in Healthcare'*.\n• **Đối chiếu với bảng lịch trình trong ảnh (Graphic mapping)**:\n  - Bảng lịch trình ghi: *Dr. Thorne | Topic: Machine Learning in Healthcare | Room: 204*.\n  -> Kết hợp hai thông tin, hai người sẽ đến **Room 204 (b)**.\n\n### 4. Giải thích các đáp án sai\n• **Sai (a) Room 101**: Phòng của diễn giả Sarah Jenkins.\n• **Sai (c) Room 305**: Phòng dành cho phiên thảo luận chiều.\n• **Sai (d) Room 402**: Phòng hội thảo Cloud Security."
  }
]
```

---

## Compilation Command

To compile into an Anki `.apkg` file:

```bash
node dist/index.js --type mcq-listening <output.json>
```
