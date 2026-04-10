#!/bin/bash

TOKEN=${TELEGRAM_TOKEN_NOVEL_BOT}
CHAT_ID=${TELEGRAM_GROUP_NOVEL_BOT}
FILE=$1

if [[ ! -f "$FILE" ]]; then
    echo "Lỗi: File '$FILE' không tồn tại!"
    exit 1
fi

FILE_SIZE=$(stat -c%s "$FILE")
MAX_SIZE=$((50 * 1024 * 1024))

if [ "$FILE_SIZE" -gt "$MAX_SIZE" ]; then
    echo "Cảnh báo: File lớn hơn 50MB. Vui lòng dùng 'telegram-upload' thay thế."
    exit 1
fi

echo "Đang đẩy file: $(basename "$FILE")..."

RESPONSE=$(curl -s -F document=@"$FILE" "https://api.telegram.org/bot$TOKEN/sendDocument?chat_id=$CHAT_ID")

if [[ $RESPONSE == *"\"ok\":true"* ]]; then
    echo "Thành công! Kiểm tra điện thoại của bạn."
else
    echo "Thất bại. Chi tiết lỗi: $RESPONSE"
fi
