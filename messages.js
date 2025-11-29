import fs from 'fs-extra';
import chalk from 'chalk';

export class MessageSystem {
    constructor(bot) {
        this.bot = bot;
        this.messageCount = 0;
        
        // بدء أنظمة السرعة
        this.startSpeedSystems();
    }

    async handleMessage(m) {
        try {
            const message = m.messages[0];
            if (!message || !message.message || message.key.fromMe) return;

            this.messageCount++;

            // معالجة الأوامر فائقة السرعة
            await this.bot.handler.handleMessage(message);

        } catch (error) {
        }
    }

    isMediaMessage(message) {
        const msg = message.message;
        return !!(
            msg.imageMessage ||
            msg.videoMessage ||
            msg.audioMessage ||
            msg.documentMessage ||
            msg.stickerMessage
        );
    }

    async handleMediaMessage(message) {
        try {
            const msg = message.message;
            const jid = message.key.remoteJid;

            // معالجة سريعة بدون تأخير
            if (msg.imageMessage) {
                // سرعة قصوى
            } else if (msg.videoMessage) {
                // سرعة قصوى
            } else if (msg.audioMessage) {
                // سرعة قصوى
            }

        } catch (error) {
        }
    }

    extractText(message) {
        const msg = message.message;
        return msg.conversation || 
               msg.extendedTextMessage?.text || 
               msg.imageMessage?.caption || 
               msg.videoMessage?.caption || '';
    }

    getMessageStats() {
        return {
            totalMessages: this.messageCount
        };
    }

    async broadcastToGroups(message, groupJids = null) {
        try {
            let targets = groupJids;
            
            if (!targets) {
                const groups = await this.bot.sock.groupFetchAllParticipating();
                targets = Object.keys(groups);
            }

            let successCount = 0;

            // بث فائق السرعة
            for (const jid of targets) {
                try {
                    await this.bot.sendMessage(jid, message);
                    successCount++;
                } catch (error) {
                    // تجاهل سريع للأخطاء
                }
            }

            return { success: successCount, total: targets.length };

        } catch (error) {
            return { success: 0, total: 0 };
        }
    }

    async sendToUser(userJid, message) {
        try {
            await this.bot.sendMessage(userJid, message);
            return true;
        } catch (error) {
            return false;
        }
    }

    async replyToMessage(originalMessage, replyContent) {
        try {
            await this.bot.sendMessage(originalMessage.key.remoteJid, replyContent, {
                quoted: originalMessage
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // نظام دعم السرعة
    startSpeedSystems() {
        this.optimizePerformance();
        this.startMemoryOptimizer();
        this.startSessionCleaner();
        this.startConnectionOptimizer();
    }

    // تحسين الأداء الأساسي
    optimizePerformance() {
        // إعدادات السرعة القصوى
        process.setMaxListeners(0);
        
        if (this.bot.sock?.ws) {
            this.bot.sock.ws.binaryType = 'arraybuffer';
        }

        // تقليل السجلات غير الضرورية
        console.debug = () => {};
        
        // تحسين إعدادات البوت
        if (this.bot.sock) {
            this.bot.sock.maxRetries = 3;
            this.bot.sock.connectTimeoutMs = 30000;
        }

    }

    // منظف الذاكرة التلقائي
    startMemoryOptimizer() {
        setInterval(() => {
            this.optimizeMemory();
        }, 2 * 60 * 1000); // كل دقيقتين
    }

    optimizeMemory() {
        try {
            // إجبار جمع القمامة إذا كان متاحاً
            if (global.gc) {
                global.gc();
            }

            // تنظيف الكاش المؤقت
            if (global.cache) {
                const now = Date.now();
                for (const [key, value] of global.cache) {
                    if (value.expire && value.expire < now) {
                        global.cache.delete(key);
                    }
                }
            }

        } catch (error) {
            // تجاهل أخطاء الذاكرة
        }
    }

    // منظف الجلسة السريع
    startSessionCleaner() {
        setInterval(() => {
            this.cleanSessionFiles();
        }, 30 * 60 * 1000); // كل 30 دقيقة
    }

    cleanSessionFiles() {
        try {
            const sessionDir = './session';
            if (!fs.existsSync(sessionDir)) return;

            const files = fs.readdirSync(sessionDir);
            
            files.forEach(file => {
                if (file !== 'creds.json') {
                    const filePath = `${sessionDir}/${file}`;
                    fs.removeSync(filePath);
                }
            });

        } catch (error) {
            // تجاهل الأخطاء
        }
    }

    // محسن الاتصال
    startConnectionOptimizer() {
        setInterval(() => {
            this.optimizeConnection();
        }, 5 * 60 * 1000); // كل 5 دقائق
    }

    optimizeConnection() {
        try {
            if (this.bot.sock?.ws) {
                // إعادة تعيين إعدادات الاتصال
                if (this.bot.sock.ws.readyState === 1) {
                    // إرسال ping للحفاظ على الاتصال نشط
                    this.bot.sock.ws.ping();
                }
            }
        } catch (error) {
            // تجاهل أخطاء الاتصال
        }
    }

    // إرسال فائق السرعة
    async ultraFastSend(jid, content, options = {}) {
        try {
            await this.bot.sendMessage(jid, content, {
                ...options,
                upload: false, // تعطيل الرفع التلقائي
                mediaUploadTimeoutMs: 5000, // وقت أقصى للرفع
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // بث فائق السرعة
    async ultraFastBroadcast(message, groupJids = null) {
        try {
            let targets = groupJids;
            
            if (!targets) {
                const groups = await this.bot.sock.groupFetchAllParticipating();
                targets = Object.keys(groups);
            }

            const promises = targets.map(jid => 
                this.ultraFastSend(jid, message).catch(() => false)
            );

            const results = await Promise.allSettled(promises);
            const successCount = results.filter(result => result.value).length;

            return { success: successCount, total: targets.length };

        } catch (error) {
            return { success: 0, total: 0 };
        }
    }

    // معالجة وسائط سريعة
    async fastMediaProcessing(message) {
        try {
            const msg = message.message;
            
            if (msg.imageMessage || msg.videoMessage) {
                // معالجة سريعة بدون تحميل
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    // الحصول على إحصائيات السرعة
    getSpeedStats() {
        const memoryUsage = process.memoryUsage();
        return {
            totalMessages: this.messageCount,
            memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            uptime: Math.round(process.uptime()) + 's',
            connectionStatus: this.bot.sock?.ws?.readyState === 1 ? 'Connected' : 'Disconnected'
        };
    }

    // إعادة تعيين سريعة
    quickReset() {
        this.messageCount = 0;
        console.log(chalk.yellow('🔄 Quick Reset Completed'));
    }

    // تحميل سريع للبيانات
    async fastDataLoad() {
        try {
            // تحميل سريع للإعدادات
            if (this.bot.config) {
                // إعادة تحميل الكونفج بسرعة
                const configPath = `./config.js?update=${Date.now()}`;
                const { config } = await import(configPath);
                this.bot.config = { ...this.bot.config, ...config };
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
}

export default MessageSystem;