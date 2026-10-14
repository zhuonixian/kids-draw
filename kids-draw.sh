#!/bin/bash
# kids-draw 画画乐园 启停脚本（nohup 后台运行，pid + 日志管理）
# 用法: ./kids-draw.sh {start|stop|restart|status|log}

PORT=3000
DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.kids-draw.pid"
LOG_FILE="$DIR/.kids-draw.log"
SERVER="$DIR/server.js"

# 本机局域网 IP（iPad/手机 访问用）
lan_ip() {
    ip route get 1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}'
}

# 占用端口的进程 pid（无则输出空）
port_pid() {
    ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1
}

running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start() {
    if running; then
        echo "✔ 服务已在运行 (PID $(cat "$PID_FILE"))"
        echo "  本机:  http://localhost:$PORT"
        echo "  iPad:  http://$(lan_ip):$PORT"
        return 0
    fi
    # pid 记录失效但端口被孤儿进程占用 → 接管清理
    local occupant
    occupant=$(port_pid)
    if [ -n "$occupant" ]; then
        echo "端口 $PORT 被无记录进程 $occupant 占用，正在接管..."
        kill "$occupant" 2>/dev/null
        sleep 1
        if [ -n "$(port_pid)" ]; then
            echo "✘ 无法释放端口 $PORT，请手动处理: ss -tlnp | grep $PORT"
            return 1
        fi
    fi
    rm -f "$PID_FILE"

    # 日志超 5MB 只留末尾 1MB，避免长期运行无限增长
    if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 5242880 ]; then
        tail -c 1048576 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi

    echo "正在启动画画乐园..."
    nohup node "$SERVER" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    # 健康检查：进程存活 + HTTP 真正响应（最多等 5 秒）
    local i
    for i in $(seq 1 10); do
        if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "✘ 启动失败，日志末尾："
            tail -5 "$LOG_FILE"
            rm -f "$PID_FILE"
            return 1
        fi
        if curl -s -o /dev/null --max-time 1 "http://localhost:$PORT/"; then
            echo "✔ 启动成功 (PID $(cat "$PID_FILE"))"
            echo "  本机:  http://localhost:$PORT"
            echo "  iPad:  http://$(lan_ip):$PORT"
            echo "  日志:  $LOG_FILE"
            return 0
        fi
        sleep 0.5
    done
    echo "✘ 进程已启动但 HTTP 无响应，请查看日志: $LOG_FILE"
    return 1
}

stop() {
    if running; then
        local pid
        pid=$(cat "$PID_FILE")
        echo "正在停止 (PID $pid)..."
        kill "$pid" 2>/dev/null
        # 最多等 3 秒，超时强杀
        local i
        for i in 1 2 3; do
            kill -0 "$pid" 2>/dev/null || break
            sleep 1
        done
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        echo "✔ 已停止"
    else
        rm -f "$PID_FILE"
        local occupant
        occupant=$(port_pid)
        if [ -n "$occupant" ]; then
            echo "发现占用端口 $PORT 的孤儿进程 $occupant，已停止它"
            kill "$occupant" 2>/dev/null
        else
            echo "服务未在运行"
        fi
    fi
}

status() {
    if running; then
        echo "✔ 运行中 (PID $(cat "$PID_FILE"))，端口 $PORT"
        curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" \
            && echo "✔ HTTP 正常  本机: http://localhost:$PORT  iPad: http://$(lan_ip):$PORT" \
            || echo "✘ 进程在但 HTTP 无响应，建议: $0 restart"
    else
        echo "✘ 未运行。启动: $0 start"
    fi
}

log() {
    [ -f "$LOG_FILE" ] && tail -f "$LOG_FILE" || echo "暂无日志 ($LOG_FILE)"
}

case "$1" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    log)     log ;;
    *)
        echo "画画乐园服务启停脚本（后台运行，不占用终端）"
        echo "用法: $0 {start|stop|restart|status|log}"
        echo "  start    后台启动（含健康检查与 IP 提示）"
        echo "  stop     停止（自动清理孤儿端口占用）"
        echo "  restart  重启"
        echo "  status   查看运行状态"
        echo "  log      跟踪日志（Ctrl+C 退出，不影响服务）"
        exit 1
        ;;
esac
