#!/usr/bin/env bash
set -e

PENPOT_DIR="${PENPOT_DIR:-$HOME/.config/penpot}"
COMPOSE_FILE="$PENPOT_DIR/docker-compose.yaml"
PROJECT_NAME="penpot"

function ensure_compose_file() {
	if [ ! -f "$COMPOSE_FILE" ]; then
		echo "⚠️  Chưa tìm thấy file cấu hình tại $COMPOSE_FILE"
		echo "💡 Đang tự động chạy setup..."
		setup_penpot
	fi
}

function get_running_containers() {
	docker ps -q --filter "label=com.docker.compose.project=$PROJECT_NAME"
}

function setup_penpot() {
	echo "📦 Bắt đầu thiết lập Penpot Docker Compose..."
	mkdir -p "$PENPOT_DIR"

	if [ -f "$COMPOSE_FILE" ]; then
		echo "ℹ️  File cấu hình đã tồn tại tại: $COMPOSE_FILE"
		read -rp "Bạn có muốn tải lại và ghi đè cấu hình mới nhất không? (y/N): " confirm
		if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
			echo "Đã hủy ghi đè."
			return 0
		fi
	fi

	echo "⬇️  Đang tải docker-compose.yaml chính thức từ Penpot..."
	TEMP_COMPOSE=$(mktemp)
	curl -fsSL https://raw.githubusercontent.com/penpot/penpot/main/docker/images/docker-compose.yaml -o "$TEMP_COMPOSE"

	# Thêm name: penpot ở đầu file để đồng bộ project name
	echo "name: $PROJECT_NAME" >"$COMPOSE_FILE"
	echo "" >>"$COMPOSE_FILE"
	cat "$TEMP_COMPOSE" >>"$COMPOSE_FILE"
	rm -f "$TEMP_COMPOSE"

	# Tối ưu RAM cho backend JVM (-Xmx512m -Xms256m)
	if grep -q "penpot-backend:" "$COMPOSE_FILE"; then
		sed -i '/<< : \[\*penpot-flags, \*penpot-public-uri, \*penpot-http-body-size, \*penpot-secret-key, \*penpot-database\]/a \ \ \ \ \ \ # Giới hạn bộ nhớ JVM để tiết kiệm RAM\n      PENPOT_JAVA_OPTS: "-Xmx512m -Xms256m"' "$COMPOSE_FILE"
	fi

	echo "✅ Đã tạo cấu hình thành công tại: $COMPOSE_FILE"
	echo "⚡ Đã cấu hình tối ưu JVM Heap size (-Xmx512m) giúp tránh ngốn RAM."

	read -rp "Bạn có muốn pull sẵn các docker image không? (Y/n): " pull_confirm
	if [[ ! "$pull_confirm" =~ ^[Nn]$ ]]; then
		echo "📥 Đang tải các docker images (có thể mất vài phút)..."
		docker compose -f "$COMPOSE_FILE" pull
		echo "✅ Đã tải xong images!"
	fi

	echo ""
	echo "🎉 Thiết lập hoàn tất! Bạn có thể khởi động Penpot bằng lệnh:"
	echo "   penpot start"
	echo "Sau khi bật, truy cập giao diện tại: http://localhost:9001"
}

case "$1" in
setup | init)
	setup_penpot
	;;
start | up)
	ensure_compose_file
	echo "🚀 Đang khởi động Penpot qua Docker Compose..."
	docker compose -f "$COMPOSE_FILE" up -d
	echo "✅ Penpot đã bật thành công!"
	"$0" status
	echo "🌐 Truy cập Penpot tại: http://localhost:9001"
	;;
stop)
	ensure_compose_file
	echo "🛑 Đang tạm dừng các container Penpot để giải phóng RAM..."
	running=$(get_running_containers)
	if [ -n "$running" ]; then
		docker compose -f "$COMPOSE_FILE" stop
		echo "✅ Đã tạm dừng Penpot. Đã giải phóng RAM thành công!"
	else
		echo "ℹ️  Penpot hiện không chạy."
	fi
	;;
down)
	ensure_compose_file
	echo "🔻 Đang hạ toàn bộ container Penpot..."
	docker compose -f "$COMPOSE_FILE" down
	echo "✅ Đã hạ Penpot (Dữ liệu database & assets vẫn được lưu an toàn trong Docker volumes)."
	;;
restart)
	ensure_compose_file
	echo "🔄 Đang khởi động lại Penpot..."
	docker compose -f "$COMPOSE_FILE" restart
	"$0" status
	;;
status)
	echo "📊 Trạng thái các container Penpot:"
	if command -v nu >/dev/null 2>&1; then
		nu -c '
        docker ps -a --filter "label=com.docker.compose.project=penpot" --format "{{json .}}"
        | lines
        | where ($it | is-not-empty)
        | each { from json }
        | insert Service { |it| $it.Names | str replace "penpot-penpot-" "" | str replace "-1" "" }
        | select Service State Status Ports
        | sort-by Service
      '
	else
		docker ps -a --filter "label=com.docker.compose.project=penpot" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	fi
	;;
ram | stats)
	echo "📈 Mức sử dụng tài nguyên Penpot:"
	running=$(get_running_containers)
	if [ -z "$running" ]; then
		echo "ℹ️  Penpot đang tắt, không tốn RAM."
		exit 0
	fi

	if command -v nu >/dev/null 2>&1; then
		nu -c '
        let running = (docker ps -q --filter "label=com.docker.compose.project=penpot" | lines)
        docker stats --no-stream --format "{{json .}}" ...$running
        | lines
        | where ($it | is-not-empty)
        | each { from json }
        | insert Service { |it| $it.Name | str replace "penpot-penpot-" "" | str replace "-1" "" }
        | select Service MemUsage MemPerc CPUPerc NetIO
        | sort-by Service
      '
	else
		docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" $running
	fi
	;;
logs)
	ensure_compose_file
	shift
	docker compose -f "$COMPOSE_FILE" logs -f "$@"
	;;
edit)
	ensure_compose_file
	"${EDITOR:-nano}" "$COMPOSE_FILE"
	;;
pull | update)
	ensure_compose_file
	echo "⬇️  Đang cập nhật image Penpot mới nhất..."
	docker compose -f "$COMPOSE_FILE" pull
	echo "🔄 Đang áp dụng cập nhật..."
	docker compose -f "$COMPOSE_FILE" up -d
	echo "✅ Đã cập nhật xong!"
	;;
*)
	echo "Cách dùng: penpot {setup|start|stop|down|restart|status|ram|logs|edit|pull}"
	echo "  penpot setup   : Cài đặt và cấu hình Penpot Docker Compose (tối ưu RAM)"
	echo "  penpot start   : Bật Penpot qua docker compose"
	echo "  penpot stop    : Dừng Penpot để giải phóng RAM"
	echo "  penpot down    : Dừng và xóa containers (dữ liệu vẫn giữ nguyên)"
	echo "  penpot restart : Khởi động lại Penpot"
	echo "  penpot status  : Xem trạng thái (vẽ bảng Nushell)"
	echo "  penpot ram     : Kiểm tra RAM tiêu thụ (vẽ bảng Nushell)"
	echo "  penpot logs    : Xem logs realtime"
	echo "  penpot edit    : Chỉnh sửa file docker-compose.yaml"
	echo "  penpot pull    : Cập nhật images Penpot mới nhất"
	exit 1
	;;
esac
