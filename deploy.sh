#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 默认配置
REMOTE_USER="root"
REMOTE_HOST=""
REMOTE_PORT="22"
REMOTE_DIR="/var/www/html"
SSH_KEY=""
EXCLUDE_PATTERNS=".git* node_modules* .DS_Store* *.md jsconfig.json .vscode* .idea* .env* package-lock.json yarn.lock"
UPLOAD_MODE="tar"  # 修改默认上传模式为压缩包方式

# 配置文件
CONFIG_FILE="deploy.conf"

# 读取配置文件（如果存在）
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# 显示帮助信息
show_help() {
    echo -e "${BLUE}PureAI Panel 部署脚本${NC}"
    echo
    echo -e "用法: $0 [选项] [命令]"
    echo
    echo "命令:"
    echo "  deploy      部署项目到远程服务器"
    echo "  rollback    回滚到之前的版本"
    echo "  config      配置部署参数"
    echo "  help        显示帮助信息"
    echo
    echo "选项:"
    echo "  -h, --host      指定远程主机地址"
    echo "  -u, --user      指定远程用户名"
    echo "  -p, --port      指定SSH端口"
    echo "  -d, --dir       指定远程部署目录"
    echo "  -k, --key       指定SSH密钥路径"
    echo "  -e, --exclude   指定额外排除的文件模式（用空格分隔）"
    echo
    echo "示例:"
    echo "  $0 config                       # 配置部署参数"
    echo "  $0 -h 192.168.1.100 deploy      # 部署到指定服务器"
    echo "  $0 rollback                     # 回滚到之前的版本"
    echo
    echo "提示: 首次使用建议先运行 '$0 config' 配置部署参数"
}

# 保存配置到文件
save_config() {
    cat > "$CONFIG_FILE" << EOF
# 部署配置文件
REMOTE_USER="$REMOTE_USER"
REMOTE_HOST="$REMOTE_HOST"
REMOTE_PORT="$REMOTE_PORT"
REMOTE_DIR="$REMOTE_DIR"
SSH_KEY="$SSH_KEY"
EXCLUDE_PATTERNS="$EXCLUDE_PATTERNS"
UPLOAD_MODE="$UPLOAD_MODE"
EOF
    echo -e "${GREEN}配置已保存到 $CONFIG_FILE${NC}"
}

# SSH/SCP命令构建
build_ssh_cmd() {
    local CMD="ssh"
    
    if [ -n "$SSH_KEY" ]; then
        CMD="$CMD -i $SSH_KEY"
    fi
    
    CMD="$CMD -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}"
    echo "$CMD"
}

build_rsync_cmd() {
    # 基本命令，增加了忽略部分错误的参数
    local CMD="rsync -avz --delete"
    
    # 添加忽略错误选项和权限设置
    CMD="$CMD --ignore-errors"
    
    if [ -n "$SSH_KEY" ]; then
        CMD="$CMD -e \"ssh -i $SSH_KEY -p $REMOTE_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null\""
    else
        CMD="$CMD -e \"ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null\""
    fi
    
    # 添加排除参数
    for pattern in $EXCLUDE_PATTERNS; do
        CMD="$CMD --exclude=\"$pattern\""
    done
    
    echo "$CMD"
}

# 检查必要参数
check_required_params() {
    local MISSING=""
    
    if [ -z "$REMOTE_HOST" ]; then
        MISSING="$MISSING\n  - 远程主机地址 (-h, --host)"
    fi
    
    if [ -z "$REMOTE_USER" ]; then
        MISSING="$MISSING\n  - 远程用户名 (-u, --user)"
    fi
    
    if [ -n "$MISSING" ]; then
        echo -e "${RED}错误: 缺少必要参数:${NC}$MISSING"
        echo -e "${YELLOW}提示: 使用 '$0 config' 配置部署参数${NC}"
        return 1
    fi
    
    return 0
}

