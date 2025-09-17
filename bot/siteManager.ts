// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { SiteConfig, Movie } from './types';
import { setUserState, getUserState, clearUserState, atomicWrite } from './utils';

const CONFIG_PATH = path.join(process.cwd(), 'data/siteConfig.json');
const ANNOUNCEMENT_PATH = path.join(process.cwd(), 'data/announcement.json');
const MOVIES_PATH = path.join(process.cwd(), 'data/movies.json');

const readConfig = (): SiteConfig => {
    try {
        console.log('🔍 Trying to read site config from:', CONFIG_PATH);
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log('❌ Site config file does not exist at:', CONFIG_PATH);
        }
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(data);
        console.log('✅ Successfully read site config');
        return config;
    } catch (error) {
        console.error("❌ Error reading siteConfig.json:", error);
        console.error('   File path:', CONFIG_PATH);
        console.error('   Working directory:', process.cwd());
        return { name: "Yoruba Cinemax", tagline: "Nigeria's Premier Yoruba Movie Destination", liveTvEnabled: false, liveTvUrl: "", copyrightYear: "2024", contact: { email: "", phone: "", address: ""}, socials: [] };
    }
};
const writeConfig = (config: SiteConfig) => atomicWrite(CONFIG_PATH, JSON.stringify(config, null, 2));

const readMovies = (): Movie[] => {
    try {
        const data = fs.readFileSync(MOVIES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) { return []; }
};

// --- SITE SETTINGS MENU ---
export const showSiteSettingsMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    const config = readConfig();
    const featuredMovie = readMovies().find(m => m.id === config.featuredMovieId);

    bot.editMessageText(
        `⚙️ *Site Settings*\n\n` +
        `*Name:* ${config.name}\n` +
        `*Tagline:* ${config.tagline}\n` +
        `*Copyright:* © ${config.copyrightYear} ${config.name}\n`+
        `*Featured Movie:* ${featuredMovie ? featuredMovie.title : 'None set'}`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✏️ Edit Name", callback_data: "sitesettings_edit_name" }, { text: "✏️ Edit Tagline", callback_data: "sitesettings_edit_tagline" }],
                    [{ text: "✏️ Edit Copyright", callback_data: "sitesettings_edit_copyright" }],
                    [{ text: "📞 Edit Contact Info", callback_data: "sitesettings_contact_menu" }, { text: "🌐 Edit Social Links", callback_data: "sitesettings_socials_menu" }],
                    [{ text: "🌟 Set Featured Movie", callback_data: "sitesettings_set_featured" }, { text: "📢 Broadcast Message", callback_data: "sitesettings_broadcast" }],
                    [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
                ]
            }
        }
    );
};

