---
name: academic-book-translator
description: Dịch thuật tài liệu, sách và giáo trình học thuật (STEM, Kinh tế vĩ mô/vi mô, Toán học, CS) từ tiếng Anh sang tiếng Việt học thuật chuẩn mực cao cấp. Bảo toàn nguyên vẹn 100% công thức toán học LaTeX, đồng bộ thuật ngữ chuyên sâu và hỗ trợ điều phối subagents song song cuốn chiếu theo chương. Triggers (VN): "dịch sách học thuật", "dịch giáo trình", "dịch tài liệu toán kinh tế", "dịch sách tiếng anh sang tiếng việt", "trans sách học thuật". Triggers (EN): "academic book translator", "translate academic book", "translate textbook to vietnamese", "stem book translator".
---

# Academic Book Translator (English $\to$ Vietnamese)

Chuyên gia dịch thuật học thuật cấp cao (Academic Translator). Chuyển ngữ các giáo trình, sách chuyên khảo, bài báo khoa học và tài liệu lý thuyết (STEM, Kinh tế học, Khoa học Máy tính, Toán học) từ tiếng Anh sang tiếng Việt với văn phong học thuật chuẩn mực, diễn đạt logic tự nhiên và bảo toàn trọn vẹn 100% công thức toán học.

---

## 1. Nguyên tắc Dịch thuật Học thuật (Core Principles)

1. **Bảo tồn trọn vẹn 100% nội dung (Full Integrity):**
   - Dịch toàn văn 100%, tuyệt đối không tóm lược, không cắt xén, không bỏ sót các bước chứng minh, ví dụ tính toán, ghi chú và bài tập.
   - Không sử dụng ký hiệu giữ chỗ (`// đoạn sau dịch tương tự...`).

2. **Bảo toàn 100% Cú pháp Toán học & LaTeX:**
   - Giữ nguyên toàn vẹn mọi biểu thức toán học inline `$ ... $` và display block `$$ ... $$`.
   - Giữ nguyên toàn bộ ký hiệu biến số, chỉ số trên/dưới ($k_{t+1}$, $c_t^i$, $\beta^t$), toán tử ($\sum$, $\int$, $\max$, $\sup$, $\mathbb{E}$), ma trận và các phương trình có tag số thứ tự `\tag{...}`.
   - Giữ nguyên cấu trúc Callout Blockquote chuẩn: `> **Định nghĩa ...**`, `> **Định lý ...**`, `> **Mệnh đề ...**`, `> **Bổ đề ...**`, `> **Giả định ...**`, `> **Ví dụ ...**`.

3. **Văn phong Giáo trình Hàn lâm & Đồng bộ Thuật ngữ:**
   - Dịch thoát nghĩa, tự nhiên, mang văn phong sư phạm của sách giáo trình đại học/sau đại học.
   - Không dịch máy word-by-word; các mệnh đề diễn đạt rõ ràng logic nguyên nhân - kết quả.
   - Thiết lập bảng thuật ngữ (Glossary) đồng bộ xuyên suốt tất cả các chương sách trước khi dịch.

4. **Bảo toàn Cấu trúc Tài liệu & Chú thích:**
   - Giữ nguyên các cấp đề mục Markdown (`#`, `##`, `###`).
   - Dịch toàn bộ hệ thống chú thích chân trang (Footnotes) `[^fn...]` và đặt ở cuối mỗi chương.
   - Giữ nguyên liên kết các hình ảnh minh họa (`figures`, `crops/...`) và bảng dữ liệu Markdown.

---

## 2. Bảng Thuật ngữ Tham chiếu Tiêu biểu (Glossary Reference)

### Kinh tế học Vĩ mô & Tài chính (Macroeconomics & Finance)
| Thuật ngữ gốc (EN) | Bản dịch chuẩn tiếng Việt |
| :--- | :--- |
| Competitive Equilibrium | Cân bằng cạnh tranh |
| Arrow-Debreu Market Structure | Cấu trúc thị trường Arrow-Debreu |
| Sequential Markets Equilibrium | Cân bằng thị trường tuần tự |
| Pareto Efficient / Optimal | Hiệu quả Pareto / Tối ưu Pareto |
| Social Planner | Nhà hoạch định xã hội |
| Neoclassical Growth Model | Mô hình tăng trưởng tân cổ điển |
| Dynamic Programming | Quy hoạch động |
| Bellman Equation | Phương trình Bellman |
| Transversality Condition (TVC) | Điều kiện bù chuyển tiếp động / Điều kiện giáp biên |
| Euler Equation | Phương trình Euler |
| Steady State | Trạng thái dừng |
| Modified Golden Rule | Quy tắc vàng sửa đổi |
| Balanced Growth Path | Quỹ đạo tăng trưởng cân bằng |
| Overlapping Generations (OLG) Model | Mô hình các thế hệ chồng chéo |
| Offer Curves | Các đường cung ứng / Đường chào hàng |
| Dynamic Inefficiency | Phi hiệu quả động học |
| Ricardian Equivalence | Giả thuyết tương đương Ricardian |
| Continuous Time Growth Theory | Lý thuyết tăng trưởng trong thời gian liên tục |
| Pontryagin's Maximum Principle | Nguyên lý cực đại Pontryagin |
| Costate Variable / Hamiltonian | Biến đồng trạng thái / Hàm Hamiltonian |
| Phase Diagram / Saddle Path | Biểu đồ pha / Đường yên ngựa |
| Endogenous Growth Models | Các mô hình tăng trưởng nội sinh |
| Heterogeneous Agents / Bewley Models | Tác nhân không đồng nhất / Các mô hình Bewley |
| Buffer-stock / Precautionary Saving | Tiết kiệm đệm / Tiết kiệm phòng ngừa rủi ro |
| Calibration | Hiệu chỉnh tham số mô hình |

