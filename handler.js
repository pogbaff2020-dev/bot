import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import { pathToFileURL } from 'url';
import path from 'path';
import chalk from 'chalk';
import gradient from 'gradient-string';

class Handler {
    constructor(bot) {
        this.bot = bot;
        this.commands = new Map();
        this.aliases = new Map();
        this.plugins = new Map();
        this.pluginDir = './plugins';
        this.stats = {
            commandsExecuted: 0,
            messagesProcessed: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        // أنظمة متقدمة محسنة
        this.cooldowns = new Map();
        this.userData = new Map();
        this.groupData = new Map();
        this.cache = new Map();
        this.sessions = new Map();
        this.continuousCommands = new Map();
        this.autoCommands = new Map();
        this.gameSessions = new Map(); 
        
        this.security = {
            blockedUsers: new Set(),
            spamDetection: new Map(),
            rateLimits: new Map(),
            commandPermissions: new Map()
        };


        this.messageQueue = [];
        this.isProcessing = false;
        this.responseCache = new Map();
        this.cacheTTL = 30000;

        this.watcher = null;
        this.isReloading = false;
        this.isInitialized = false;
        this.coreWatcher = null; 
        this.configWatcher = null; 
        this.ensureDirectories();
        this.loadData();
        this.startCleanupCycle();
        this.startPerformanceMonitor();
        
        console.log(gradient.rainbow(`
        
███████  ██████  ██      ██████
██       ██  ██  ██      ██  ██
███████  ██  ██  ██      ██  ██
     ██  ██  ██  ██      ██  ██
███████  ██████  ███████ ██████

        `));
    }

    ensureDirectories() {
        const dirs = [this.pluginDir, './data', './temp'];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // ==================== نظام التخزين المحسن ====================
    saveData() {
        try {
            const data = {
                userData: Object.fromEntries(this.userData),
                groupData: Object.fromEntries(this.groupData),
                stats: this.stats,
                security: {
                    blockedUsers: Array.from(this.security.blockedUsers)
                }
            };
            fs.writeJSONSync('./data/bot_data.json', data, { spaces: 2 });
        } catch (error) {
            console.log(chalk.red('❌ Save data error:'), error.message);
        }
    }

    loadData() {
        try {
            if (fs.existsSync('./data/bot_data.json')) {
                const data = fs.readJSONSync('./data/bot_data.json');
                this.userData = new Map(Object.entries(data.userData || {}));
                this.groupData = new Map(Object.entries(data.groupData || {}));
                this.stats = { ...this.stats, ...data.stats };
                if (data.security) {
                    this.security.blockedUsers = new Set(data.security.blockedUsers || []);
                }
            }
        } catch (error) {
            console.log(chalk.red('❌ Load data error:'), error.message);
        }
    }

    // ==================== نظام المستخدمين المحسن ====================
    getUserData(userJid) {
        if (!this.userData.has(userJid)) {
            this.userData.set(userJid, {
                messageCount: 0,
                commandCount: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                level: 1,
                exp: 0,
                permissions: {
                    isAdmin: false,
                    isPremium: false,
                    canUseAllCommands: true,
                    restrictedCommands: []
                },
                stats: {
                    gamesPlayed: 0,
                    downloads: 0,
                    queries: 0,
                    adminCommandsUsed: 0,
                    gameCommandsUsed: 0,
                    infoCommandsUsed: 0,
                    mediaCommandsUsed: 0
                }
            });
        }
        return this.userData.get(userJid);
    }

    // ==================== نظام التحقق من المطورين المحسن ====================
    isDeveloper(jid) {
        if (!jid || typeof jid !== 'string') return false;
        
        const ownerConfig = this.bot.config?.DEVELOPERS;
        if (!ownerConfig || !Array.isArray(ownerConfig)) return false;

        const cleanJidNumber = String(jid).split('@')[0].split(':')[0];

        for (const dev of ownerConfig) {
            if (!dev) continue;
            const cleanDevNumber = String(dev).split('@')[0].split(':')[0];
            if (cleanJidNumber === cleanDevNumber) return true;
        }

        const botId = this.bot.sock?.user?.id;
        if (botId) {
            const botNum = String(botId).split('@')[0].split(':')[0];
            if (cleanJidNumber === botNum) return true;
        }

        return false;
    }

    // ==================== نظام تحويل LID إلى JID ====================
    convertLidToJid(lid) {
        try {
            if (!lid || typeof lid !== 'string') return null;
            
            console.log(chalk.blue(`🔄 convertLidToJid input: ${lid}`));

            if (lid.includes('@s.whatsapp.net')) {
                return lid;
            }
            
            if (lid.includes('@lid')) {
                const numberPart = lid.split('@')[0];
                const cleanNumber = numberPart.split(':')[0];
                console.log(chalk.blue(`🔢 Extracted from LID: ${cleanNumber}`));
                return `${cleanNumber}@s.whatsapp.net`;
            }
            
            const cleanNumber = lid.replace(/[^0-9]/g, '');
            if (cleanNumber.length > 5) {
                return `${cleanNumber}@s.whatsapp.net`;
            }
            
            console.log(chalk.yellow(`⚠️ Cannot convert LID: ${lid}`));
            return null;
        } catch (error) {
            console.log(chalk.red('❌ convertLidToJid error:'), error);
            return null;
        }
    }

    // ==================== نظام التحقق من البوت في المجموعة ====================
    async checkBotInGroup(groupJid, sock) {
        try {
            const metadata = await sock.groupMetadata(groupJid);
            const botJid = sock.user?.id;
            
            console.log(chalk.blue(`🤖 Bot JID: ${botJid}`));
            console.log(chalk.blue(`👥 Participants count: ${metadata.participants.length}`));

            let botParticipant = metadata.participants.find(p => p.id === botJid);
            
            if (!botParticipant) {
                const botNumber = botJid.split('@')[0];
                console.log(chalk.blue(`🔍 Searching by number: ${botNumber}`));
                
                botParticipant = metadata.participants.find(p => {
                    const participantNumber = p.id.split('@')[0].split(':')[0];
                    return participantNumber === botNumber;
                });
            }

            if (!botParticipant) {
                console.log(chalk.blue(`🔍 Searching by LID conversion`));
                const botLid = this.convertLidToJid(botJid);
                if (botLid) {
                    botParticipant = metadata.participants.find(p => p.id === botLid);
                }
            }

            if (botParticipant) {
                console.log(chalk.green(`✅ Bot found in group: ${botParticipant.id} - Admin: ${botParticipant.admin}`));
                return {
                    found: true,
                    participant: botParticipant,
                    isAdmin: botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin',
                    jid: botParticipant.id
                };
            } else {
                console.log(chalk.red(`❌ Bot not found in participants list`));
                console.log(chalk.yellow(`📋 Participants sample:`, metadata.participants.slice(0, 3).map(p => p.id)));
                return { 
                    found: false, 
                    participant: null, 
                    isAdmin: false,
                    jid: botJid
                };
            }
            
        } catch (error) {
            console.log(chalk.red('❌ checkBotInGroup error:'), error);
            return { 
                found: false, 
                participant: null, 
                isAdmin: false,
                jid: sock.user?.id 
            };
        }
    }

    // ==================== نظام البحث في المشاركين مع تحويل LID ====================
    async findParticipantByAnyId(groupJid, targetId, sock) {
        try {
            const metadata = await sock.groupMetadata(groupJid);
            const participants = metadata.participants;
            
            console.log(chalk.blue(`🔍 Searching for: ${targetId} in ${participants.length} participants`));

            let participant = null;
            
            const searchMethods = [
                () => participants.find(p => p.id === targetId),
                
                () => {
                    const convertedJid = this.convertLidToJid(targetId);
                    if (convertedJid) {
                        return participants.find(p => p.id === convertedJid);
                    }
                    return null;
                },
                
                () => {
                    const targetNumber = targetId.split('@')[0].split(':')[0];
                    return participants.find(p => p.id.split('@')[0].split(':')[0] === targetNumber);
                },
                
                () => {
                    const searchTerm = targetId.split('@')[0];
                    return participants.find(p => p.id.includes(searchTerm));
                },
                
                () => {
                    const cleanNumber = targetId.replace(/[^0-9]/g, '');
                    if (cleanNumber.length > 5) {
                        return participants.find(p => {
                            const participantNumber = p.id.split('@')[0].replace(/[^0-9]/g, '');
                            return participantNumber === cleanNumber;
                        });
                    }
                    return null;
                }
            ];
            
            for (const method of searchMethods) {
                participant = method();
                if (participant) {
                    console.log(chalk.green(`✅ Participant found: ${participant.id}`));
                    return {
                        found: true,
                        participant: participant,
                        jid: participant.id,
                        displayName: participant.notify || participant.id.split('@')[0],
                        isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin'
                    };
                }
            }
            
            console.log(chalk.yellow(`⚠️ Participant not found: ${targetId}`));
            return {
                found: false,
                participant: null,
                jid: this.convertLidToJid(targetId) || targetId,
                displayName: targetId.split('@')[0],
                isAdmin: false
            };
            
        } catch (error) {
            console.log(chalk.red('❌ findParticipantByAnyId error:'), error);
            return {
                found: false,
                participant: null,
                jid: this.convertLidToJid(targetId) || targetId,
                displayName: targetId.split('@')[0],
                isAdmin: false
            };
        }
    }

    // ==================== نظام معلومات المستخدم المحسن ====================
    async getUserInfo(sock, message, args = []) {
        try {
            const isGroup = message.key.remoteJid.endsWith('@g.us');
            const selfJid = sock.user?.id;
            
            console.log(chalk.blue(`🔍 getUserInfo called - Group: ${isGroup}, Args: ${args.length}`));

            let groupMetadata = null;
            let participants = [];
            if (isGroup) {
                try {
                    groupMetadata = await sock.groupMetadata(message.key.remoteJid);
                    participants = groupMetadata.participants || [];
                    console.log(chalk.blue(`👥 Group has ${participants.length} participants`));
                } catch (error) {
                    console.log(chalk.red('❌ Failed to get group metadata:'), error.message);
                }
            }

            let targetJid = null;
            let source = 'unknown';

            if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                targetJid = message.message.extendedTextMessage.contextInfo.participant;
                source = 'reply';
                
            }
            
            else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                source = 'mention';
                
            }
            
            else if (args.length > 0) {
                const arg = args[0].replace('@', '').trim();
                if (arg.length > 5) {
                    targetJid = arg;
                    source = 'args';
                    
                }
            }
            
            if (!targetJid) {
                targetJid = message.key.participant || message.key.remoteJid;
                source = 'sender';
                
            }

            

            if (isGroup && participants.length > 0) {
                
                
                let participant = null;
                
                const searchMethods = [
                    () => participants.find(p => p.id === targetJid),
                    
                    () => {
                        const targetNumber = targetJid.split('@')[0];
                        return participants.find(p => p.id.split('@')[0] === targetNumber);
                    },
                    
                    () => {
                        const targetSearch = targetJid.split('@')[0];
                        return participants.find(p => p.id.includes(targetSearch));
                    },
                    
                    () => {
                        if (source === 'args') {
                            const cleanArg = targetJid.replace(/[^0-9]/g, '');
                            return participants.find(p => p.id.split('@')[0].includes(cleanArg));
                        }
                        return null;
                    }
                ];
                
                for (const method of searchMethods) {
                    participant = method();
                    if (participant) {
                        console.log(chalk.green(`✅ Found participant: ${participant.id}`));
                        const userData = this.getUserData(participant.id);
                        // الكود المقترح الصحيح
return {
                            jid: participant.id,
                            lid: participant.id,
                            displayName: participant.notify || participant.id.split('@')[0] || 'Unknown',
                            isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
                            isBot: participant.id === selfJid,
                            isDeveloper: this.isDeveloper(participant.id),
                            userData: userData,
                            groupRole: participant.admin || 'member',
                            foundInGroup: true
                        };
                    }
                }
                
                console.log(chalk.yellow(`⚠️ Participant not found in group: ${targetJid}`));
            }

            let cleanJid = targetJid;
            if (!cleanJid.includes('@s.whatsapp.net') && !cleanJid.includes('@g.us') && !cleanJid.includes('@lid')) {
                cleanJid = `${cleanJid}@s.whatsapp.net`;
            }

            const userData = this.getUserData(cleanJid);
            const displayName = message.pushName || cleanJid.split('@')[0] || 'Unknown';
            
            console.log(chalk.cyan(`👤 Returning default user info: ${displayName} (${cleanJid})`));
            
            return {
                jid: cleanJid,
                lid: cleanJid,
                displayName: displayName,
                isAdmin: false,
                isBot: cleanJid === selfJid,
                isDeveloper: this.isDeveloper(cleanJid),
                userData: userData,
                groupRole: null,
                foundInGroup: false
            };

        } catch (error) {
            console.log(chalk.red('❌ getUserInfo error:'), error.message);
            return null;
        }
    }

