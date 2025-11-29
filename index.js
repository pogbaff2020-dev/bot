import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs-extra';
import readline from 'readline';
import path from 'path';
import chalk from 'chalk';
import gradient from 'gradient-string';
 
 

const logger = pino({ level: 'silent' });


class SOLOBot {
    constructor() {
        this.sock = null;
        this.authState = null;
        this.saveCreds = null;
        this.isConnected = false;
        this.startTime = Date.now();
        this.connectionRetries = 0;
        this.maxRetries = 10;
        this.config = null;
        this.handler = null;
        this.messages = null;
        this.console = null;
        this.system = null;
       
        global.bot = this;
    }

    async initialize() {
    try {
        console.clear();
        this.showBanner();
        this.createDirectories();
        await this.loadConfig();
        await this.initializeAuth();
        this.startConnection(); 
            
    } catch (error) {
        console.log(chalk.red('❌ Initial setup failed:'), error.message);
        await this.handleReconnection();
    }
}

    async handleReconnection() {
        this.connectionRetries++;
        if (this.connectionRetries > this.maxRetries) {
            console.log(chalk.red('❌ Max reconnection attempts reached'));
            process.exit(1);
        }

        console.log(chalk.yellow(`🔄 Reconnection attempt ${this.connectionRetries}/${this.maxRetries}`));
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.initialize();
    }

    showBanner() {
        console.log(gradient.rainbow(`
╔══════════════════════════════════════════════════╗
║                 SOLO BOT SYSTEM                  ║
║                 Developed by KING                ║
║               +201005199558                ║
╚══════════════════════════════════════════════════╝
        `));
        console.log(chalk.cyan('🚀 Starting advanced WhatsApp bot...\n'));
    }

    createDirectories() {
        const dirs = ['./session', './plugins', './data'];
        dirs.forEach(dir => fs.ensureDirSync(dir));
    }

    async loadConfig() {
        try {
            const { config } = await import('./config.js');
            this.config = config;
            console.log(chalk.green('✅ Config loaded'));
        } catch (error) {
            console.log(chalk.red('❌ Config load failed:'), error.message);
            throw error;
        }
    }

    async initializeAuth() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('./session');
            this.authState = state;
            this.saveCreds = saveCreds;
            
            console.log(chalk.green('✅ Auth system initialized'));
        } catch (error) {
            console.log(chalk.red('❌ Auth initialization failed:'), error.message);
            throw error;
        }
    }

    async startConnection() {
        try {
            this.sock = makeWASocket({
                auth: {
                    creds: this.authState.creds,
                    keys: makeCacheableSignalKeyStore(this.authState.keys, logger),
                },
                logger: logger,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                retryRequestDelayMs: 1000,
                maxRetries: 3,
            });

            this.setupEventHandlers();

            if (this.authState.creds.registered) {
                await this.waitForConnection(15000);
            } else {
                await this.startPhoneAuth();
            }
            
        } catch (error) {
            console.log(chalk.red('❌ Connection failed:'), error.message);
            throw error;
        }
    }

    // <<< النسخة الجديدة (بدون مؤقت) >>>
async waitForConnection() {
    return new Promise((resolve) => {
        const connectionHandler = (update) => {
            // انتظر فقط حتى يصبح الاتصال 'open'
            if (update.connection === 'open') {
                // بمجرد أن يفتح، قم بإزالة المستمع حتى لا يتكرر
                this.sock.ev.off('connection.update', connectionHandler);
                // أخبر الكود أن الانتظار قد انتهى بنجاح
                resolve();
            }
        };

        // ابدأ الاستماع لحدث تحديث الاتصال
        this.sock.ev.on('connection.update', connectionHandler);
    });
}


    async startPhoneAuth() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            const phoneNumber = await new Promise((resolve) => {
                rl.question(chalk.cyan('📱 Enter phone number (with country code): '), resolve);
            });

            if (!phoneNumber) {
                console.log(chalk.red('❌ Phone number required'));
                process.exit(1);
            }

            const cleanNumber = phoneNumber.replace(/[+\s]/g, '');
            console.log(chalk.cyan('⏳ Requesting pairing code...'));
            
            const code = await this.sock.requestPairingCode(cleanNumber);
            
            // ==================== عرض كود الربط بشكل واضح ====================
console.log(chalk.cyan('╔══════════════════════════════════╗'));
console.log(chalk.cyan('║         📱 PAIRING CODE         ║'));
console.log(chalk.cyan('╚══════════════════════════════════╝'));
console.log(chalk.bold.greenBright(`\n          
╭─── • 𝐒𝐎𝐋𝐎 • ───╮
│≠ 𝑪𝑶𝑫𝑬: ${code}
│≠ 𝑺𝑶𝑳𝑶.. 
╰─── • 𝐒𝐎𝐋𝐎 • ───
\n`));
            
            console.log(chalk.cyan('⏳ Waiting for pairing... (2 minutes)'));
            
            await this.waitForConnection(120000);
            
            rl.close();
            console.log(chalk.green('✅ Paired successfully!'));
        } catch (error) {
            console.log(chalk.red('❌ Phone auth failed:'), error.message);
            rl.close();
            throw error;
        }
    }

    setupEventHandlers() {
        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        this.sock.ev.on('messages.upsert', (m) => {
            this.handleMessagesUpsert(m);
        });

        this.sock.ev.on('creds.update', () => {
            if (this.saveCreds) {
                this.saveCreds();
            }
        });
    }

async handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;
        
    if (connection === 'open') {
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log(chalk.green('✅ Connected to WhatsApp!'));
            
        if (!this.handler) { 
            console.log(chalk.cyan('🚀 First connection, loading all systems...'));
            await this.loadSystems();
            console.log(chalk.green('🎉 SOLO Bot is now fully operational!'));
        }
            
        if (this.saveCreds) {
            this.saveCreds();
        }
    } else if (connection === 'close') {
        this.isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

            
        const isCriticalError = statusCode === DisconnectReason.loggedOut || 
                                statusCode === DisconnectReason.connectionReplaced;

        if (isCriticalError) {
            console.log(chalk.red('❌ Critical session issue detected. Restarting from scratch...'));
            try {
                fs.rmSync('./session', { recursive: true, force: true });
            } catch (e) {
                console.error(chalk.red('❌ Failed to clean session directory:'), e.message);
            }
            process.exit(1); 
        } else {
            this.startConnection();
        }
    }
}

    // هذا هو الكود الجديد الذي يجب أن تضعه
async handleMessagesUpsert(m) {
    try {
        const message = m.messages[0];
        // تجاهل الرسائل الفارغة أو رسائل الحالة
        if (!message || !message.message || message.key.remoteJid === 'status@broadcast') return;
        
        // تجاهل الرسائل القديمة التي تصل عند إعادة الاتصال
        const messageTime = message.messageTimestamp ? message.messageTimestamp * 1000 : Date.now();
        if (messageTime < this.startTime - 10000) {
            return;
        }

        // --- ✨✨ هذا هو التعديل الرئيسي ✨✨ ---
        // نستدعي دالة الطباعة الجديدة من نظام الكونسول
        if (this.console) {
            // لا نستخدم await هنا لجعل الطباعة تتم في الخلفية فورًا
            this.console.logMessage(message);
        }
        // --- نهاية التعديل ---
        
        // الآن، يمكن للهاندلر معالجة الرسالة كالمعتاد
        if (this.handler) {
            await this.handler.handleMessage(message);
        }
    } catch (error) {
        console.log(chalk.red('❌ Message handling error:'), error.message);
    }
}
    async loadSystems() {
        try {
            const { Handler } = await import('./handler.js');
            this.handler = new Handler(this);
            await this.handler.loadPlugins();
            
            const { MessageSystem } = await import('./messages.js');
            this.messages = new MessageSystem(this);
            
            const { ConsoleSystem } = await import('./console.js');
            this.console = new ConsoleSystem(this);
            
            
            
            console.log(chalk.green('✅ All systems loaded successfully'));
        } catch (error) {
            console.log(chalk.red('❌ System loading failed:'), error.message);
            
        }
    }

    async sendMessage(jid, content, options = {}) {
        try {
            return await this.sock.sendMessage(jid, content, options);
        } catch (error) {
            console.log(chalk.red('❌ Send message error:'), error.message);
            
        }
    }

    isDeveloper(jid) {
        return this.config?.DEVELOPERS?.includes(jid) || false;
    }

        getSystemInfo() {
        return {
            uptime: Date.now() - this.startTime,
            connected: this.isConnected,
            connectionRetries: this.connectionRetries,
            messagesProcessed: this.handler?.stats?.messagesProcessed || 0,
            pluginsLoaded: this.handler?.plugins?.size || 0,
            commandsLoaded: this.handler?.commands?.size || 0
        };
    }

    // --- ✨✨ [الكود الجديد لإعادة التشغيل الناعمة - في المكان الصحيح] ✨✨ ---
    async softRestart() {
        console.log(chalk.yellow('🔄 Performing a soft restart...'));

        // 1. قم بإلغاء تهيئة الأنظمة الحالية للسماح بإعادة تحميلها
        this.handler = null;
        this.messages = null;
        this.console = null;
        this.system = null;
        this.isInitialized = false; // مهم جدًا

        // 2. أغلق الاتصال الحالي بشكل نظيف
        if (this.sock) {
            try {
                // إرسال رمز DisconnectReason.restartRequired
                // هذا يخبر معالج الاتصال بأننا نريد إعادة الاتصال
                await this.sock.end(new Error('Soft Restart Triggered'));
            } catch (e) {
                console.log(chalk.red('Error during soft-restart socket end:', e.message));
                // إذا فشل الإغلاق، قم بإعادة الاتصال يدويًا
                this.startConnection();
            }
        } else {
            // إذا لم يكن هناك اتصال أصلاً، فقط ابدأ واحدًا جديدًا
            this.startConnection();
        }
    }
    // --- نهاية الكود الجديد ---

} // <-- القوس الصحيح لإغلاق كلاس SOLOBot

async function main() {
    const bot = new SOLOBot();
    try {
        await bot.initialize.bind(bot)(); 
    } catch (error) {
        console.error(chalk.red('❌ A critical error occurred during bot initialization:'), error);
        process.exit(1);
    }
}

main();


process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down SOLO Bot...'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 SOLO Bot terminated'));
    process.exit(0);
});