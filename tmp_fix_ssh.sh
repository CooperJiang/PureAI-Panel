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
