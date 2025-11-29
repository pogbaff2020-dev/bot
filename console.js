import readline from 'readline';
import chalk from 'chalk';
import gradient from 'gradient-string';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

export class ConsoleSystem {
    constructor(bot) {
        this.bot = bot;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.spinner = null;
        this.commands = new Map();
        this.consoleMessageCount = { private: 0, group: 0 };
        
        this.setupConsoleCommands();
        this.startInteractiveMode();
    }

    // --- ✨ دالة سريعة لطباعة الرسائل الواردة ✨ ---
    async logMessage(message) {
        // إيقاف أي سبينر نشط أولاً
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }

        // تحديث عداد الرسائل
        const isGroup = message.key.remoteJid.endsWith('@g.us');
        if (isGroup) {
            this.consoleMessageCount.group++;
        } else {
            this.consoleMessageCount.private++;
        }

        // استخراج المعلومات بسرعة
        const fromMe = message.key.fromMe;
        const jid = message.key.remoteJid;
        const senderName = message.pushName || 'Unknown';
        
        // استخراج النص بسرعة
        const msg = message.message;
        const messageText = msg?.conversation || 
                           msg?.extendedTextMessage?.text || 
                           msg?.imageMessage?.caption || 
                           msg?.videoMessage?.caption || 
                           this.getMediaType(msg) || '[No Text]';

        // مسح السطر الحالي بسرعة
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        // طباعة سريعة ومباشرة
        console.log(gradient.mind('╭─── • 𝐒𝐎𝐋𝐎 • ───╮'));
        
        if (isGroup) {
            console.log(chalk.white(`│≠ 📨 Group: ${chalk.cyan(senderName)}`));
        } else {
            console.log(chalk.white(`│≠ 👤 Private: ${chalk.cyan(senderName)}`));
        }
        
        console.log(chalk.white(`│≠ 💬 ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`));
        console.log(gradient.mind('╰─── • 𝐒𝐎𝐋𝐎 • ───╯'));

