#!/bin/bash
# kids-draw 画画乐园 启停脚本

PORT=3000
PID_FILE="$(dirname "$0")/.kids-draw.pid"
LOG_FILE="$(dirname "$0")/.kids-draw.log"
SERVER="$(dirname "$0")/server.js"

start() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "服务已在运行中 (PID: $(cat "$PID_FILE"))"
        return 1
    fi
    echo "正在启动画画乐园..."
    nohup node "$SERVER" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "启动成功! 访问 http://localhost:$PORT"
        echo "iPad 请访问: http://<本机IP>:$PORT"
    else
        echo "启动失败，请查看日志: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "服务未运行"
        return 1
    fi
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "正在停止画画乐园 (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        echo "已停止"
    else
        echo "进程已不存在，清理 PID 文件"
        rm -f "$PID_FILE"
    fi
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "画画乐园运行中 (PID: $(cat "$PID_FILE")), 端口: $PORT"
    else
        echo "画画乐园未运行"
        rm -f "$PID_FILE"
    fi
}

case "$1" in
    start)   start   ;;
    stop)    stop    ;;
    restart) stop; sleep 1; start ;;
    status)  status  ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
