import TelegramBot from 'node-telegram-bot-api';
import {
    startAddMovieFlow,
    handleAddMovieResponse,
    showMoviesForEditing,
    showMoviesForDeletion,
    handleEditMovieCallback,
    handleDeleteMovieCallback,
    startManualAddFlow,
    startYouTubeAddFlow,
    handleEditMovieResponse,
    handleYouTubeConfirmation
} from './movieManager';
import { showSiteSettingsMenu, handleSiteSettingsCallback, handleSiteUpdateResponse, showLiveTvMenu, handleLiveTvSettingsCallback } from './siteManager';
import { handleAiQuery, startAiChat, suggestNewMovies, endAiChat } from './aiHandler';
import { getUserState } from './utils';
import { UserState } from './types';
import { showCollectionsMenu, handleCollectionCallback } from './collectionManager';
import { startUserLookup, handleUserLookupResponse } from './userManager';
import { showAutomationMenu, handleAutomationCallback, handleAutomationUpdateResponse, showChannelsMenu } from './monitoringManager';
import { startAddActorFlow, handleActorResponse } from './actorManager';

// Main menu handler for the /start command
export const handleStartCommand = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to the Yoruba Cinemax Admin Bot!\n\nTo search for a movie, type my username in any chat followed by your query (e.g., `@YourBotName Anikulapo`).", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎬 Manage Movies", callback_data: "manage_movies" }],
                [{ text: "📚 Manage Collections", callback_data: "manage_collections" }, { text: "🎭 Manage Actors", callback_data: "manage_actors" }],
                [{ text: "👤 Manage Users", callback_data: "manage_users" }, { text: "📺 Live TV Settings", callback_data: "manage_livetv" }],
                [{ text: "🤖 Automation", callback_data: "automation_menu" }, { text: "⚙️ Site Settings", callback_data: "site_settings" }],
                [{ text: "🧠 AI Suggestions", callback_data: "ai_suggest" }, { text: "📊 AI Analytics Chat", callback_data: "ai_analytics" }],
            ]
        }
    });
};

// Router for all callback queries from inline keyboards
export const handleCallbackQuery = (bot: TelegramBot, query: TelegramBot.CallbackQuery, refreshAutomation?: () => void) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const routeAction = (data: string) => {
        // Movie Management
        if (data === 'manage_movies') showMovieMenu(bot, chatId, messageId);
        else if (data === 'add_movie') startAddMovieFlow(bot, chatId, messageId);
        else if (data === 'add_movie_youtube') startYouTubeAddFlow(bot, chatId);
        else if (data === 'add_movie_manual') startManualAddFlow(bot, chatId);
        else if (data === 'edit_movie_select' || data === 'edit_movie_list') showMoviesForEditing(bot, chatId, messageId);
        else if (data.startsWith('edit_movie_')) handleEditMovieCallback(bot, query);
        else if (data === 'delete_movie_select') showMoviesForDeletion(bot, chatId, messageId);
        else if (data.startsWith('delete_movie_')) handleDeleteMovieCallback(bot, query);
        else if (data.startsWith('youtube_movie_')) handleYouTubeConfirmation(bot, query);

        // Collection Management
        else if (data === 'manage_collections') showCollectionsMenu(bot, chatId, messageId);
        else if (data.startsWith('collection_')) handleCollectionCallback(bot, query);
        else if (data === 'collection_create_start') handleCollectionCallback(bot, query);

        // Actor Management
        else if (data === 'manage_actors') showActorMenu(bot, chatId, messageId);
        else if (data === 'add_actor') startAddActorFlow(bot, chatId);

        // Live TV Management
        else if (data === 'manage_livetv') showLiveTvMenu(bot, chatId, messageId);
        else if (data.startsWith('livetv_')) handleLiveTvSettingsCallback(bot, query);

        // Site Settings
        else if (data === 'site_settings') showSiteSettingsMenu(bot, chatId, messageId);
        else if (data.startsWith('sitesettings_')) handleSiteSettingsCallback(bot, query);

        // User Management
        else if (data === 'manage_users') showUserMenu(bot, chatId, messageId);
        else if (data === 'user_lookup') startUserLookup(bot, chatId);

        // Automation
        else if (data === 'automation_menu') showAutomationMenu(bot, chatId, messageId);
        else if (data === 'automation_channels_menu') showChannelsMenu(bot, chatId, messageId);
        else if (data.startsWith('automation_')) handleAutomationCallback(bot, query, refreshAutomation);

        // AI Features
        else if (data === 'ai_analytics') startAiChat(bot, chatId);
        else if (data === 'ai_suggest') suggestNewMovies(bot, chatId);
        else if (data === 'ai_end_chat') endAiChat(bot, chatId, messageId);


        // Navigation
        else if (data === 'main_menu') handleStartCommand(bot, { chat: { id: chatId } } as TelegramBot.Message);
    }

    routeAction(data);
    bot.answerCallbackQuery(query.id);
};