        // إعادة الطباعة فوراً
        this.rl.prompt(true);
    }

    getMediaType(msg) {
        if (msg.imageMessage) return '[🖼️ Image]';
        if (msg.videoMessage) return '[🎥 Video]';
        if (msg.audioMessage) return '[🎵 Audio]';
        if (msg.documentMessage) return '[📄 Document]';
        if (msg.stickerMessage) return '[🩹 Sticker]';
        return '[Media]';
    }

    setupConsoleCommands() {
        // أوامر سريعة وفعالة
        this.commands.set('help', {
            description: 'Show all console commands',
            execute: () => this.showHelp()
        });

        this.commands.set('status', {
            description: 'Show bot status',
            execute: () => this.showStatus()
        });

        this.commands.set('add', {
            description: 'Show console message counts',
            execute: () => this.showMessageCounts()
        });

        this.commands.set('rf', {
            description: 'Delete file - rf <filename>',
            execute: (args) => this.deleteFile(args[0])
        });

        this.commands.set('restart', {
            description: 'Fast soft restart',
            execute: () => this.fastRestart()
        });

        this.commands.set('clear', {
            description: 'Clear console',
            execute: () => this.fastClear()
        });

        this.commands.set('plugins', {
            description: 'List plugins quickly',
            execute: () => this.fastPluginsList()
        });

        this.commands.set('reload', {
            description: 'Reload plugin - reload <name>',
            execute: (args) => this.reloadPlugin(args[0])
        });

        this.commands.set('exec', {
            description: 'Execute JavaScript code',
            execute: (args) => this.executeCode(args.join(' '))
        });

        this.commands.set('gc', {
            description: 'Force garbage collection',
            execute: () => this.forceGC()
        });

        this.commands.set('speed', {
            description: 'Test bot speed',
            execute: () => this.testSpeed()
        });
    }

    startInteractiveMode() {
        this.showWelcome();
        this.setupInputHandler();
    }

    showWelcome() {
        console.log(gradient.rainbow(`
╔══════════════════════════════════╗
║        FAST CONSOLE SYSTEM      ║
║     Type 'help' for commands    ║
╚══════════════════════════════════╝
        `));
    }

    setupInputHandler() {
        this.rl.setPrompt(gradient.mind('SOLO> '));
        this.rl.prompt();

        this.rl.on('line', (input) => {
            this.handleInput(input.trim());
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\n🛑 Console closed'));
            process.exit(0);
        });
    }

    async handleInput(input) {
        if (!input) return;

        const [command, ...args] = input.split(' ');
        
        if (this.commands.has(command.toLowerCase())) {
            try {
                await this.commands.get(command.toLowerCase()).execute(args);
            } catch (error) {
                console.log(chalk.red(`❌ ${error.message}`));
            }
        } else {
            console.log(chalk.red(`❌ Unknown command: ${command}`));
        }
    }

    showHelp() {
        console.log(gradient.rainbow('\n📖 Fast Commands:'));
        console.log(gradient.rainbow('────────────────'));
        
        this.commands.forEach((cmd, name) => {
            console.log(chalk.cyan(`  ${name.padEnd(8)} ${cmd.description}`));
        });
    }

    showStatus() {
        const uptime = Date.now() - (this.bot.startTime || Date.now());
        console.log(gradient.mind('\n📊 Status:'));
        console.log(chalk.cyan(`  Uptime: ${this.formatUptime(uptime)}`));
        console.log(chalk.cyan(`  Messages: ${this.bot.messages?.messageCount || 0}`));
        console.log(chalk.cyan(`  Memory: ${this.getMemoryUsage()}`));
        console.log(chalk.cyan(`  Connected: ${this.bot.isConnected ? '✅' : '❌'}`));
    }

    showMessageCounts() {
        console.log(gradient.mind('\n📨 Console Messages:'));
        console.log(chalk.cyan(`  Private: ${this.consoleMessageCount.private}`));
        console.log(chalk.cyan(`  Groups: ${this.consoleMessageCount.group}`));
        console.log(chalk.cyan(`  Total: ${this.consoleMessageCount.private + this.consoleMessageCount.group}`));
    }

    async deleteFile(filename) {
        if (!filename) {
            console.log(chalk.red('❌ Usage: rf <filename>'));
            return;
        }

        try {
            if (!fs.existsSync(filename)) {
                console.log(chalk.red(`❌ File not found: ${filename}`));
                return;
            }

            fs.removeSync(filename);
            console.log(chalk.green(`✅ Deleted: ${filename}`));
        } catch (error) {
            console.log(chalk.red(`❌ Delete failed: ${error.message}`));
        }
    }

    async fastRestart() {
        console.log(chalk.yellow('🔄 Fast restart...'));
        
        try {
            // إعادة التشغيل السريعة باستخدام نفس النظام
            if (this.bot.softRestart) {
                await this.bot.softRestart();
                console.log(chalk.green('✅ Restart completed'));
            } else {
                console.log(chalk.yellow('⚠️  Using fallback restart...'));
                process.exit(0);
            }
        } catch (error) {
            console.log(chalk.red(`❌ Restart failed: ${error.message}`));
        }
    }

    fastClear() {
        console.clear();
        this.showWelcome();
    }

    fastPluginsList() {
        if (!this.bot.handler?.plugins) {
            console.log(chalk.red('❌ No plugins'));
            return;
        }

        const plugins = Array.from(this.bot.handler.plugins.values());
        console.log(gradient.passion('\n🔌 Plugins:'));
        
        plugins.forEach(plugin => {
            console.log(chalk.cyan(`  ${plugin.name}`));
        });
        
        console.log(chalk.cyan(`  Total: ${plugins.length}`));
    }

    async reloadPlugin(pluginName) {
        if (!pluginName) {
            console.log(chalk.red('❌ Usage: reload <plugin-name>'));
            return;
        }

        try {
            if (this.bot.handler?.reloadPlugin) {
                await this.bot.handler.reloadPlugin(pluginName);
                console.log(chalk.green(`✅ Reloaded: ${pluginName}`));
            } else {
                console.log(chalk.red('❌ Reload system not available'));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Reload failed: ${error.message}`));
        }
    }

    executeCode(code) {
        if (!code) {
            console.log(chalk.red('❌ Usage: exec <code>'));
            return;
        }

        try {
            const result = eval(code);
            console.log(chalk.green(`✅ Result: ${result}`));
        } catch (error) {
            console.log(chalk.red(`❌ Execution failed: ${error.message}`));
        }
    }

    forceGC() {
        if (global.gc) {
            global.gc();
            console.log(chalk.green('✅ Garbage collection forced'));
        } else {
            console.log(chalk.yellow('⚠️  GC not available - run with --expose-gc'));
        }
    }

    async testSpeed() {
        const start = Date.now();
        
        // اختبار سرعة بسيط
        let test = 0;
        for (let i = 0; i < 1000000; i++) {
            test += i;
        }
        
        const end = Date.now();
        console.log(chalk.green(`✅ Speed test: ${end - start}ms`));
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        return Math.round(usage.heapUsed / 1024 / 1024) + 'MB';
    }

    // دالة مساعدة للسرعة
    quickLog(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
        const colors = { info: chalk.blue, success: chalk.green, error: chalk.red, warning: chalk.yellow };
        
        console.log(colors[type](`${icons[type]} [${timestamp}] ${message}`));
    }
}

export default ConsoleSystem;