// --- LIVE TV MENU ---
export const showLiveTvMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    const config = readConfig();
    const status = config.liveTvEnabled ? '🟢 ON' : '🔴 OFF';
    const url = config.liveTvUrl || 'Not set';

    bot.editMessageText(
        `📺 *Live TV Settings*\n\n*Status:* ${status}\n*Stream URL:* \`${url}\``,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Toggle ${config.liveTvEnabled ? 'OFF' : 'ON'}`, callback_data: "livetv_toggle" }],
                    [{ text: "✏️ Set Stream URL", callback_data: "livetv_set_url" }],
                    [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
                ]
            }
        }
    );
};

// --- CALLBACK HANDLERS ---
export const handleSiteSettingsCallback = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;
    if (!chatId || !data || !messageId) return;

    const userId = query.from.id;
    const config = readConfig();

    const handlers: { [key: string]: () => void } = {
        'sitesettings_edit_name': () => {
            setUserState(userId, { command: 'sitesettings_update_name' });
            bot.sendMessage(chatId, "Please enter the new site name:");
        },
        'sitesettings_edit_tagline': () => {
            setUserState(userId, { command: 'sitesettings_update_tagline' });
            bot.sendMessage(chatId, "Please enter the new site tagline:");
        },
        'sitesettings_edit_copyright': () => {
            setUserState(userId, { command: 'sitesettings_update_copyright' });
            bot.sendMessage(chatId, "Please enter the new copyright year (e.g., 2025):");
        },
        'sitesettings_broadcast': () => {
            setUserState(userId, { command: 'sitesettings_update_broadcast' });
            bot.sendMessage(chatId, "Enter the announcement message to broadcast on the site. To deactivate, send 'clear'.");
        },
        'sitesettings_contact_menu': () => {
             bot.editMessageText(`📞 *Edit Contact Info*\n\n*Email:* ${config.contact.email}\n*Phone:* ${config.contact.phone}\n*Address:* ${config.contact.address}`, {
                chat_id: chatId, message_id: messageId, parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✏️ Edit Email", callback_data: "sitesettings_contact_email" }],
                        [{ text: "✏️ Edit Phone", callback_data: "sitesettings_contact_phone" }],
                        [{ text: "✏️ Edit Address", callback_data: "sitesettings_contact_address" }],
                        [{ text: "⬅️ Back", callback_data: "site_settings" }]
                    ]
                }
            });
        },
        'sitesettings_contact_email': () => {
            setUserState(userId, { command: 'sitesettings_update_contact_email' });
            bot.sendMessage(chatId, "Enter the new contact email address:");
        },
        'sitesettings_contact_phone': () => {
            setUserState(userId, { command: 'sitesettings_update_contact_phone' });
            bot.sendMessage(chatId, "Enter the new contact phone number:");
        },
        'sitesettings_contact_address': () => {
            setUserState(userId, { command: 'sitesettings_update_contact_address' });
            bot.sendMessage(chatId, "Enter the new contact address:");
        },
        'sitesettings_socials_menu': () => {
            const keyboard = (config.socials || []).map(s => ([{ text: `✏️ Edit ${s.platform}`, callback_data: `sitesettings_social_${s.platform.toLowerCase()}` }]));
            keyboard.push([{ text: "⬅️ Back", callback_data: "site_settings" }]);
            bot.editMessageText("🌐 Select a social media platform to update its URL:", {
                chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard }
            });
        },
        'sitesettings_set_featured': () => {
            const movies = readMovies();
            if (movies.length === 0) {
                bot.answerCallbackQuery(query.id, { text: "No movies available to feature." });
                return;
            }
            const keyboard = movies.map(m => ([{ text: m.title, callback_data: `sitesettings_feature_${m.id}` }]));
            keyboard.push([{ text: "Clear Featured Movie", callback_data: "sitesettings_feature_clear" }]);
            bot.editMessageText("Select a movie to feature on the homepage:", {
                chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard }
            });
        },
    };
    
    if (handlers[data]) {
        handlers[data]();
    } else if (data.startsWith('sitesettings_social_')) {
        const platform = data.replace('sitesettings_social_', '');
        setUserState(userId, { command: `sitesettings_update_social_${platform}`, platform });
        bot.sendMessage(chatId, `Enter the new full URL for ${platform.charAt(0).toUpperCase() + platform.slice(1)} (send 'remove' to hide it):`);
    } else if (data.startsWith('sitesettings_feature_')) {
        const movieId = data.replace('sitesettings_feature_', '');
        config.featuredMovieId = movieId === 'clear' ? null : movieId;
        writeConfig(config);
        const movie = readMovies().find(m => m.id === movieId);
        const message = movieId === 'clear' ? "Featured movie has been cleared." : `"${movie?.title}" is now the featured movie.`;
        bot.answerCallbackQuery(query.id, { text: `✅ ${message}` });
        showSiteSettingsMenu(bot, chatId, messageId);
        return; // Early return to avoid double-answering
    }

    bot.answerCallbackQuery(query.id);
};

export const handleLiveTvSettingsCallback = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;
    if (!chatId || !data || !messageId) return;

    const userId = query.from.id;
    const config = readConfig();

    if (data === 'livetv_toggle') {
        config.liveTvEnabled = !config.liveTvEnabled;
        writeConfig(config);
        bot.answerCallbackQuery(query.id, { text: `Live TV is now ${config.liveTvEnabled ? 'ON' : 'OFF'}` });
        showLiveTvMenu(bot, chatId, messageId);
    } else if (data === 'livetv_set_url') {
        setUserState(userId, { command: 'sitesettings_update_livetv_url' });
        bot.sendMessage(chatId, "Please enter the new Live TV stream URL (must be a valid M3U8 link):");
    }

    if(data !== 'livetv_set_url') bot.answerCallbackQuery(query.id);
};


// --- MESSAGE HANDLER ---
export const handleSiteUpdateResponse = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    const text = msg.text;
    if (!userId || !text) return;

    const state = getUserState(userId);
    if (!state || !state.command.startsWith('sitesettings_update_')) return;

    const config = readConfig();
    let success = true;

    if (state.command === 'sitesettings_update_name') {
        config.name = text;
        bot.sendMessage(userId, `✅ Success! Site name updated to "${text}".`);
    } else if (state.command === 'sitesettings_update_tagline') {
        config.tagline = text;
        bot.sendMessage(userId, `✅ Success! Site tagline has been updated.`);
    } else if (state.command === 'sitesettings_update_copyright') {
        config.copyrightYear = text;
        bot.sendMessage(userId, `✅ Success! Copyright year updated to "${text}".`);
    } else if (state.command === 'sitesettings_update_contact_email') {
        config.contact.email = text;
        bot.sendMessage(userId, `✅ Success! Contact email updated.`);
    } else if (state.command === 'sitesettings_update_contact_phone') {
        config.contact.phone = text;
        bot.sendMessage(userId, `✅ Success! Contact phone updated.`);
    } else if (state.command === 'sitesettings_update_contact_address') {
        config.contact.address = text;
        bot.sendMessage(userId, `✅ Success! Contact address updated.`);
    } else if (state.command.startsWith('sitesettings_update_social_')) {
        const platform = state.platform;
        const socialIndex = config.socials.findIndex(s => s.platform.toLowerCase() === platform);
        if (socialIndex !== -1) {
            if (text.toLowerCase() === 'remove') {
                config.socials[socialIndex].url = '#';
                 bot.sendMessage(userId, `✅ Success! ${platform} link has been removed.`);
            } else {
                 config.socials[socialIndex].url = text;
                 bot.sendMessage(userId, `✅ Success! ${platform} link has been updated.`);
            }
        }
    } else if (state.command === 'sitesettings_update_broadcast') {
        const isClear = text.toLowerCase() === 'clear';
        const announcement = { message: isClear ? "" : text, active: !isClear };
        atomicWrite(ANNOUNCEMENT_PATH, JSON.stringify(announcement, null, 2));
        bot.sendMessage(userId, `✅ Success! ${isClear ? "Broadcast message cleared." : "Broadcast message is now active."}`);
    } else if (state.command === 'sitesettings_update_livetv_url') {
        if (text.startsWith('http') && text.endsWith('.m3u8')) {
            config.liveTvUrl = text;
            bot.sendMessage(userId, `✅ Success! Live TV stream URL has been updated.`);
        } else {
            success = false;
            bot.sendMessage(userId, `❌ Invalid URL. The URL must be a valid link ending in .m3u8`);
        }
    }

    if (success) {
        writeConfig(config);
    }
    clearUserState(userId);
};