// Handler for general messages, routing them based on user's current state
export const handleMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId) return;

    const userState: UserState | undefined = getUserState(userId);
    if (!userState) return;

    // Route to the appropriate handler based on the command in the user's state
    const { command } = userState;
    if (command.startsWith('add_movie_manual') || command.startsWith('add_movie_youtube')) await handleAddMovieResponse(bot, msg);
    else if (command === 'editing_movie_value') await handleEditMovieResponse(bot, msg);
    else if (command.startsWith('collection_')) await handleCollectionCallback(bot, { message: msg } as TelegramBot.CallbackQuery);
    else if (command.startsWith('actor_')) await handleActorResponse(bot, msg);
    else if (command.startsWith('sitesettings_')) await handleSiteUpdateResponse(bot, msg);
    else if (command === 'user_lookup_email') await handleUserLookupResponse(bot, msg);
    else if (command.startsWith('automation_')) await handleAutomationUpdateResponse(bot, msg);
    else if (command === 'ai_chat') await handleAiQuery(bot, msg);
};


// --- Sub-menus for cleaner routing ---

const showMovieMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    const menuContent = "🎬 Movie Management\n\nUse inline search (`@botname query`) to find movies quickly.";
    const keyboard = {
        inline_keyboard: [
            [{ text: "➕ Add New Movie", callback_data: "add_movie" }],
            [{ text: "✏️ Edit Movie", callback_data: "edit_movie_select" }],
            [{ text: "🗑️ Delete Movie", callback_data: "delete_movie_select" }],
            [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
        ]
    };

    // Always send a new message instead of trying to edit
    bot.sendMessage(chatId, menuContent, { reply_markup: keyboard });
};

const showActorMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    bot.sendMessage(chatId, "🎭 Actor Management\n\nUse this to add or update actor profiles. The AI can help generate bios and find photos.", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Add/Update Actor Profile", callback_data: "add_actor" }],
                [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
};

const showUserMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    bot.sendMessage(chatId, "👤 User Management", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔎 User Lookup", callback_data: "user_lookup" }],
                [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
};

// Handle text messages based on user state
export const handleTextMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const state = getUserState(userId);

    if (!state) return;

    // Collection-related text responses - call collection handler directly
    if (state.command.startsWith('collection_')) {
        // Create a fake callback query without data to trigger text message handling
        const fakeQuery = {
            id: '',
            from: msg.from!,
            message: msg,
            data: undefined
        } as TelegramBot.CallbackQuery;
        await handleCollectionCallback(bot, fakeQuery);
    }
    // Movie-related text responses
    else if (state.command.startsWith('movie_')) {
        await handleAddMovieResponse(bot, msg);
    }
    // Actor-related text responses  
    else if (state.command.startsWith('actor_')) {
        await handleActorResponse(bot, msg);
    }
    // Site settings text responses
    else if (state.command.startsWith('sitesettings_')) {
        handleSiteUpdateResponse(bot, msg);
    }
    // Live TV text responses (also handled by site settings)
    else if (state.command.startsWith('livetv_')) {
        handleSiteUpdateResponse(bot, msg);
    }
    // User lookup text responses
    else if (state.command === 'user_lookup') {
        handleUserLookupResponse(bot, msg);
    }
    // Automation text responses
    else if (state.command.startsWith('automation_')) {
        handleAutomationUpdateResponse(bot, msg);
    }
    // AI chat responses
    else if (state.command === 'ai_chat') {
        await handleAiQuery(bot, msg);
    }
};