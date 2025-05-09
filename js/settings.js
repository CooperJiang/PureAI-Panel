// 设置管理模块
export class SettingsManager {
    constructor() {
        const contextEnabledValue = localStorage.getItem('context_enabled');
        
        // 改进流式输出设置的读取方式，更严格地检查布尔值
        const streamEnabledValue = localStorage.getItem('stream_enabled');
        
        this.settings = {
            apiKey: localStorage.getItem('openai_api_key') || 'sk-pool-999999',
            baseUrl: localStorage.getItem('openai_base_url') || 'https://pool.mmmss.com',
            // 更精确地处理流式输出设置
            streamEnabled: streamEnabledValue === null ? true : streamEnabledValue !== 'false',
            contextEnabled: contextEnabledValue !== 'false',
            darkMode: localStorage.getItem('dark_mode') === 'true' || 
                     (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        };
        
        // 初始化深色模式
        if (this.settings.darkMode) {
            document.documentElement.classList.add('dark');
        }
    }
    
    // 获取设置
    get(key, defaultValue) {
        // 特殊检查API密钥
        if (key === 'apiKey') {
            const value = this.settings[key];
            return value || defaultValue;
        }
        
        // 特殊检查上下文开关
        if (key === 'contextEnabled') {
            const storedValue = localStorage.getItem('context_enabled');
            return this.settings[key];
        }
        
        // 特殊检查流式输出开关
        if (key === 'streamEnabled') {
            return this.settings[key];
        }
        
        return this.settings[key] || defaultValue;
    }
    
    // 更新设置
    set(key, value) {
        this.settings[key] = value;
        
        // 保存到本地存储
        switch (key) {
            case 'apiKey':
                localStorage.setItem('openai_api_key', value);
                break;
            case 'baseUrl':
                localStorage.setItem('openai_base_url', value);
                break;
            case 'streamEnabled':
                // 确保布尔值正确转换为字符串
                localStorage.setItem('stream_enabled', String(value));
                break;
            case 'contextEnabled':
                localStorage.setItem('context_enabled', String(value));
                break;
            case 'darkMode':
                localStorage.setItem('dark_mode', value);
                // 更新UI
                if (value) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                break;
        }
    }
    
    // 切换布尔设置
    toggle(key) {
        const newValue = !this.settings[key];
        this.set(key, newValue);
        return this.settings[key];
    }
    
    // 检查是否已设置必要参数
    hasRequiredSettings() {
        // 只检查baseUrl是否存在，因为我们已经提供了默认可用的代理地址
        // 不再检查apiKey，允许用户稍后设置或使用默认服务
        return this.settings.baseUrl;
    }
} 