### Toán học & Giải tích Hàm (Mathematics & Functional Analysis)
| Thuật ngữ gốc (EN) | Bản dịch chuẩn tiếng Việt |
| :--- | :--- |
| Metric Space / Complete Metric Space | Không gian metric / Không gian metric đầy đủ |
| Cauchy Sequence | Dãy Cauchy |
| Uniform Convergence / Sup-norm | Hội tụ đều / Chuẩn supremum |
| Contraction Mapping Theorem / Banach Fixed Point | Định lý ánh xạ co / Định lý điểm bất động Banach |
| Correspondence | Tương quan (ánh xạ đa trị) |
| Upper / Lower Hemicontinuity | Nửa liên tục trên / Nửa liên tục dưới |
| Berge's Maximum Theorem | Định lý giá trị cực đại Berge |
| Dual Space / Linear Functional | Không gian đối ngẫu / Phiếm hàm tuyến tính |
| Separating Hyperplane Theorem (Hahn-Banach) | Định lý tách siêu phẳng (Hahn-Banach) |

---

## 3. Quy trình Dịch Sách Lớn bằng Subagents Song song

Khi dịch một cuốn sách gồm nhiều chương:

```mermaid
flowchart TD
    A[Các chương tiếng Anh đã chuẩn hóa] --> B[Bước 1: Thiết lập Bảng thuật ngữ Glossary chuẩn]
    B --> C[Bước 2: Lập kế hoạch & File tiến độ PLAN_TIEN_DO_DICH.md]
    C --> D[Bước 3: Điều phối Subagents song song tối đa 3-5 luồng]
    D --> E[Bước 4: Nhúng Glossary & Prompt chuẩn cho từng Subagent]
    E --> F[Bước 5: Lưu bản dịch vào vietnamese_chapters/]
    F --> G[Bước 6: Kiểm tra chéo cú pháp LaTeX $ và nghiệm thu]
```

### Bước 1: Khởi tạo Kế hoạch
Tạo file `vietnamese_chapters/PLAN_TIEN_DO_DICH.md` theo dõi tiến độ từng chương.

### Bước 2: Điều phối Subagents Song song
- **Giới hạn luồng:** Chạy tối đa **3 đến 5 subagents** đồng thời theo từng Batch.
- **Quy tắc phân công:** Mỗi subagent nhận 1 chương (đối với chương dài >1.000 dòng) hoặc 2 chương (đối với chương ngắn).
- **Cập nhật cuốn chiếu:** Khi subagent báo cáo xong 1 chương, kiểm tra số dòng, cập nhật file `PLAN_TIEN_DO_DICH.md`, và kích hoạt chương tiếp theo trong hàng đợi.

---

## 4. Template Prompt chuẩn cho Subagent Translator

```text
Bạn là một chuyên gia dịch thuật học thuật cấp cao (Academic Translator).
Nhiệm vụ của bạn là dịch chương sách sau từ tiếng Anh sang tiếng Việt học thuật chuẩn mực cao cấp:
- File đầu vào: <path_source_en>
- File đầu ra: <path_target_vi>

BẢNG THUẬT NGỮ CHUẨN CẦN TUÂN THỦ:
<chèn danh sách thuật ngữ chuyên ngành tương ứng>

YÊU CẦU BẮT BUỘC:
1. Dịch 100% nội dung, không cắt ngắn, không tóm lược, không dùng placeholder.
2. Giữ nguyên toàn bộ công thức toán học LaTeX inline $ ... $ và display $$ ... $$.
3. Giữ nguyên cấu trúc Callout Blockquote (> **Định nghĩa ...**, > **Định lý ...**, > **Mệnh đề ...**).
4. Giữ nguyên liên kết hình ảnh figures và bảng số liệu Markdown table.
5. Dịch toàn bộ các chú thích chân trang [^fn...].
6. Ghi nội dung hoàn thiện vào file đầu ra và báo cáo số dòng, kích thước sau khi hoàn tất.
```