    // ==================== نظام تحميل البلجنات المحسن ====================
    async loadPlugins() {
        try {
            console.log(chalk.cyan('🔄 Loading plugins...'));
            
            if (!fs.existsSync(this.pluginDir)) {
                console.log(chalk.yellow('📁 Creating plugins directory...'));
                fs.mkdirSync(this.pluginDir, { recursive: true });
                return;
            }

            const files = fs.readdirSync(this.pluginDir)
                .filter(file => file.endsWith('.js'));
            
            console.log(chalk.blue(`📁 Found ${files.length} plugin files`));
            
            let loadedCount = 0;
            
            for (const file of files) {
                try {
                    await this.loadSinglePlugin(file);
                    loadedCount++;
                } catch (error) {
                    console.log(chalk.red(`❌ Failed to load ${file}:`), error.message);
                }
            }
            
            console.log(gradient.rainbow(`✅ Loaded ${loadedCount} plugins with ${this.commands.size} commands`));
            
            this.showLoadedCommands();
            await this.startPluginWatcher();
            await this.startConfigWatcher(); 
            this.isInitialized = true;
            
        } catch (error) {
            console.log(chalk.red('❌ Plugin load error:'), error.message);
        }
    }

    async loadSinglePlugin(filename) {
        try {
            const cleanFilename = filename.replace(/[^\w\u0600-\u06FF\.\-\s]/g, '');
            
            const pluginPath = path.resolve(this.pluginDir, cleanFilename);

            if (!fs.existsSync(pluginPath)) {
                throw new Error(`File not found: ${cleanFilename}`);
            }

            const importPath = `${pathToFileURL(pluginPath).href}?v=${Date.now()}`;
            const pluginModule = await import(importPath);
            
            let plugin;

            if (pluginModule.default) {
                if (typeof pluginModule.default === 'function') {
                    plugin = pluginModule.default(this.bot);
                } else if (typeof pluginModule.default === 'object') {
                    plugin = pluginModule.default;
                } else {
                    throw new Error('Invalid default export type in plugin');
                }
            } else {
                throw new Error('Plugin has no default export');
            }

            if (!plugin || (!plugin.name && !plugin.commands)) {
                throw new Error('Invalid plugin structure: missing name or commands array');
            }

            await this.registerPlugin(plugin, cleanFilename);
            console.log(chalk.green(`✅ Loaded: ${plugin.name || cleanFilename}`));

        } catch (error) {
            console.log(chalk.red(`❌ Failed to load ${filename}:`), error.message);
            throw error;
        }
    }

