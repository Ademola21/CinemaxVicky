import TelegramBot from 'node-telegram-bot-api';
import { handleStartCommand, handleCallbackQuery, handleMessage } from './commands';
import { handleInlineMovieSearch } from './movieManager';
import { clearAllUserStates } from './utils';
import { getWeeklyDigest } from './aiHandler';
import { getAutomationConfig, runAutonomousFinder } from './monitoringManager';

export const runBot = async () => {
    // Gatekeeper to prevent running in unsupported environments.
    const isNodeEnvironment = typeof window === 'undefined';
    if (!isNodeEnvironment) {
        console.log("Skipping Telegram bot launch: Not a Node.js environment.");
        return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.ADMIN_TELEGRAM_USER_ID;
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (!token) {
        console.warn("⚠️ Skipping Telegram bot launch: TELEGRAM_BOT_TOKEN is not set.");
        return;
    }
     if (!youtubeKey) {
        console.warn("⚠️ Skipping Telegram bot launch: YOUTUBE_API_KEY is not set.");
        return;
    }
    if (!adminId) {
        console.warn("⚠️ Warning: ADMIN_TELEGRAM_USER_ID is not defined. The bot will be accessible to anyone.");
    }

    // Fix polling errors by adding better error handling and request options
    const bot = new TelegramBot(token, { 
        polling: {
            interval: 1000,
            autoStart: false, // Start manually after setup
            params: {
                timeout: 10
            }
        }
    });
    clearAllUserStates();

    // --- SCHEDULED TASKS ---
    let autonomousFinderInterval: NodeJS.Timeout | null = null;

    const setupAutomationIntervals = () => {
        if (autonomousFinderInterval) clearInterval(autonomousFinderInterval);
        const config = getAutomationConfig();
        if (config.autonomousFinder.enabled && config.autonomousFinder.checkIntervalMinutes > 0) {
            const intervalMs = config.autonomousFinder.checkIntervalMinutes * 60 * 1000;
            autonomousFinderInterval = setInterval(() => {
                console.log("🤖 Running scheduled task: Autonomous Movie Finder...");
                runAutonomousFinder(bot);
            }, intervalMs);
            console.log(`🤖 Autonomous movie finder scheduled to run every ${config.autonomousFinder.checkIntervalMinutes} minutes.`);
        } else {
            console.log("🤖 Autonomous movie finder is disabled.");
        }
    };

    setupAutomationIntervals();

    // --- SECURITY MIDDLEWARE ---
    const withAdminAuth = (handler: (msg: TelegramBot.Message) => void) => (msg: TelegramBot.Message) => {
        if (adminId && msg.from?.id.toString() !== adminId) {
            bot.sendMessage(msg.chat.id, "⛔ Sorry, you are not authorized to use this bot.");
            return;
        }
        handler(msg);
    };

    const withAdminAuthCallback = (handler: (query: TelegramBot.CallbackQuery) => void) => (query: TelegramBot.CallbackQuery) => {
        if (adminId && query.from?.id.toString() !== adminId) {
            bot.answerCallbackQuery(query.id, { text: "⛔ You are not authorized." });
            return;
        }
        handler(query);
    };
    
    const withAdminAuthInline = (handler: (query: TelegramBot.InlineQuery) => void) => (query: TelegramBot.InlineQuery) => {
        if (adminId && query.from?.id.toString() !== adminId) {
             bot.answerInlineQuery(query.id, []);
             return;
        }
        handler(query);
    };


    // --- ROUTING ---
    bot.onText(/\/start/, withAdminAuth((msg) => handleStartCommand(bot, msg)));
    bot.on('callback_query', withAdminAuthCallback((query) => handleCallbackQuery(bot, query, setupAutomationIntervals)));
    bot.on('inline_query', withAdminAuthInline((query) => handleInlineMovieSearch(bot, query)));
    bot.on('message', withAdminAuth((msg) => {
        // We ignore commands and messages sent via the bot's inline mode to prevent the message handler from double-firing.
        // The `via_bot` property may not be in the type definitions, so we cast to `any` as a pragmatic workaround.
        if (msg.text && (msg.text.startsWith('/') || (msg as any).via_bot)) return;
        handleMessage(bot, msg);
    }));
    bot.on('photo', withAdminAuth((msg) => handleMessage(bot, msg)));
    
    // Add error handling for polling issues
    bot.on('polling_error', (error: any) => {
        console.error('Bot polling error:', error.code, error.message);
        
        // Handle unescaped characters error specifically
        if (error.code === 'EFATAL' && error.message.includes('unescaped characters')) {
            console.error('❌ Bot token or API URL contains invalid characters. Please check your TELEGRAM_BOT_TOKEN.');
            return; // Don't restart on this error
        }
        
        // Don't crash the bot on other polling errors
        if (error.code === 'EFATAL') {
            console.log('Attempting to restart polling...');
            setTimeout(() => {
                try {
                    bot.stopPolling().then(() => bot.startPolling());
                } catch (e) {
                    console.error('Failed to restart polling:', e);
                }
            }, 5000);
        }
    });

    // Add global error handler for unhandled rejections
    process.on('unhandledRejection', (reason: any) => {
        // Ignore harmless Telegram message editing errors
        if (reason?.message?.includes('message is not modified')) {
            return; // Silently ignore these common errors
        }
        console.error('Unhandled rejection:', reason);
    });

    // Start polling manually with better error handling
    try {
        await bot.startPolling();
        console.log("✅ Telegram Bot is running!");
    } catch (error: any) {
        console.error('❌ Failed to start bot polling:', error.message);
        if (error.message.includes('unescaped characters')) {
            console.error('This error usually means your TELEGRAM_BOT_TOKEN contains invalid characters.');
            console.error('Please check that your token is correctly set in the Secrets tab.');
        }
        return;
    }
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log("SIGINT received. Shutting down bot polling...");
        if(autonomousFinderInterval) clearInterval(autonomousFinderInterval);
        bot.stopPolling().then(() => {
            console.log("Bot polling stopped.");
            process.exit(0);
        });
    });
    process.on('SIGTERM', () => {
        console.log("SIGTERM received. Shutting down bot polling...");
        if(autonomousFinderInterval) clearInterval(autonomousFinderInterval);
        bot.stopPolling().then(() => {
            console.log("Bot polling stopped.");
            process.exit(0);
        });
    });
};