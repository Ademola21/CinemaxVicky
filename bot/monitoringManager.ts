// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { Movie } from './types';
import { atomicWrite, setUserState, getUserState, clearUserState } from './utils';
import { processNextBatchForChannel } from './movieManager';


const CONFIG_PATH = path.join(__dirname, './monitoringConfig.json');

interface AutomationConfig {
    autonomousFinder: {
        enabled: boolean;
        checkIntervalMinutes: number;
        channelUrls: string[];
    };
}

const defaultConfig: AutomationConfig = {
    autonomousFinder: { enabled: true, checkIntervalMinutes: 60, channelUrls: [] },
};

export const getAutomationConfig = (): AutomationConfig => {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const savedConfig = JSON.parse(data);
        return { ...defaultConfig, ...savedConfig };
    } catch {
        return defaultConfig;
    }
};

const writeConfig = (config: AutomationConfig) => atomicWrite(CONFIG_PATH, JSON.stringify(config, null, 2));


// --- AUTONOMOUS MOVIE FINDER (NEW FEATURE) ---
export const runAutonomousFinder = async (bot: TelegramBot) => {
    const config = getAutomationConfig();
    if (!config.autonomousFinder.enabled || config.autonomousFinder.channelUrls.length === 0) return;
    
    const adminId = process.env.ADMIN_TELEGRAM_USER_ID;
    if (!adminId) return;

    console.log("Autonomous Finder: Starting scheduled run...");
    
    // Process one channel per run to distribute API usage
    // A more advanced implementation might rotate channels
    const channelToProcess = config.autonomousFinder.channelUrls[0];
    await processNextBatchForChannel(channelToProcess, bot);
};

// --- UI and State Management ---
export const showAutomationMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    const config = getAutomationConfig();
    const finderStatus = config.autonomousFinder.enabled ? '🟢 ON' : '🔴 OFF';

    const text = `*🤖 Automation Settings*\n\n` +
                 `*Autonomous Channel Processor:*\n` +
                 `  - Status: *${finderStatus}*\n` +
                 `  - Interval: *${config.autonomousFinder.checkIntervalMinutes} minutes*\n` +
                 `  - Channels: *${config.autonomousFinder.channelUrls.length} configured*`;
    
    bot.editMessageText(text, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "▶️ Process Channels Now", callback_data: 'automation_finder_run' }],
                [{ text: `Toggle Finder ${config.autonomousFinder.enabled ? 'OFF' : 'ON'}`, callback_data: 'automation_finder_toggle' }, { text: "⏰ Set Finder Interval", callback_data: 'automation_finder_interval' }],
                [{ text: "📺 Configure Channels", callback_data: 'automation_channels_menu'}],
                [{ text: "⬅️ Back", callback_data: "main_menu" }]
            ]
        }
    });
};

export const showChannelsMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    const config = getAutomationConfig();
    const channels = config.autonomousFinder.channelUrls;
    let text = "*📺 Monitored Channels*\n\n";

    if (channels.length === 0) {
        text += "_No channels configured yet._";
    } else {
        channels.forEach((url, i) => {
            text += `${i + 1}. \`${url}\`\n`;
        });
    }

    bot.editMessageText(text, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Add Channel", callback_data: 'automation_channel_add' }, { text: "🗑️ Remove Channel", callback_data: 'automation_channel_remove_select' }],
                [{ text: "⬅️ Back", callback_data: "automation_menu" }]
            ]
        }
    });
};

export const handleAutomationCallback = (bot: TelegramBot, query: TelegramBot.CallbackQuery, refreshAutomation?: () => void) => {
    const msg = query.message!;
    const data = query.data!;
    const userId = query.from.id;
    const config = getAutomationConfig();

    if (data === 'automation_finder_run') {
        bot.answerCallbackQuery(query.id, { text: "Starting manual channel processing..." });
        runAutonomousFinder(bot);
        return;
    } else if (data === 'automation_finder_toggle') {
        config.autonomousFinder.enabled = !config.autonomousFinder.enabled;
    } else if (data === 'automation_finder_interval') {
        setUserState(userId, { command: 'automation_update_finder_interval' });
        bot.sendMessage(msg.chat.id, "Enter the new search interval in minutes (e.g., 60):");
    } else if (data === 'automation_channel_add') {
        setUserState(userId, { command: 'automation_add_channel_url' });
        bot.sendMessage(msg.chat.id, "Please send the full YouTube channel URL to add for monitoring.");
    } else if (data === 'automation_channel_remove_select') {
        const channels = config.autonomousFinder.channelUrls;
        if (channels.length === 0) {
             bot.answerCallbackQuery(query.id, { text: "No channels to remove." });
             return;
        }
        const keyboard = channels.map((url, index) => ([{text: `❌ ${url.split('/').pop()}`, callback_data: `automation_channel_remove_exec_${index}`}]));
        keyboard.push([{ text: "⬅️ Back", callback_data: 'automation_channels_menu' }]);
        bot.editMessageText("Select a channel to remove:", {
            chat_id: msg.chat.id, message_id: msg.message_id, reply_markup: { inline_keyboard: keyboard }
        });
        bot.answerCallbackQuery(query.id);
        return; // Avoid redrawing menu
    } else if (data.startsWith('automation_channel_remove_exec_')) {
        const index = parseInt(data.split('_').pop()!, 10);
        config.autonomousFinder.channelUrls.splice(index, 1);
        showChannelsMenu(bot, msg.chat.id, msg.message_id);
    }
    
    writeConfig(config);
    if (refreshAutomation) refreshAutomation();

    if (!data.startsWith('automation_channel_remove')) {
        showAutomationMenu(bot, msg.chat.id, msg.message_id);
    }
    bot.answerCallbackQuery(query.id);
};

export const handleAutomationUpdateResponse = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const text = msg.text!;
    const state = getUserState(userId);
    const config = getAutomationConfig();
    let changed = false;

    if (state?.command === 'automation_add_channel_url') {
        if (text.includes('youtube.com/')) {
            config.autonomousFinder.channelUrls.push(text);
            bot.sendMessage(userId, `✅ Channel added! The bot will start processing its videos on the next run.`);
            changed = true;
        } else {
             bot.sendMessage(userId, `❌ That does not look like a valid YouTube channel URL.`);
        }
    } else {
        const interval = parseInt(text, 10);
        if (isNaN(interval) || interval <= 0) {
            bot.sendMessage(userId, `❌ Invalid number.`);
            clearUserState(userId);
            return;
        }

        if (state?.command === 'automation_update_finder_interval') {
            config.autonomousFinder.checkIntervalMinutes = interval;
            bot.sendMessage(userId, `✅ Autonomous Finder interval set to ${interval} minutes.`);
            changed = true;
        }
    }

    if (changed) {
        writeConfig(config);
    }
    clearUserState(userId);
};