    async registerPlugin(plugin, filename) {
        this.plugins.set(filename, {
            ...plugin,
            filename: filename,
            loadTime: Date.now()
        });
        
        if (plugin.commands && Array.isArray(plugin.commands)) {
            plugin.commands.forEach(cmd => {
                this.registerCommand(cmd, plugin.name);
            });
        } else if (plugin.run && typeof plugin.run === 'function' && plugin.name) {
            this.registerCommand({
                name: plugin.name,
                run: plugin.run,
                aliases: plugin.aliases || [],
                description: plugin.description || '',
                developer: plugin.developer || false,
                cooldown: plugin.cooldown || 2000
            }, plugin.name);
        }

        if (plugin.onLoad && typeof plugin.onLoad === 'function') {
            try {
                await plugin.onLoad();
            } catch (error) {
                console.log(chalk.red(`❌ Plugin onLoad failed: ${plugin.name}`), error.message);
            }
        }

        return true;
    }

    registerCommand(command, pluginName = 'unknown') {
        if (!command || !command.name || typeof command.run !== 'function') {
            return false;
        }

        const enhancedCommand = {
            ...command,
            plugin: pluginName,
            usageCount: 0,
            lastUsed: null,
            category: command.category || 'general',
            permissions: command.permissions || {
                group: command.group || false,
                admin: command.admin || false,
                developer: command.developer || false,
                private: command.private || false
            }
        };

        this.commands.set(command.name, enhancedCommand);
        
        if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => {
                this.aliases.set(alias, command.name);
            });
        }

        return true;
    }

    showLoadedCommands() {
        const commands = Array.from(this.commands.keys());
        if (commands.length > 0) {
            const commandList = commands.map(cmd => `${this.bot.config.PREFIX}${cmd}`).join(' | ');
            const title = chalk.cyan('✅ Loaded Commands:');
            const coloredCommands = gradient('lime', 'cyan')(commandList);
            console.log(`\n${title}\n${coloredCommands}\n`);
        }
    }

    // ==================== نظام معالجة متوازي كامل ====================
async handleMessage(message) {
    if (!this.isInitialized || !message.message || !message.key.remoteJid) {
        return false;
    }

    // تنفيذ فوري بدون أي انتظار - كل أمر مستقل
    Promise.resolve().then(async () => {
        try {
            await this.processSingleMessage(message);
        } catch (error) {
            console.log(chalk.red('❌ Async processing error:'), error.message);
        }
    });

    return true;
}