# 自动检测SSH密钥
detect_ssh_keys() {
    local KEYS=()
    local KEY_NAMES=()
    
    # 检查常见的SSH密钥位置
    local SSH_DIR="$HOME/.ssh"
    
    if [ -d "$SSH_DIR" ]; then
        # 查找所有私钥文件（不包含.pub后缀的文件）
        while IFS= read -r key_file; do
            # 排除.pub文件和已知的非私钥文件
            if [[ "$key_file" != *.pub && "$key_file" != *known_hosts* && "$key_file" != *config* && "$key_file" != *authorized_keys* ]]; then
                KEYS+=("$key_file")
                KEY_NAMES+=("$(basename "$key_file")")
            fi
        done < <(find "$SSH_DIR" -type f 2>/dev/null)
    fi
    
    # 如果没有找到任何密钥
    if [ ${#KEYS[@]} -eq 0 ]; then
        echo ""
        return 1
    fi
    
    # 如果只找到一个密钥
    if [ ${#KEYS[@]} -eq 1 ]; then
        echo "${KEYS[0]}"
        return 0
    fi
    
    # 如果找到多个密钥，让用户选择
    echo -e "${BLUE}检测到多个SSH密钥:${NC}"
    for i in "${!KEY_NAMES[@]}"; do
        echo "  $((i+1)). ${KEY_NAMES[i]} (${KEYS[i]})"
    done
    
    echo
    read -p "请选择要使用的密钥 [1-${#KEYS[@]}]: " key_choice
    
    # 验证用户输入
    if ! [[ "$key_choice" =~ ^[0-9]+$ ]] || [ "$key_choice" -lt 1 ] || [ "$key_choice" -gt ${#KEYS[@]} ]; then
        echo -e "${RED}无效的选择，不使用SSH密钥${NC}"
        echo ""
        return 1
    fi
    
    # 返回用户选择的密钥路径
    echo "${KEYS[$((key_choice-1))]}"
    return 0
}

# 配置参数
configure() {
    echo -e "${BLUE}配置部署参数${NC}"
    echo
    
    # 读取远程主机
    read -p "远程主机地址 [$REMOTE_HOST]: " input
    if [ -n "$input" ]; then REMOTE_HOST="$input"; fi
    
    # 读取远程用户
    read -p "远程用户名 [$REMOTE_USER]: " input
    if [ -n "$input" ]; then REMOTE_USER="$input"; fi
    
    # 读取SSH端口
    read -p "SSH端口 [$REMOTE_PORT]: " input
    if [ -n "$input" ]; then REMOTE_PORT="$input"; fi
    
    # 读取远程目录并确保是绝对路径
    read -p "远程部署目录 [$REMOTE_DIR]: " input
    if [ -n "$input" ]; then
        # 确保是绝对路径
        if [[ "$input" != /* ]]; then
            echo -e "${YELLOW}警告: 您输入的不是绝对路径，将自动修正${NC}"
            input="/$input"
        fi
        REMOTE_DIR="$input"
    fi
    
    # SSH密钥配置
    echo
    echo -e "${BLUE}SSH密钥配置:${NC}"
    echo "1. 手动输入SSH密钥路径"
    echo "2. 自动检测SSH密钥 (推荐)"
    echo "3. 不使用SSH密钥 (使用密码认证)"
    read -p "请选择 [1-3]: " key_option
    
    case $key_option in
        1)
            # 手动输入
            read -p "SSH密钥路径 [$SSH_KEY]: " input
            if [ -n "$input" ]; then SSH_KEY="$input"; fi
            ;;
        2)
            # 自动检测
            echo -e "${BLUE}正在检测SSH密钥...${NC}"
            auto_key=$(detect_ssh_keys)
            if [ -n "$auto_key" ]; then
                SSH_KEY="$auto_key"
                echo -e "${GREEN}已选择SSH密钥: $SSH_KEY${NC}"
            else
                echo -e "${YELLOW}未检测到SSH密钥，将使用密码认证${NC}"
                SSH_KEY=""
            fi
            ;;
        3|*)
            # 不使用SSH密钥
            echo -e "${BLUE}将使用密码认证${NC}"
            SSH_KEY=""
            ;;
    esac
    
    # 读取排除模式
    read -p "排除文件模式 (用空格分隔) [$EXCLUDE_PATTERNS]: " input
    if [ -n "$input" ]; then EXCLUDE_PATTERNS="$input"; fi
    
    # 上传模式配置 - 默认使用压缩包模式，但仍提供选项
    UPLOAD_MODE="tar"  # 默认使用压缩包模式
    echo
    echo -e "${BLUE}上传模式配置:${NC}"
    echo -e "${GREEN}默认使用压缩包模式部署 (推荐，更可靠)${NC}"
    read -p "是否要修改上传模式? (y/n) [n]: " change_mode
    
    if [ "$change_mode" = "y" ] || [ "$change_mode" = "Y" ]; then
        echo "上传模式选项:"
        echo "1. 使用压缩包上传解压 (适合权限受限环境，推荐)"
        echo "2. 使用rsync直接上传 (适合稳定环境)"
        read -p "请选择上传模式 [1-2] (默认: 1): " upload_mode_option
        
        case $upload_mode_option in
            2)
                UPLOAD_MODE="rsync"
                echo -e "${BLUE}将使用rsync模式上传${NC}"
                ;;
            1|*)
                UPLOAD_MODE="tar"
                echo -e "${BLUE}将使用压缩包模式上传${NC}"
                ;;
        esac
    else
        echo -e "${BLUE}保持使用压缩包模式上传${NC}"
    fi
    
    # 保存配置
    save_config
    
    echo -e "${GREEN}配置完成!${NC}"
    echo -e "使用 '$0 deploy' 部署项目"
}

# 检查SSH密钥是否已上传到服务器
check_ssh_key_uploaded() {
    if [ -z "$SSH_KEY" ]; then
        # 未配置SSH密钥
        return 1
    fi
    
    # 构建测试命令，使用-o BatchMode=yes参数确保不会询问密码
    # 增加-v参数用于调试
    local TEST_CMD="ssh -v -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5"
    
    if [ -n "$SSH_KEY" ]; then
        TEST_CMD="$TEST_CMD -i $SSH_KEY"
    fi
    
    TEST_CMD="$TEST_CMD -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} echo 'SSH_KEY_TEST_OK'"
    
    echo -e "${BLUE}尝试SSH免密登录测试...${NC}"
    
    # 尝试无密码登录，同时捕获详细输出用于诊断
    local TEST_OUTPUT=$(eval "$TEST_CMD" 2>&1)
    local TEST_RESULT=$(echo "$TEST_OUTPUT" | grep "SSH_KEY_TEST_OK")
    
    if [ -n "$TEST_RESULT" ]; then
        echo -e "${GREEN}密钥认证成功!${NC}"
        return 0
    else
        echo -e "${YELLOW}密钥认证失败，分析问题中...${NC}"
        
        # 分析问题原因
        if echo "$TEST_OUTPUT" | grep -q "Permission denied (publickey"; then
            echo -e "${YELLOW}密钥认证被拒绝。可能原因:${NC}"
            echo -e "1. 服务器SSH配置不允许密钥认证"
            echo -e "2. 密钥权限不正确"
            echo -e "3. 服务器未正确接受密钥"
        fi
        
        if echo "$TEST_OUTPUT" | grep -q "Server refused our key"; then
            echo -e "${YELLOW}服务器拒绝了您的密钥，可能需要检查服务器SSH配置${NC}"
        fi
        
        # 提示输出SSH调试信息
        echo -e "${BLUE}详细调试信息:${NC}"
        echo "$TEST_OUTPUT" | grep -i "debug\|authentica\|key\|denied\|refuse\|error" | head -10
        
        # 询问是否尝试修复服务器端SSH配置
        read -p "是否尝试修复服务器端SSH配置? (y/n) [y]: " fix_ssh_config
        if [ "$fix_ssh_config" != "n" ] && [ "$fix_ssh_config" != "N" ]; then
            fix_remote_ssh_config
        fi
        
        return 1
    fi
}

# 尝试修复远程服务器的SSH配置
fix_remote_ssh_config() {
    echo -e "${BLUE}尝试修复服务器SSH配置...${NC}"
    
    # 构建SSH命令
    local SSH_CMD="ssh"
    if [ -n "$SSH_KEY" ]; then
        SSH_CMD="$SSH_CMD -i $SSH_KEY"
    fi
    SSH_CMD="$SSH_CMD -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}"
    
    # 检查是否可以登录服务器
    echo -e "${BLUE}正在连接服务器检查SSH配置...${NC}"
    
    # 创建用于修复SSH配置的临时脚本
    cat > ./tmp_fix_ssh.sh << 'EOF'
#!/bin/bash

# 检查SSH配置
SSH_CONFIG="/etc/ssh/sshd_config"
echo "检查SSH配置文件..."

if [ -f "$SSH_CONFIG" ]; then
    # 检查关键配置项
    PUBKEY_AUTH=$(grep -i "^PubkeyAuthentication" $SSH_CONFIG)
    PASS_AUTH=$(grep -i "^PasswordAuthentication" $SSH_CONFIG)
    AUTH_KEYS=$(grep -i "^AuthorizedKeysFile" $SSH_CONFIG)
    
    echo "当前配置:"
    if [ -n "$PUBKEY_AUTH" ]; then echo "  $PUBKEY_AUTH"; else echo "  PubkeyAuthentication 未设置"; fi
    if [ -n "$PASS_AUTH" ]; then echo "  $PASS_AUTH"; else echo "  PasswordAuthentication 未设置"; fi
    if [ -n "$AUTH_KEYS" ]; then echo "  $AUTH_KEYS"; else echo "  AuthorizedKeysFile 未设置"; fi
    
    # 检查是否需要修改
    NEED_RESTART=0
    
    # 确保PubkeyAuthentication为yes
    if ! grep -q "^PubkeyAuthentication yes" "$SSH_CONFIG"; then
        echo "设置 PubkeyAuthentication yes"
        if grep -q "^PubkeyAuthentication" "$SSH_CONFIG"; then
            sudo sed -i 's/^PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSH_CONFIG"
        else
            echo "PubkeyAuthentication yes" | sudo tee -a "$SSH_CONFIG" > /dev/null
        fi
        NEED_RESTART=1
    fi
    
    # 检查AuthorizedKeysFile设置
    if ! grep -q "^AuthorizedKeysFile" "$SSH_CONFIG"; then
        echo "设置 AuthorizedKeysFile 为默认路径"
        echo "AuthorizedKeysFile .ssh/authorized_keys" | sudo tee -a "$SSH_CONFIG" > /dev/null
        NEED_RESTART=1
    fi
    
    # 检查.ssh目录权限
    echo "检查 .ssh 目录权限..."
    USER_HOME=$(eval echo ~${SUDO_USER:-$USER})
    if [ -d "$USER_HOME/.ssh" ]; then
        SSH_DIR_PERMS=$(stat -c "%a" "$USER_HOME/.ssh")
        AUTH_KEYS_FILE="$USER_HOME/.ssh/authorized_keys"
        
        if [ "$SSH_DIR_PERMS" != "700" ]; then
            echo "修正 .ssh 目录权限为 700"
            chmod 700 "$USER_HOME/.ssh"
        fi
        
        if [ -f "$AUTH_KEYS_FILE" ]; then
            AUTH_KEYS_PERMS=$(stat -c "%a" "$AUTH_KEYS_FILE")
            if [ "$AUTH_KEYS_PERMS" != "600" ]; then
                echo "修正 authorized_keys 文件权限为 600"
                chmod 600 "$AUTH_KEYS_FILE"
            fi
        fi
    else
        echo "$USER_HOME/.ssh 目录不存在，无法检查权限"
    fi
    
    # 重启SSH服务（如果需要）
    if [ $NEED_RESTART -eq 1 ]; then
        echo "重启SSH服务以应用更改..."
        if command -v systemctl &> /dev/null; then
            sudo systemctl restart sshd
        elif command -v service &> /dev/null; then
            sudo service sshd restart
        else
            echo "无法自动重启SSH服务，请手动重启"
        fi
    fi
    
    echo "SSH配置检查完成"
else
    echo "错误: SSH配置文件 $SSH_CONFIG 不存在"
fi
EOF
    
    # 上传并执行修复脚本
    scp -P $REMOTE_PORT ./tmp_fix_ssh.sh ${REMOTE_USER}@${REMOTE_HOST}:/tmp/fix_ssh.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${BLUE}开始修复SSH配置...${NC}"
        $SSH_CMD "chmod +x /tmp/fix_ssh.sh && /tmp/fix_ssh.sh && rm -f /tmp/fix_ssh.sh"
        
        echo -e "${BLUE}等待SSH服务重启...${NC}"
        sleep 5
        
        # 再次尝试密钥认证
        TEST_CMD="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5"
        if [ -n "$SSH_KEY" ]; then
            TEST_CMD="$TEST_CMD -i $SSH_KEY"
        fi
        TEST_CMD="$TEST_CMD -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} echo 'SSH_KEY_TEST_AFTER_FIX'"
        
        if eval "$TEST_CMD" 2>/dev/null | grep -q "SSH_KEY_TEST_AFTER_FIX"; then
            echo -e "${GREEN}SSH配置修复成功! 密钥认证现在可以工作了${NC}"
            rm -f ./tmp_fix_ssh.sh
            return 0
        else
            echo -e "${YELLOW}修复尝试后密钥认证仍不工作${NC}"
            echo -e "${YELLOW}尝试修复本地密钥文件权限...${NC}"
            
            # 修复本地密钥权限
            if [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
                chmod 600 "$SSH_KEY"
                echo -e "${BLUE}更新了密钥文件权限: $SSH_KEY${NC}"
                
                # 再次测试
                if eval "$TEST_CMD" 2>/dev/null | grep -q "SSH_KEY_TEST_AFTER_FIX"; then
                    echo -e "${GREEN}修复本地密钥权限成功! 密钥认证现在可以工作了${NC}"
                    rm -f ./tmp_fix_ssh.sh
                    return 0
                fi
            fi
            
            # 提示可能需要手动干预
            echo -e "${YELLOW}自动修复失败。问题可能需要手动解决:${NC}"
            echo -e "1. 确保远程服务器允许密钥认证 (PubkeyAuthentication yes)"
            echo -e "2. 检查服务器上的 ~/.ssh 目录和 ~/.ssh/authorized_keys 文件权限"
            echo -e "3. 在目标服务器手动运行: sudo systemctl restart sshd"
            rm -f ./tmp_fix_ssh.sh
            return 1
        fi
    else
        echo -e "${RED}无法上传修复脚本，请检查连接${NC}"
        rm -f ./tmp_fix_ssh.sh
        return 1
    fi
}

# 上传SSH密钥到服务器
upload_ssh_key() {
    if [ -z "$SSH_KEY" ]; then
        echo -e "${YELLOW}未配置SSH密钥，无法上传${NC}"
        return 1
    fi
    
    local PUB_KEY=""
    
    # 检查对应的公钥文件是否存在
    if [ -f "${SSH_KEY}.pub" ]; then
        PUB_KEY="${SSH_KEY}.pub"
    else
        # 尝试在同目录下找到类似名称的公钥
        local KEY_DIR=$(dirname "$SSH_KEY")
        local KEY_NAME=$(basename "$SSH_KEY")
        PUB_KEY=$(find "$KEY_DIR" -name "${KEY_NAME}*.pub" | head -1)
    fi
    
    if [ -z "$PUB_KEY" ] || [ ! -f "$PUB_KEY" ]; then
        echo -e "${RED}错误: 未找到与 $SSH_KEY 对应的公钥文件${NC}"
        echo -e "${YELLOW}提示: 您可以使用以下命令生成公钥:${NC}"
        echo -e "  ssh-keygen -y -f \"$SSH_KEY\" > \"${SSH_KEY}.pub\""
        
        read -p "是否自动生成公钥? (y/n): " gen_pub_key
        if [ "$gen_pub_key" = "y" ] || [ "$gen_pub_key" = "Y" ]; then
            if ! ssh-keygen -y -f "$SSH_KEY" > "${SSH_KEY}.pub" 2>/dev/null; then
                echo -e "${RED}生成公钥失败，可能需要输入密钥密码${NC}"
                if ! ssh-keygen -y -f "$SSH_KEY" > "${SSH_KEY}.pub"; then
                    echo -e "${RED}无法生成公钥，请手动处理${NC}"
                    return 1
                fi
            fi
            PUB_KEY="${SSH_KEY}.pub"
            echo -e "${GREEN}公钥已生成: $PUB_KEY${NC}"
        else
            return 1
        fi
    fi
    
    # 确保本地密钥权限正确
    chmod 600 "$SSH_KEY"
    chmod 644 "$PUB_KEY"
    
    echo -e "${BLUE}正在上传SSH公钥到服务器...${NC}"
    echo -e "公钥文件: $PUB_KEY"
    echo -e "目标服务器: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
    
    # 检查ssh-copy-id命令是否可用
    if ! command -v ssh-copy-id &> /dev/null; then
        echo -e "${YELLOW}警告: 未找到ssh-copy-id命令，将使用手动方法上传密钥${NC}"
        
        # 手动上传密钥
        # 创建临时脚本来处理上传
        cat > ./tmp_upload_key.sh << 'EOF'
#!/bin/bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
EOF
        
        # 上传密钥
        cat "$PUB_KEY" | ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} 'bash -s' < ./tmp_upload_key.sh
        local RESULT=$?
        
        rm -f ./tmp_upload_key.sh
        
        if [ $RESULT -eq 0 ]; then
            echo -e "${GREEN}SSH密钥上传成功${NC}"
            
            # 等待几秒钟让服务器处理新密钥
            echo -e "${BLUE}等待服务器处理密钥...${NC}"
            sleep 3
            
            return 0
        else
            echo -e "${RED}SSH密钥上传失败${NC}"
            return 1
        fi
    else
        # 使用ssh-copy-id上传
        if ssh-copy-id -i "$PUB_KEY" -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}; then
            echo -e "${GREEN}SSH密钥上传成功${NC}"
            
            # 等待几秒钟让服务器处理新密钥
            echo -e "${BLUE}等待服务器处理密钥...${NC}"
            sleep 5  # 增加等待时间，确保服务器处理完成
            
            return 0
        else
            echo -e "${RED}SSH密钥上传失败${NC}"
            return 1
        fi
    fi
}

# 使用tar压缩包模式部署
deploy_using_tar() {
    echo -e "${BLUE}使用压缩包模式部署...${NC}"
    
    # 创建临时目录
    local TEMP_DIR="./deploy_tmp"
    local TEMP_TAR="./frontend_deploy.tar.gz"
    
    echo -e "${BLUE}准备部署文件...${NC}"
    rm -rf "$TEMP_DIR" 2>/dev/null
    mkdir -p "$TEMP_DIR"
    
    # 排除模式转为rsync参数格式
    local EXCLUDE_ARGS=""
    for pattern in $EXCLUDE_PATTERNS; do
        EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern"
    done
    
    # 新增：排除苹果系统的元数据文件
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=\"._*\""
    
    # 复制文件到临时目录
    echo -e "${BLUE}正在准备文件...${NC}"
    # 使用-a参数保留文件权限和所有权
    rsync -a $EXCLUDE_ARGS ./ "$TEMP_DIR/"
    
    # 创建压缩包
    echo -e "${BLUE}正在创建压缩包...${NC}"
    tar -czf "$TEMP_TAR" -C "$TEMP_DIR" .
    
    # 获取文件大小
    local FILE_SIZE=$(du -h "$TEMP_TAR" | cut -f1)
    echo -e "${GREEN}压缩包已创建: $TEMP_TAR (大小: $FILE_SIZE)${NC}"
    
    # 构建SSH命令
    local SSH_BASE="ssh"
    if [ -n "$SSH_KEY" ]; then
        SSH_BASE="$SSH_BASE -i $SSH_KEY"
    fi
    SSH_BASE="$SSH_BASE -p $REMOTE_PORT -o StrictHostKeyChecking=no"
    
    # 检查远程目录是否存在
    echo -e "${BLUE}检查远程目录...${NC}"
    if ! $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "[ -d \"$REMOTE_DIR\" ]" 2>/dev/null; then
        echo -e "${YELLOW}远程目录不存在，正在创建...${NC}"
        $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p \"$REMOTE_DIR\"" || {
            echo -e "${RED}创建远程目录失败${NC}"
            rm -rf "$TEMP_DIR" "$TEMP_TAR"
            return 1
        }
    fi
    
    # 在部署前备份当前版本
    echo -e "${BLUE}备份当前版本...${NC}"
    # 创建远程备份目录
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p \"$REMOTE_DIR/versions\""
    
    # 获取当前时间戳作为版本标识
    local TIMESTAMP=$(date +"%Y%m%d%H%M%S")
    
    # 检查当前版本是否有内容可备份
    if $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "[ -f \"$REMOTE_DIR/index.html\" ]"; then
        echo -e "${BLUE}创建当前版本备份...${NC}"
        $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && tar -czf \"versions/backup_${TIMESTAMP}.tar.gz\" --exclude=\"versions\" --exclude=\"*.tar.gz\" --exclude=\"_*\" --exclude=\"._*\" ."
        
        # 检查备份是否成功
        if $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "[ -f \"$REMOTE_DIR/versions/backup_${TIMESTAMP}.tar.gz\" ]"; then
            echo -e "${GREEN}备份成功: backup_${TIMESTAMP}.tar.gz${NC}"
        else
            echo -e "${YELLOW}警告: 备份可能未成功完成${NC}"
        fi
    else
        echo -e "${YELLOW}目标目录似乎是首次部署，跳过备份${NC}"
    fi
    
    # 清理多余的备份，只保留最近的3个版本
    echo -e "${BLUE}清理旧备份，只保留最近3个版本...${NC}"
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR/versions\" && ls -t backup_*.tar.gz 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true"
    
    # 构建SCP命令上传压缩包
    local SCP_CMD="scp"
    if [ -n "$SSH_KEY" ]; then
        SCP_CMD="$SCP_CMD -i $SSH_KEY"
    fi
    SCP_CMD="$SCP_CMD -P $REMOTE_PORT -o StrictHostKeyChecking=no"
    
    # 上传压缩包
    echo -e "${BLUE}正在上传文件 (大小: $FILE_SIZE)...${NC}"
    if ! $SCP_CMD "$TEMP_TAR" ${REMOTE_USER}@${REMOTE_HOST}:"$REMOTE_DIR/frontend_deploy.tar.gz"; then
        echo -e "${RED}上传压缩包失败${NC}"
        rm -rf "$TEMP_DIR" "$TEMP_TAR"
        return 1
    fi
    
    # 修复：先解压文件，然后再进行清理，避免误删压缩包
    echo -e "${BLUE}正在解压文件并清理...${NC}"
    
    # 使用多条命令，每条命令单独执行，确保顺序正确
    # 1. 先确认压缩包存在
    if ! $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && [ -f \"frontend_deploy.tar.gz\" ]"; then
        echo -e "${RED}错误：压缩包未成功上传或已被删除${NC}"
        rm -rf "$TEMP_DIR" "$TEMP_TAR"
        return 1
    fi
    
    # 2. 解压文件
    echo -e "${BLUE}正在解压新版本...${NC}"
    if ! $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && tar -xzf frontend_deploy.tar.gz"; then
        echo -e "${RED}解压文件失败${NC}"
        rm -rf "$TEMP_DIR" "$TEMP_TAR"
        return 1
    fi
    
    # 3. 删除压缩包
    echo -e "${BLUE}清理压缩包...${NC}"
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && rm -f frontend_deploy.tar.gz"
    
    # 4. 清理多余文件
    echo -e "${BLUE}清理临时文件和元数据文件...${NC}"
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && \
        echo '移除所有macOS元数据文件...' && \
        find . -name '._*' -not -path './versions*' -delete && \
        echo '移除所有下划线开头的文件...' && \
        find . -name '_*' -not -path './versions*' -delete && \
        echo '移除其他临时压缩包...' && \
        find . -type f -name '*.tar.gz' -not -path './versions*' -delete && \
        echo '清理完成!'"
    
    local DEPLOY_STATUS=$?
    
    # 清理本地临时文件
    rm -rf "$TEMP_DIR" "$TEMP_TAR"
    
    if [ $DEPLOY_STATUS -eq 0 ]; then
        echo -e "${GREEN}部署成功!${NC}"
        echo -e "前端项目已部署到: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
        echo -e "备份版本保存在: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/versions/"
        
        # 列出可用的备份版本
        echo -e "${BLUE}可用的备份版本:${NC}"
        $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "ls -lh \"$REMOTE_DIR/versions/\" | grep backup_ | sort -r"
        
        return 0
    else
        echo -e "${RED}部署过程中出现错误 (错误码: $DEPLOY_STATUS)${NC}"
        read -p "是否尝试查看远程目录状态? (y/n) [y]: " check_remote
        if [ "$check_remote" != "n" ] && [ "$check_remote" != "N" ]; then
            echo -e "${BLUE}远程目录内容:${NC}"
            $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "ls -la \"$REMOTE_DIR\" | head -20"
        fi
        return 1
    fi
}

# 添加回滚功能
rollback_version() {
    echo -e "${YELLOW}准备回滚到之前的版本...${NC}"
    
    if ! check_required_params; then
        return 1
    fi
    
    # 构建SSH命令
    local SSH_BASE="ssh"
    if [ -n "$SSH_KEY" ]; then
        SSH_BASE="$SSH_BASE -i $SSH_KEY"
    fi
    SSH_BASE="$SSH_BASE -p $REMOTE_PORT -o StrictHostKeyChecking=no"
    
    # 检查远程备份目录
    if ! $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "[ -d \"$REMOTE_DIR/versions\" ]"; then
        echo -e "${RED}错误: 备份目录不存在，无法回滚${NC}"
        return 1
    fi
    
    # 获取可用的备份版本
    echo -e "${BLUE}获取可用的备份版本...${NC}"
    local BACKUPS=$($SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "ls -t \"$REMOTE_DIR/versions/backup_\"*.tar.gz 2>/dev/null | sort -r")
    
    if [ -z "$BACKUPS" ]; then
        echo -e "${RED}错误: 未找到可用的备份版本${NC}"
        return 1
    fi
    
    # 显示可用版本
    echo -e "${BLUE}可用的备份版本:${NC}"
    local count=1
    local versions=()
    
    while IFS= read -r backup; do
        local backup_name=$(basename "$backup")
        local backup_date=$(echo "$backup_name" | sed 's/backup_\([0-9]\{8\}\)\([0-9]\{6\}\).tar.gz/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        local backup_size=$($SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "ls -lh \"$backup\" | awk '{print \$5}'")
        
        echo "  $count) $backup_name (日期: $backup_date, 大小: $backup_size)"
        versions+=("$backup")
        ((count++))
    done <<< "$BACKUPS"
    
    # 用户选择版本
    read -p "请选择要回滚到的版本 [1-$((count-1))]: " version_choice
    
    if ! [[ "$version_choice" =~ ^[0-9]+$ ]] || [ "$version_choice" -lt 1 ] || [ "$version_choice" -gt $((count-1)) ]; then
        echo -e "${RED}错误: 无效的选择${NC}"
        return 1
    fi
    
    local selected_version="${versions[$((version_choice-1))]}"
    local version_name=$(basename "$selected_version")
    
    echo -e "${BLUE}将回滚到版本: $version_name${NC}"
    read -p "确认回滚? (y/n) [y]: " confirm_rollback
    
    if [ "$confirm_rollback" = "n" ] || [ "$confirm_rollback" = "N" ]; then
        echo -e "${YELLOW}回滚已取消${NC}"
        return 0
    fi
    
    # 执行回滚
    echo -e "${BLUE}执行回滚...${NC}"
    
    # 先备份当前版本
    echo -e "${BLUE}备份当前版本...${NC}"
    local TIMESTAMP=$(date +"%Y%m%d%H%M%S")
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && tar -czf \"versions/backup_before_rollback_${TIMESTAMP}.tar.gz\" --exclude=\"versions\" --exclude=\"*.tar.gz\" --exclude=\"_*\" ."
    
    # 清理当前文件并解压所选备份
    echo -e "${BLUE}清理当前文件并还原所选备份...${NC}"
    $SSH_BASE ${REMOTE_USER}@${REMOTE_HOST} "cd \"$REMOTE_DIR\" && \
        echo '清理当前文件...' && \
        find . -not -path './versions*' -not -path '.' -delete && \
        echo '还原备份版本...' && \
        tar -xzf \"$selected_version\" && \
        echo '回滚完成!'"
    
    local ROLLBACK_STATUS=$?
    
    if [ $ROLLBACK_STATUS -eq 0 ]; then
        echo -e "${GREEN}回滚成功!${NC}"
        echo -e "已回滚到版本: $version_name"
        return 0
    else
        echo -e "${RED}回滚失败 (错误码: $ROLLBACK_STATUS)${NC}"
        return 1
    fi
}

# 部署前端项目
deploy_frontend() {
    echo -e "${YELLOW}正在部署前端项目...${NC}"
    
    if ! check_required_params; then
        return 1
    fi
    
    # 验证远程目录是否为绝对路径
    if [[ "$REMOTE_DIR" != /* ]]; then
        echo -e "${RED}错误: 远程目录必须是绝对路径${NC}"
        echo -e "${YELLOW}当前设置: $REMOTE_DIR${NC}"
        echo -e "${YELLOW}建议: 请使用 '$0 config' 重新配置部署参数，设置正确的绝对路径${NC}"
        
        # 临时修正
        local FIXED_PATH="/$REMOTE_DIR"
        echo -e "${YELLOW}是否临时使用绝对路径: $FIXED_PATH? (y/n) [y]: ${NC}"
        read temp_fix
        if [ "$temp_fix" != "n" ] && [ "$temp_fix" != "N" ]; then
            REMOTE_DIR="$FIXED_PATH"
            echo -e "${GREEN}已临时修正路径为: $REMOTE_DIR${NC}"
        else
            return 1
        fi
    fi
    
    # 检查SSH密钥是否已上传
    local USING_PASSWORD_AUTH=1
    
    if [ -n "$SSH_KEY" ]; then
        echo -e "${BLUE}检查SSH密钥认证状态...${NC}"
        if ! check_ssh_key_uploaded; then
            echo -e "${YELLOW}SSH密钥未授权或未上传到服务器${NC}"
            read -p "是否上传SSH密钥到服务器? (y/n) [y]: " upload_key
            if [ "$upload_key" != "n" ] && [ "$upload_key" != "N" ]; then
                if upload_ssh_key; then
                    # 重新检查密钥是否生效
                    echo -e "${BLUE}验证SSH密钥是否生效...${NC}"
                    if check_ssh_key_uploaded; then
                        echo -e "${GREEN}SSH密钥验证成功，将使用密钥认证${NC}"
                        USING_PASSWORD_AUTH=0
                    else
                        echo -e "${YELLOW}SSH密钥未生效，可能需要服务器配置调整${NC}"
                        read -p "是否继续使用密码认证? (y/n) [y]: " cont_with_pwd
                        if [ "$cont_with_pwd" = "n" ] || [ "$cont_with_pwd" = "Y" ]; then
                            echo -e "${RED}取消部署${NC}"
                            return 1
                        fi
                    fi
                else
                    echo -e "${YELLOW}将使用密码认证继续部署${NC}"
                fi
            else
                echo -e "${YELLOW}将使用密码认证继续部署${NC}"
            fi
        else
            echo -e "${GREEN}SSH密钥已授权，可以免密登录${NC}"
            USING_PASSWORD_AUTH=0
        fi
    fi
    
    # 基于上传模式选择部署方法
    if [ "$UPLOAD_MODE" = "tar" ]; then
        # 使用压缩包模式部署
        deploy_using_tar
        return $?
    fi
    
    # 以下是rsync模式部署
    local SSH_CMD=$(build_ssh_cmd)
    
    # 检查远程目录是否存在，不存在则创建
    echo -e "${BLUE}检查远程目录...${NC}"
    if ! $SSH_CMD "[ -d \"$REMOTE_DIR\" ]" 2>/dev/null; then
        echo -e "${YELLOW}远程目录不存在，正在创建...${NC}"
        if ! $SSH_CMD "mkdir -p \"$REMOTE_DIR\""; then
            echo -e "${RED}创建远程目录失败${NC}"
            return 1
        fi
    fi
    
    # 如果使用密码认证并且目录需要sudo权限，提示用户
    if [ $USING_PASSWORD_AUTH -eq 1 ]; then
        if ! $SSH_CMD "touch \"$REMOTE_DIR/.test_write_perm\" && rm \"$REMOTE_DIR/.test_write_perm\"" 2>/dev/null; then
            echo -e "${YELLOW}警告: 远程目录可能需要更高权限${NC}"
            echo -e "${YELLOW}您可能需要多次输入密码，或考虑使用具有足够权限的用户${NC}"
            echo -e "${YELLOW}建议切换到压缩包模式部署 (使用 '$0 config' 修改上传模式)${NC}"
            
            read -p "是否切换到压缩包模式部署? (y/n) [y]: " switch_to_tar
            if [ "$switch_to_tar" != "n" ] && [ "$switch_to_tar" != "N" ]; then
                echo -e "${BLUE}切换到压缩包模式...${NC}"
                UPLOAD_MODE="tar"
                save_config
                deploy_using_tar
                return $?
            fi
            
            read -p "是否尝试使用sudo修改目录权限? (y/n) [y]: " fix_perm
            if [ "$fix_perm" != "n" ] && [ "$fix_perm" != "N" ]; then
                echo -e "${BLUE}尝试修复目录权限...${NC}"
                $SSH_CMD "sudo chown -R $REMOTE_USER:$REMOTE_USER \"$REMOTE_DIR\" 2>/dev/null || echo '权限修复可能失败，将继续尝试部署'"
            fi
        fi
    fi
    
    # 使用rsync上传文件
    echo -e "${BLUE}开始上传文件...${NC}"
    
    # 构建rsync命令
    RSYNC_CMD=$(build_rsync_cmd)
    
    # 执行rsync命令，这里需要使用eval因为命令包含双引号
    DEPLOY_CMD="$RSYNC_CMD ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
    echo -e "${BLUE}执行: $DEPLOY_CMD${NC}"
    
    eval "$DEPLOY_CMD"
    RSYNC_STATUS=$?
    
    # 检查rsync结果，代码23表示部分文件传输失败，但这通常是权限问题，可能并不严重
    if [ $RSYNC_STATUS -eq 0 ]; then
        echo -e "${GREEN}部署成功!${NC}"
        echo -e "前端项目已部署到: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
        return 0
    elif [ $RSYNC_STATUS -eq 23 ]; then
        echo -e "${YELLOW}部署基本完成，但部分文件可能未成功传输 (通常是权限问题)${NC}"
        echo -e "${YELLOW}这种情况下网站通常仍可正常工作${NC}"
        echo -e "${YELLOW}如果遇到问题，请尝试使用压缩包模式部署 (使用 '$0 config' 修改上传模式)${NC}"
        echo -e "前端项目已部署到: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
        
        read -p "是否查看远程目录内容确认部署结果? (y/n) [y]: " check_files
        if [ "$check_files" != "n" ] && [ "$check_files" != "N" ]; then
            echo -e "${BLUE}远程目录内容:${NC}"
            $SSH_CMD "ls -la \"$REMOTE_DIR\" | head -20"
        fi
        
        read -p "是否切换到压缩包模式重新部署? (y/n) [y]: " retry_with_tar
        if [ "$retry_with_tar" != "n" ] && [ "$retry_with_tar" != "N" ]; then
            echo -e "${BLUE}切换到压缩包模式重新部署...${NC}"
            UPLOAD_MODE="tar"
            save_config
            deploy_using_tar
            return $?
        fi
        
        return 0
    else
        echo -e "${RED}部署失败! (错误码: $RSYNC_STATUS)${NC}"
        echo -e "${YELLOW}建议尝试使用压缩包模式部署${NC}"
        
        read -p "是否切换到压缩包模式重新部署? (y/n) [y]: " retry_with_tar
        if [ "$retry_with_tar" != "n" ] && [ "$retry_with_tar" != "N" ]; then
            echo -e "${BLUE}切换到压缩包模式重新部署...${NC}"
            UPLOAD_MODE="tar"
            save_config
            deploy_using_tar
            return $?
        fi
        
        return 1
    fi
}

# 处理命令行参数
process_args() {
    local COMMAND=""
    
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--host)
                REMOTE_HOST="$2"
                shift 2
                ;;
            -u|--user)
                REMOTE_USER="$2"
                shift 2
                ;;
            -p|--port)
                REMOTE_PORT="$2"
                shift 2
                ;;
            -d|--dir)
                REMOTE_DIR="$2"
                shift 2
                ;;
            -k|--key)
                SSH_KEY="$2"
                shift 2
                ;;
            -e|--exclude)
                EXCLUDE_PATTERNS="$2"
                shift 2
                ;;
            deploy|config|help|rollback)
                COMMAND="$1"
                shift
                ;;
            *)
                echo -e "${RED}错误: 未知选项或命令 $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 执行命令
    case "$COMMAND" in
        deploy)
            deploy_frontend
            ;;
        rollback)
            rollback_version
            ;;
        config)
            configure
            ;;
        help|"")
            show_help
            ;;
    esac
}

# 主函数
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    process_args "$@"
}

# 执行主函数
main "$@" 