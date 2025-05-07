// 设置管理模块
export class SettingsManager {
    constructor() {
        this.settings = {
            apiKey: localStorage.getItem('openai_api_key') || '',
            baseUrl: localStorage.getItem('openai_base_url') || 'https://api.openai.com',
            streamEnabled: localStorage.getItem('stream_enabled') !== 'false',
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
                localStorage.setItem('stream_enabled', value);
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
        this.set(key, !this.settings[key]);
        return this.settings[key];
    }
    
    // 检查是否已设置必要参数
    hasRequiredSettings() {
        return this.settings.apiKey && this.settings.baseUrl;
    }
} 