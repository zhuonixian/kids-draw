# 构建环境变量（本文件入库；签名密钥见 keystore/，一律不入库）
# 用法: source env.sh
export JAVA_HOME="$HOME/tools/jdk-21"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
