#!/bin/bash

TOKEN=${TELEGRAM_TOKEN_NOVEL_BOT}
CHAT_ID=${TELEGRAM_GROUP_NOVEL_BOT}
FILE=$1

if [[ -z "$TOKEN" ]]; then
    echo "Lỗi: Biến môi trường TELEGRAM_TOKEN_NOVEL_BOT chưa được thiết lập!"
    exit 1
fi

if [[ -z "$CHAT_ID" ]]; then
    echo "Lỗi: Biến môi trường TELEGRAM_GROUP_NOVEL_BOT chưa được thiết lập!"
    exit 1
fi

if [[ -z "$FILE" ]]; then
    echo "Lỗi: Thiếu đường dẫn file. Cách dùng: $0 <file>"
    exit 1
fi

if [[ ! -f "$FILE" ]]; then
    echo "Lỗi: File '$FILE' không tồn tại!"
    echo "  Đường dẫn tuyệt đối: $(readlink -f "$FILE" 2>/dev/null || echo 'Không thể xác định')"
    echo "  Thư mục hiện tại: $(pwd)"
    exit 1
fi

FILE_SIZE=$(stat -c%s "$FILE")
MAX_SIZE=$((50 * 1024 * 1024))

if [ "$FILE_SIZE" -gt "$MAX_SIZE" ]; then
    echo "Cảnh báo: File lớn hơn 50MB. Vui lòng dùng 'telegram-upload' thay thế."
    echo "  Kích thước file: $FILE_SIZE bytes ($(numfmt --to=iec-i $FILE_SIZE))"
    echo "  Giới hạn tối đa: $MAX_SIZE bytes (50 MiB)"
    exit 1
fi

echo "Đang đẩy file: $(basename "$FILE")..."
echo "  Kích thước: $(numfmt --to=iec-i $FILE_SIZE)"
echo "  Chat ID: $CHAT_ID"

RESPONSE=$(curl -s -F document=@"$FILE" "https://api.telegram.org/bot$TOKEN/sendDocument?chat_id=$CHAT_ID")
HTTP_CODE=$?

if [ $HTTP_CODE -ne 0 ]; then
    echo "Lỗi kết nối: curl thoát với mã $HTTP_CODE"
    echo "  Phản hồi: $RESPONSE"
    exit 1
fi

if [[ $RESPONSE == *"\"ok\":true"* ]]; then
    echo "Thành công! Kiểm tra điện thoại của bạn."
else
    echo "Thất bại khi gửi file đến Telegram."
    echo "  Mã phản hồi HTTP: $HTTP_CODE"
    echo "  Chi tiết lỗi từ API: $RESPONSE"
    
    # Phân tích lỗi phổ biến
    if [[ $RESPONSE == *"\"error_code\":400"* ]]; then
        echo "  → Lỗi 400: Yêu cầu không hợp lệ (chat ID sai, file không hợp lệ, v.v.)"
    elif [[ $RESPONSE == *"\"error_code\":401"* ]]; then
        echo "  → Lỗi 401: Token bot không hợp lệ hoặc đã bị thu hồi"
    elif [[ $RESPONSE == *"\"error_code\":403"* ]]; then
        echo "  → Lỗi 403: Bot không có quyền gửi tin nhắn đến chat này"
    elif [[ $RESPONSE == *"\"error_code\":413"* ]]; then
        echo "  → Lỗi 413: File quá lớn (giới hạn thực tế của Telegram)"
    elif [[ $RESPONSE == *"\"error_code\":429"* ]]; then
        echo "  → Lỗi 429: Gửi quá nhiều yêu cầu, vui lòng đợi"
    elif [[ $RESPONSE == *"\"error_code\":500"* ]] || [[ $RESPONSE == *"\"error_code\":502"* ]]; then
        echo "  → Lỗi máy chủ Telegram, vui lòng thử lại sau"
    fi
    
    exit 1
fi
