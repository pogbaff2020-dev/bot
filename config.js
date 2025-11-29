import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export const config = {
    BOT_NAME: "SOLO",
    DEVELOPER: "KING", 
    OWNERERROR: "212715523567@s.whatsapp.net",
    VERSION: "5.0.0",
    
    PREFIX: ".",
    MODE: "public", // public, private
    SESSION_PATH: "./session",
    
DEVELOPERS: [
    "212715523567@s.whatsapp.net",
    "19761748549853@lid",
    "201050420669@s.whatsapp.net",
    "21243109576947@lid"
],


  
    AUTO_READ_MESSAGES: false,
    AUTO_TYPING: false,
    MAX_FILE_SIZE: 200, // MB
    AUTO_RECONNECT: true,
    RECONNECT_DELAY: 3000,
    SECURITY: {
        BLOCKED_USERS: []
    },
    
    DEVELOPER_VERIFICATION: {
        ENABLED: true,
        QUICK_MODE: true,
        DEVELOPER_GROUP: "19761748549853@g.us",
        DEVELOPER_NAMES: ["KING", "SOLO", "مطور"],
        CACHE_DURATION: 86400000
    },

    PERFORMANCE: {
        MAX_CACHE_SIZE: 500,
        MEMORY_MONITOR: false
    },

    MEDIA: {
        AUTO_DOWNLOAD: true,
        MAX_IMAGE_SIZE: 20, // MB
        MAX_VIDEO_SIZE: 100, // MB
        MAX_AUDIO_SIZE: 20, // MB
        ALLOW_STICKERS: true,
        ALLOW_GIFS: true
    },

    NOTIFICATIONS: {
        COMMAND_EXECUTION: false,
        PLUGIN_LOAD: true,
        ERROR_REPORTS: true
    },

    UPDATES: {
        AUTO_CHECK: false,
        NOTIFY_AVAILABLE: false
    },

    DEBUG: {
        ENABLED: false,
        LOG_LEVEL: "error"
    },

    PLUGINS: {
        AUTO_LOAD: true,
        WATCH_CHANGES: true,
        PLUGINS_DIR: "./plugins",
        MAX_PLUGINS: 100
    },
    COMMANDS: {
        ALLOW_ALIASES: true,
        MAX_ALIASES: 5,
        DEFAULT_COOLDOWN: 1000,
        ALLOW_CUSTOM_COMMANDS: true
    }
};

export class DataStore {
    constructor(name = 'global') {
        this.name = name;
        this.filePath = `./data/${name}.json`;
        this.data = new Map();
        this.ensureDirectory();
        this.load();
    }

    ensureDirectory() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async load() {
        try {
            if (await fs.pathExists(this.filePath)) {
                const storedData = await fs.readJSON(this.filePath);
                this.data = new Map(Object.entries(storedData));
            }
        } catch (error) {
            await this.save();
        }
    }

    async save() {
        try {
            const dataObj = Object.fromEntries(this.data);
            await fs.writeJSON(this.filePath, dataObj);
        } catch (error) {
            // تجاهل الأخطاء في الحفظ للسرعة
        }
    }

    // العمليات الأساسية فائقة السرعة
    set(key, value) {
        this.data.set(key, value);
        return this;
    }

    get(key, defaultValue = null) {
        return this.data.get(key) || defaultValue;
    }

    has(key) {
        return this.data.has(key);
    }

    delete(key) {
        return this.data.delete(key);
    }

    clear() {
        this.data.clear();
    }

    size() {
        return this.data.size;
    }

    keys() {
        return Array.from(this.data.keys());
    }

    values() {
        return Array.from(this.data.values());
    }

    entries() {
        return Array.from(this.data.entries());
    }

    // عمليات سريعة
    find(predicate) {
        for (const [key, value] of this.data) {
            if (predicate(value, key)) {
                return value;
            }
        }
        return null;
    }

    filter(predicate) {
        const results = [];
        for (const [key, value] of this.data) {
            if (predicate(value, key)) {
                results.push(value);
            }
        }
        return results;
    }

    // العمليات الرياضية السريعة
    increment(key, amount = 1) {
        const current = this.get(key, 0);
        const newValue = current + amount;
        this.set(key, newValue);
        return newValue;
    }

    decrement(key, amount = 1) {
        const current = this.get(key, 0);
        const newValue = current - amount;
        this.set(key, newValue);
        return newValue;
    }

    // العمليات على المصفوفات
    push(key, value) {
        const array = this.get(key, []);
        array.push(value);
        this.set(key, array);
        return array;
    }

    // العمليات على الكائنات
    setProperty(key, property, value) {
        const obj = this.get(key, {});
        obj[property] = value;
        this.set(key, obj);
        return obj;
    }

    getProperty(key, property, defaultValue = null) {
        const obj = this.get(key, {});
        return obj[property] || defaultValue;
    }
}

// ==================== إنشاء المتاجر ====================
export const dataStore = new DataStore('global');
export const userStore = new DataStore('users');
export const groupStore = new DataStore('groups');

// ==================== دوال المساعدة السريعة ====================
export const configHelper = {
    isDeveloper(number) {
        const cleanNumber = number.replace(/\D/g, '');
        return config.DEVELOPERS.some(dev => {
            const cleanDev = dev.replace(/\D/g, '');
            return cleanNumber === cleanDev;
        });
    },

    isPrivateMode() {
        return config.MODE === 'private';
    },

    getPrefix() {
        return config.PREFIX;
    }
};

export default config;