// معالجة كل أمر في thread منفصل
async processSingleMessage(message) {
    return new Promise((resolve) => {
        // بدء المعالجة في دورة event منفصلة
        setImmediate(async () => {
            let cmdName = '';
            try {
                this.stats.messagesProcessed++;
                
                const userJid = this.getUserJid(message);
                if (this.security.blockedUsers.has(userJid)) {
                    return resolve(false);
                }

                const text = this.extractText(message);
                if (!text) return resolve(false);

                const isGroup = this.isGroup(message);
                const isDev = this.isDeveloper(userJid);
                const prefix = this.bot.config.PREFIX;
                const hasPrefix = text.toLowerCase().startsWith(prefix.toLowerCase());

                const userData = this.getUserData(userJid);
                userData.messageCount++;
                userData.lastSeen = Date.now();

                // كل أمر بيتنفذ بشكل مستقل
                if (hasPrefix) {
                    const result = await this.handlePrefixCommand(message, text, userJid, isGroup, isDev);
                    if (result) return resolve(true);
                }

                const autoResult = await this.handleAutoCommand(message, text, userJid, isGroup, isDev);
                if (autoResult) return resolve(true);
                
                const continuousResult = await this.handleContinuousCommand(message, text, userJid);
                if (continuousResult) return resolve(true);

                resolve(false);
            } catch (error) {
                this.stats.errors++;
                console.log(chalk.red(`❌ Command error in [${cmdName || 'unknown'}]:`), error.message);
                resolve(false);
            }
        });
    });
}
    async handlePrefixCommand(message, text, userJid, isGroup, isDev) {
        const prefix = this.bot.config.PREFIX;
        const args = text.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        
        const command = this.commands.get(cmdName) || this.commands.get(this.aliases.get(cmdName));
        if (!command) return false;

        // ⚡ نظام تحقق سريع مع كاش
        const permissionCheck = await this.checkPermissions(command, userJid, isGroup, isDev, message);
        if (!permissionCheck.allowed) {
            if (permissionCheck.message && message) {
                await this.sendMessage(message.key.remoteJid, { text: permissionCheck.message });
            }
            return false;
        }

  
        console.log(gradient.mind(`🎯 Executing: ${command.name} from ${this.getSenderInfo(message)}`));

        const userData = this.getUserData(userJid);
        userData.commandCount++;
        command.usageCount = (command.usageCount || 0) + 1;
        command.lastUsed = Date.now();
        this.updateCooldown(command, message);

        this.updateCommandStats(userData, command.category);

        const runOptions = {
            bot: this.bot,
            sock: this.bot.sock,
            m: message,
            message: message,
            args: args,
            text: args.join(' '),
            handler: this,
            command: command.name,
            prefix: prefix,
            user: userData,
            userJid: userJid,
            isGroup: isGroup,
            isDeveloper: isDev,
            reply: (content, options = {}) => this.sendMessage(
                message.key.remoteJid,
                (typeof content === 'string' ? { text: content } : content),
                { quoted: message, ...options }
            ),
            react: (emoji) => this.react(message, emoji),
            sendMessage: (jid, content, options) => this.sendMessage(jid, content, options),
            getUserInfo: (targetArgs = args) => this.getUserInfo(this.bot.sock, message, targetArgs),
            getGroupInfo: () => this.getGroupInfo(message.key.remoteJid),
            startContinuous: (data = {}) => this.startContinuousCommand(userJid, command, data),
            endContinuous: () => this.endContinuousCommand(userJid),
            wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            log: (msg, type = 'info') => {
                const colors = { info: chalk.blue, warn: chalk.yellow, error: chalk.red };
                console.log(colors[type](`[${command.name}]`), msg);
            },
            formatNumber: (num) => new Intl.NumberFormat().format(num),
            formatTime: (ms) => this.formatUptime(ms),
            downloadMedia: () => this.downloadMedia(message),
            sendMedia: (jid, buffer, type, options) => this.sendMedia(jid, buffer, type, options),
            createButtons: (buttons, text, title) => this.createButtons(buttons, text, title),
            createList: (sections, title, text) => this.createList(sections, title, text),
        };
        
        try {
            await command.run(runOptions);
            this.stats.commandsExecuted++;
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Command execution error [${command.name}]:`), error);
            await this.sendMessage(message.key.remoteJid, { 
                text: `❌ حدث خطأ أثناء تنفيذ الأمر: ${error.message}` 
            });
            return true;
        }
    }

    // 🎮 نظام جلسات الألعاب
    createGameSession(userJid, gameType, initialData = {}) {
        const sessionId = `${userJid}_${gameType}_${Date.now()}`;
        const session = {
            id: sessionId,
            userJid: userJid,
            gameType: gameType,
            data: initialData,
            state: 'waiting',
            players: [userJid],
            createdAt: Date.now(),
            lastActivity: Date.now(),
            maxPlayers: initialData.maxPlayers || 10,
            settings: {
                private: initialData.private || false,
                password: initialData.password || null,
                timeLimit: initialData.timeLimit || 300000
            }
        };

        this.gameSessions.set(sessionId, session);
        
        setTimeout(() => {
            if (this.gameSessions.has(sessionId)) {
                this.endGameSession(sessionId);
            }
        }, session.settings.timeLimit);

        return session;
    }

    joinGameSession(sessionId, userJid, password = null) {
        const session = this.gameSessions.get(sessionId);
        if (!session) return { success: false, reason: 'SESSION_NOT_FOUND' };

        if (session.settings.private && session.settings.password !== password) {
            return { success: false, reason: 'INVALID_PASSWORD' };
        }

        if (session.players.length >= session.maxPlayers) {
            return { success: false, reason: 'SESSION_FULL' };
        }

        if (!session.players.includes(userJid)) {
            session.players.push(userJid);
            session.lastActivity = Date.now();
        }

        return { success: true, session: session };
    }

    endGameSession(sessionId) {
        const session = this.gameSessions.get(sessionId);
        if (session) {
            this.gameSessions.delete(sessionId);
            return true;
        }
        return false;
    }

    getActiveGameSessions(gameType = null) {
        const now = Date.now();
        const activeSessions = [];

        for (const [sessionId, session] of this.gameSessions) {
            if (now - session.lastActivity < 600000) {
                if (!gameType || session.gameType === gameType) {
                    activeSessions.push(session);
                }
            } else {
                this.endGameSession(sessionId);
            }
        }

        return activeSessions;
    }

    // ==================== ✨ نظام التحقق من الصلاحيات (محسن مع Cache) ✨ ====================
    async checkPermissions(command, userJid, isGroup, isDev, message) {
        if (this.bot.config?.MODE === 'private' && !isDev) return { allowed: false };
        
        if (command.developer && !isDev) return { allowed: false, message: '❌ هذا الأمر للمطورين فقط' };

        if (command.group && !isGroup) return { allowed: false, message: '❌ هذا الأمر للمجموعات فقط' };
        
        if (command.private && isGroup) return { allowed: false, message: '❌ هذا الأمر للخاص فقط' };

    if (!isGroup || (!command.admin && !command.botAdmin)) {
        return { allowed: true };
    }

        const groupJid = message.key.remoteJid;
        let groupMetadata = this.cache.get(groupJid);
        if (!groupMetadata) {
            console.log(chalk.yellow(`[Cache] Miss for group: ${groupJid}`));
            groupMetadata = await this.bot.sock.groupMetadata(groupJid);
            this.cache.set(groupJid, groupMetadata);
        } else {
            console.log(chalk.green(`[Cache] Hit for group: ${groupJid}`));
        }

    // التحقق من صلاحيات المشرف
    if (command.admin) {
        const senderParticipant = groupMetadata.participants.find(p => p.id === userJid);
        if (!senderParticipant?.admin && !isDev) {
            return { allowed: false, message: '❌ هذا الأمر للمشرفين فقط' };
        }
    }
    
        
        if (command.botAdmin) {
            const botJid = this.bot.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            if (!botParticipant?.admin) {
                return { allowed: false, message: '❌ يجب أن يكون البوت مشرفًا' };
            }
        }

        return { allowed: true };
    }

    // ==================== نظام إدارة الجروبات المحسن ====================
    async isGroupAdmin(groupJid, userJid) {
        try {
            const metadata = await this.bot.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === userJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            console.log(chalk.red('❌ Check group admin error:'), error.message);
            return false;
        }
    }

    async getGroupInfo(groupJid) {
        try {
            const metadata = await this.bot.sock.groupMetadata(groupJid);
            return {
                id: metadata.id,
                subject: metadata.subject,
                description: metadata.desc,
                size: metadata.participants.length,
                creation: metadata.creation,
                owner: metadata.owner,
                admins: metadata.participants.filter(p => p.admin).map(p => p.id),
                participants: metadata.participants
            };
        } catch (error) {
            console.log(chalk.red('❌ Get group info error:'), error.message);
            return null;
        }
    }

    // ==================== نظام الإحصائيات المحسن ====================
    updateCommandStats(userData, category) {
        if (!userData.stats) return;

        const statMap = {
            admin: 'adminCommandsUsed',
            game: 'gameCommandsUsed',
            info: 'infoCommandsUsed',
            media: 'mediaCommandsUsed',
            download: 'downloads',
            tool: 'queries'
        };

        const statKey = statMap[category] || 'queries';
        userData.stats[statKey] = (userData.stats[statKey] || 0) + 1;
    }


    // ==================== نظام Cooldown المحسن ====================
    checkCooldown(command, message) {
        const userJid = this.getUserJid(message);
        const cooldownKey = `${userJid}:${command.name}`;
        const now = Date.now();

        if (this.cooldowns.has(cooldownKey)) {
            const expirationTime = this.cooldowns.get(cooldownKey) + (command.cooldown || 2000);
            if (now < expirationTime) {
                const remaining = Math.ceil((expirationTime - now) / 1000);
                return { allowed: false, remaining };
            }
        }

        return { allowed: true, remaining: 0 };
    }

    updateCooldown(command, message) {
        const userJid = this.getUserJid(message);
        const cooldownKey = `${userJid}:${command.name}`;
        this.cooldowns.set(cooldownKey, Date.now());
    }

    // ==================== نظام الأوامر المستمرة ====================
    startContinuousCommand(userJid, command, initialData = {}) {
        this.continuousCommands.set(userJid, {
            command,
            data: initialData,
            step: 0,
            timestamp: Date.now()
        });

        setTimeout(() => {
            if (this.continuousCommands.get(userJid)?.timestamp === Date.now() - 600000) {
                this.endContinuousCommand(userJid);
            }
        }, 600000);

        return true;
    }

    endContinuousCommand(userJid) {
        this.continuousCommands.delete(userJid);
        return true;
    }

    async handleContinuousCommand(message, text, userJid) {
        const continuousData = this.continuousCommands.get(userJid);
        if (!continuousData) return false;

        const { command, data, step } = continuousData;
        
        if (command.onContinue && typeof command.onContinue === 'function') {
            try {
                const result = await command.onContinue({
                    bot: this.bot,
                    sock: this.bot.sock,
                    message: message,
                    text: text,
                    userJid: userJid,
                    data: data,
                    step: step,
                    handler: this,
                    reply: (content) => this.sendMessage(message.key.remoteJid, 
                        typeof content === 'string' ? { text: content } : content, 
                        { quoted: message }
                    ),
                    endContinuous: () => this.endContinuousCommand(userJid)
                });

                if (result === true || result === 'continue') {
                    this.continuousCommands.set(userJid, {
                        command,
                        data: result.data || data,
                        step: step + 1,
                        timestamp: Date.now()
                    });
                } else if (result === false || result === 'end') {
                    this.endContinuousCommand(userJid);
                }

                return true;
            } catch (error) {
                console.log(chalk.red(`❌ Continuous command error:`), error.message);
                this.endContinuousCommand(userJid);
                return true;
            }
        }

        return false;
    }

    // ==================== نظام الأوامر التلقائية ====================
    async handleAutoCommand(message, text, userJid, isGroup, isDev) {
        for (const [cmdName, command] of this.autoCommands.entries()) {
            if (this.textMatchesCommand(text, cmdName, command.aliases)) {
                const permissionCheck = await this.checkPermissions(command, userJid, isGroup, isDev, message);
                if (!permissionCheck.allowed) {
                    continue;
                }

                const args = this.extractAutoCommandArgs(text, cmdName, command.aliases);
                
                console.log(gradient.mind(`🎯 Executing AUTO: ${command.name} from ${this.getSenderInfo(message)}`));

                const userData = this.getUserData(userJid);
                userData.messageCount++;
                userData.lastSeen = Date.now();
                command.usageCount = (command.usageCount || 0) + 1;
                command.lastUsed = Date.now();
                userData.commandCount++;
                this.updateCooldown(command, message);

                const runOptions = {
                    bot: this.bot,
                    sock: this.bot.sock,
                    message: message,
                    args: args,
                    text: args.join(' '),
                    handler: this,
                    command: command.name,
                    prefix: this.bot.config.PREFIX,
                    user: userData,
                    userJid: userJid,
                    isGroup: isGroup,
                    isDeveloper: isDev,
                    isAuto: true,
                    reply: (content, options = {}) => this.sendMessage(
                        message.key.remoteJid,
                        (typeof content === 'string' ? { text: content } : content),
                        { quoted: message, ...options }
                    ),
                    react: (emoji) => this.react(message, emoji),
                    sendMessage: (jid, content, options) => this.sendMessage(jid, content, options),
                    getUserInfo: (targetArgs = args) => this.getUserInfo(this.bot.sock, message, targetArgs),
                    startContinuous: (data = {}) => this.startContinuousCommand(userJid, command, data),
                    endContinuous: () => this.endContinuousCommand(userJid)
                };
                
                await command.run(runOptions);

                this.stats.commandsExecuted++;
                return true;
            }
        }
        return false;
    }

    textMatchesCommand(text, cmdName, aliases = []) {
        const cleanText = text.toLowerCase().trim();
        const patterns = [cmdName.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
        
        return patterns.some(pattern => {
            return cleanText === pattern || 
                   cleanText.startsWith(pattern + ' ') ||
                   cleanText.includes(' ' + pattern + ' ') ||
                   cleanText.endsWith(' ' + pattern);
        });
    }

    extractAutoCommandArgs(text, cmdName, aliases = []) {
        const patterns = [cmdName, ...aliases].map(p => p.toLowerCase());
        let cleanText = text.toLowerCase();
        
        for (const pattern of patterns) {
            if (cleanText.includes(pattern)) {
                cleanText = cleanText.replace(pattern, '').trim();
                break;
            }
        }
        
        return cleanText.split(/ +/).filter(arg => arg.length > 0);
    }

    // ==================== دوال مساعدة محسنة ====================
    getSenderInfo(message) {
        const jid = message.key.remoteJid;
        const name = message.pushName || 'Unknown';
        const isGroup = jid.endsWith('@g.us');
        const isFromMe = message.key.fromMe;
        
        if (isFromMe) return 'BOT';
        if (isGroup) return `${name} (Group)`;
        return name;
    }

    getUserJid(message) {
        return message.key.participant || message.key.remoteJid;
    }

    isGroup(message) {
        return message.key.remoteJid.endsWith('@g.us');
    }

    extractText(message) {
        const msg = message.message;
        if (msg.conversation) return msg.conversation;
        if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
        if (msg.imageMessage?.caption) return msg.imageMessage.caption;
        if (msg.videoMessage?.caption) return msg.videoMessage.caption;
        if (msg.buttonsResponseMessage?.selectedButtonId) return `button:${msg.buttonsResponseMessage.selectedButtonId}`;
        if (msg.listResponseMessage?.title) return `list:${msg.listResponseMessage.title}`;
        return null;
    }

    // ==================== نظام الإرسال المحسن ====================
    async sendMessage(jid, content, options = {}) {
        try {
            if (typeof content === 'string') {
                content = { text: content };
            }

            const newOptions = { ...options };

            if (newOptions.quoted && newOptions.quoted.key) {
                newOptions.quoted = {
                    key: newOptions.quoted.key,
                    message: newOptions.quoted.message
                };
            }

            return await this.bot.sendMessage(jid, content, newOptions);

        } catch (error) {
            if (!error.message.includes('Invalid media type')) {
                console.log(chalk.red(`❌ Send message error: ${error.message}`));
            }
            return null;
        }
    }

    async react(message, emoji) {
        try {
            await this.bot.sendMessage(message.key.remoteJid, {
                react: {
                    text: emoji,
                    key: message.key
                }
            });
        } catch (error) {
            console.log(chalk.red(`❌ React error: ${error.message}`));
        }
    }

    // ==================== ✨ نظام الوسائط الفائق ====================
    async downloadMedia(message) {
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const original = message.message;

            let type = null;
            let mediaMessage = null;

            if (quoted) {
                type = Object.keys(quoted)[0];
                mediaMessage = quoted[type];
            } else if (original) {
                type = Object.keys(original)[0];
                mediaMessage = original[type];
            }

            if (!mediaMessage || !type) {
                console.log(chalk.red('❌ Media message not found.'));
                return null;
            }
            
            const stream = await downloadContentFromMessage(mediaMessage, type.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            console.log(chalk.green(`✅ Media downloaded successfully (${(buffer.length / 1024).toFixed(2)} KB)`));
            return buffer;

        } catch (error) {
            console.log(chalk.red('❌ Media download error:'), error.message);
            return null;
        }
    }

    async sendMedia(jid, buffer, type, options = {}) {
        try {
            let mediaMessage = {};
            
            switch (type) {
                case 'image':
                    mediaMessage = { image: buffer, ...options };
                    break;
                case 'video':
                    mediaMessage = { video: buffer, ...options };
                    break;
                case 'audio':
                    mediaMessage = { audio: buffer, ...options };
                    break;
                case 'document':
                    mediaMessage = { document: buffer, ...options };
                    break;
                case 'sticker':
                    mediaMessage = { sticker: buffer, ...options };
                    break;
            }
            
            return await this.sendMessage(jid, mediaMessage);
        } catch (error) {
            console.log(chalk.red(`❌ Send media error: ${error.message}`));
            return null;
        }
    }

    // ==================== نظام الأزرار والقوائم المحسن ====================
    createButtons(buttons, text = 'اختر من الأزرار:', title = 'SOLO BOT') {
        return {
            text: text,
            footer: 'SOLO BOT - KING',
            title: title,
            buttons: buttons.map(btn => ({
                buttonId: btn.id,
                buttonText: { 
                    displayText: btn.text 
                },
                type: 1
            })),
            headerType: 1
        };
    }

    createList(sections, title = 'القائمة', text = 'اختر من القائمة:') {
        return {
            text: text,
            footer: 'SOLO BOT - KING',
            title: title,
            buttonText: 'عرض الخيارات',
            sections: Array.isArray(sections) ? sections : [sections]
        };
    }

    createSection(title, rows) {
        return {
            title: title,
            rows: rows.map(row => ({
                title: row.title,
                description: row.description || '',
                rowId: row.id || Math.random().toString(36).substring(7)
            }))
        };
    }

    // ==================== نظام المراقبة المحسن ====================
    async startPluginWatcher() {
        try {
            const { default: chokidar } = await import('chokidar');
            
            if (this.watcher) await this.watcher.close();

            this.watcher = chokidar.watch(this.pluginDir, {
                persistent: true,
                ignoreInitial: true,
                atomic: true,
                awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
            });

            const handleFileEvent = async (filePath, eventType) => {
                if (this.isReloading || !filePath.endsWith('.js')) return;

                const filename = path.basename(filePath);
                
                try {
                    switch (eventType) {
                        case 'change':
                            console.log(chalk.yellow(`🔄 Plugin changed: ${filename}`));
                            await this.reloadPlugin(filename);
                            break;
                        case 'add':
                            console.log(chalk.green(`📁 New plugin: ${filename}`));
                            await this.loadSinglePlugin(filename);
                            this.showLoadedCommands();
                            break;
                        case 'unlink':
                            console.log(chalk.yellow(`🗑️ Plugin deleted: ${filename}`));
                            await this.unloadPlugin(filename);
                            this.showLoadedCommands();
                            break;
                    }
                } catch (error) {
                    console.log(chalk.red(`❌ Plugin ${eventType} failed for ${filename}:`), error.message);
                }
            };

            this.watcher
                .on('change', (filePath) => handleFileEvent(filePath, 'change'))
                .on('add', (filePath) => handleFileEvent(filePath, 'add'))
                .on('unlink', (filePath) => handleFileEvent(filePath, 'unlink'));

            console.log(chalk.cyan('👀 Plugin watcher V2 started successfully'));

        } catch (error) {
            console.log(chalk.red('❌ Plugin watch error:'), error.message);
        }
    }
// ... بعد نهاية دالة startPluginWatcher()

    // ==================== ✨ نظام مراقبة الكونفج الجديد ✨ ====================
    async startConfigWatcher() {
        try {
            const { default: chokidar } = await import('chokidar');
            const configPath = path.resolve(process.cwd(), 'config.js');

            if (this.configWatcher) await this.configWatcher.close();

            this.configWatcher = chokidar.watch(configPath, {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
            });

            this.configWatcher.on('change', async (filePath) => {
                console.log(chalk.yellow('🔄 Config file changed. Reloading configuration...'));
                try {
                    // نستورد الكونفج الجديد ونقوم بتحديثه في كائن البوت الرئيسي
                    const { config: newConfig } = await import(`${pathToFileURL(filePath).href}?v=${Date.now()}`);
                    this.bot.config = newConfig;
                    console.log(chalk.green('✅ Config reloaded successfully!'));
                    
                    // إرسال إشعار للمطور (اختياري)
                    const devJid = this.bot.config.OWNERERROR || (this.bot.config.DEVELOPERS && this.bot.config.DEVELOPERS[0]);

                } catch (error) {
                    console.log(chalk.red('❌ Failed to reload config:'), error.message);
                }
            });

            console.log(chalk.cyan('⚙️ Config watcher started successfully'));

        } catch (error) {
            console.log(chalk.red('❌ Config watch error:'), error.message);
        }
    }
        // =================================================================
    // ✨ نظام مراقبة الملفات الأساسية (Hot Reloading) ✨
    // =================================================================
    async startCoreFileWatcher() {
        try {
            if (this.coreWatcher) await this.coreWatcher.close();

            const { default: chokidar } = await import('chokidar');
            const rootDir = process.cwd();
            
            // المسارات التي سيتم مراقبتها (بدون البلجنات)
                        // المسارات التي سيتم مراقبتها (بدون البلجنات)
            const pathsToWatch = [
                path.join(rootDir, 'handler.js'),
                path.join(rootDir, 'index.js'),
                path.join(rootDir, 'console.js'), // ✨ تمت الإضافة
                path.join(rootDir, 'messages.js')  // ✨ تمت الإضافة
            ];


            this.coreWatcher = chokidar.watch(pathsToWatch, {
                persistent: true,
                ignoreInitial: true,
                atomic: true,
                awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
            });

            this.coreWatcher.on('change', async (filePath) => {
                const filename = path.basename(filePath);
                console.log(chalk.magenta(`🚨 Core file (${filename}) changed. Triggering bot restart...`));
                
                const devJid = this.bot.config.OWNERERROR || this.bot.config.DEVELOPERS?.[0];
                if (devJid) {
                    try {
                        await this.bot.sendMessage(devJid, { text: `🚨 تم تعديل ملف أساسي (${filename}). سيتم إعادة تشغيل البوت الآن...` });
                    } catch (e) {
                        console.log(chalk.red('Could not send restart notification to developer.'));
                    }
                }

                // استدعاء دالة إعادة التشغيل في البوت الرئيسي
                if (typeof this.bot.restart === 'function') {
                    await this.bot.restart();
                } else {
                    console.log(chalk.red('  > Restart function not found on bot object. Exiting process...'));
                    process.exit(1); // الخروج كخطة بديلة
                }
            });

            console.log(chalk.blueBright('👀 Core file watcher started successfully.'));

        } catch (error) {
            console.log(chalk.red('❌ Core file watch error:'), error.message);
        }
    }


    async reloadPlugin(pluginName) {
        let filename;
        
        for (const [loadedFilename, plugin] of this.plugins.entries()) {
            if (loadedFilename.replace('.js', '') === pluginName || 
                loadedFilename === pluginName ||
                (plugin.name && plugin.name === pluginName)) {
                filename = loadedFilename;
                break;
            }
        }
        
        if (!filename) {
            filename = pluginName.endsWith('.js') ? pluginName : `${pluginName}.js`;
            if (!this.plugins.has(filename)) {
                console.log(chalk.red(`❌ Reload failed: Plugin "${pluginName}" not found.`));
                console.log(chalk.yellow(`📁 Available plugins: ${Array.from(this.plugins.keys()).join(', ')}`));
                return false;
            }
        }

        const plugin = this.plugins.get(filename);
        console.log(chalk.cyan(`🔄 Reloading: ${filename} (${plugin.name})`));

        if (plugin.onUnload) {
            try {
                await plugin.onUnload();
            } catch (error) {
                console.log(chalk.red(`❌ Plugin onUnload failed: ${filename}`), error.message);
            }
        }

        if (plugin.commands && Array.isArray(plugin.commands)) {
            plugin.commands.forEach(cmd => {
                this.commands.delete(cmd.name);
                if (cmd.aliases) {
                    cmd.aliases.forEach(alias => this.aliases.delete(alias));
                }
            });
        } else if (plugin.name) {
            this.commands.delete(plugin.name);
            if (plugin.aliases) {
                plugin.aliases.forEach(alias => this.aliases.delete(alias));
            }
        }

        try {
            await this.loadSinglePlugin(filename);
            console.log(chalk.green(`✅ Successfully reloaded: ${filename}`));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to reload: ${filename}`), error.message);
            return false;
        }
    }

    async unloadPlugin(pluginName) {
        if (this.isReloading) return false;
        
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) return false;

            console.log(chalk.yellow(`🔄 Unloading: ${pluginName}`));

            if (plugin.onUnload) {
                try {
                    await plugin.onUnload();
                } catch (error) {
                    console.log(chalk.red(`❌ Plugin onUnload failed: ${pluginName}`), error.message);
                }
            }

            if (plugin.commands) {
                plugin.commands.forEach(cmd => {
                    this.commands.delete(cmd.name);
                    if (cmd.aliases) {
                        cmd.aliases.forEach(alias => {
                            this.aliases.delete(alias);
                        });
                    }
                });
            }

            this.plugins.delete(pluginName);
            console.log(chalk.green(`✅ Unloaded: ${pluginName}`));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Unload plugin error: ${pluginName}`), error);
            return false;
        }
    }


    // ==================== نظام مراقبة الأداء ====================
    startPerformanceMonitor() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            
            if (heapUsed > 500) {
                global.gc && global.gc();
            }
        }, 60000);
    }

    // ==================== نظام التنظيف المحسن ====================
    startCleanupCycle() {
        setInterval(() => {
            this.cleanupExpiredData();
        }, 300000);
    }

    cleanupExpiredData() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, timestamp] of this.cooldowns.entries()) {
            if (now - timestamp > 300000) {
                this.cooldowns.delete(key);
                cleaned++;
            }
        }
        
        for (const [key, data] of this.security.spamDetection.entries()) {
            if (now - data.lastMessage > 600000) {
                this.security.spamDetection.delete(key);
                cleaned++;
            }
        }
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(chalk.blue(`🧹 Cleaned ${cleaned} expired entries`));
        }
    }

    // ==================== دوال الاستعلام المحسنة ====================
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    getAllCommands() {
        return Array.from(this.commands.values());
    }

    getCommandsByCategory(category) {
        return this.getAllCommands().filter(cmd => cmd.category === category);
    }

    getPlugin(name) {
        return this.plugins.get(name);
    }

    getCommand(name) {
        return this.commands.get(name) || this.commands.get(this.aliases.get(name));
    }

    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const memory = process.memoryUsage();
        
        return {
            ...this.stats,
            uptime: this.formatUptime(uptime),
            pluginsCount: this.plugins.size,
            commandsCount: this.commands.size,
            memory: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            mode: this.bot.config?.MODE || 'public',
            gameSessions: this.gameSessions.size
        };
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days} يوم`);
        if (hours > 0) parts.push(`${hours} ساعة`);
        if (minutes > 0) parts.push(`${minutes} دقيقة`);
        if (secs > 0) parts.push(`${secs} ثانية`);

        return parts.join(' ') || '0 ثانية';
    }

    getCommandUsage() {
        const commands = this.getAllCommands();
        return commands
            .filter(cmd => cmd.usageCount > 0)
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 10)
            .map(cmd => ({
                name: cmd.name,
                usageCount: cmd.usageCount,
                plugin: cmd.plugin,
                category: cmd.category,
                lastUsed: cmd.lastUsed ? new Date(cmd.lastUsed).toLocaleString() : 'Never'
            }));
    }

    // ==================== نظام إعادة التحميل المحسن ====================
    async reloadAllPlugins() {
        console.log(chalk.yellow('🔄 Manual reload started...'));
        
        this.isReloading = true;
        try {
            const pluginNames = Array.from(this.plugins.keys());
            let successCount = 0;
            
            for (const pluginName of pluginNames) {
                try {
                    await this.unloadPlugin(pluginName);
                    successCount++;
                } catch (error) {
                    console.log(chalk.red(`❌ Failed to unload: ${pluginName}`));
                }
            }
            
            await this.loadPlugins();
            console.log(chalk.green(`✅ Reloaded ${successCount} plugins`));
            return successCount;
            
        } finally {
            this.isReloading = false;
        }
    }

    // ==================== الإغلاق المحسن ====================
    async close() {
        if (this.watcher) {
            await this.watcher.close();
        }
        this.saveData();
        this.isInitialized = false;
        console.log(chalk.yellow('🛑 Handler stopped'));
    }
}

export { Handler };
