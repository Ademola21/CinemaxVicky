// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { Collection, Movie } from './types';
import { setUserState, getUserState, clearUserState, atomicWrite } from './utils';

const COLLECTIONS_PATH = path.join(__dirname, '../data/collections.json');
const MOVIES_PATH = path.join(__dirname, '../data/movies.json');

const readCollections = (): Collection[] => {
    try {
        const data = fs.readFileSync(COLLECTIONS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};
const writeCollections = (collections: Collection[]) => atomicWrite(COLLECTIONS_PATH, JSON.stringify(collections, null, 2));

const readMovies = (): Movie[] => {
    try {
        const data = fs.readFileSync(MOVIES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};


// --- MAIN MENU ---
export const showCollectionsMenu = (bot: TelegramBot, chatId: number, messageId: number) => {
    bot.sendMessage(chatId, "📚 *Collections Management*", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Create Collection", callback_data: "collection_create_start" }],
                [{ text: "✏️ Edit Collection", callback_data: "collection_edit_select" }],
                [{ text: "🗑️ Delete Collection", callback_data: "collection_delete_select" }],
                [{ text: "⬅️ Back to Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
};

// --- EDIT COLLECTION FLOW ---

const showCollectionsForEditing = (bot: TelegramBot, chatId: number, messageId: number) => {
    const collections = readCollections();
    if (collections.length === 0) {
        bot.sendMessage(chatId, "There are no collections to edit.", {
            reply_markup: {
                inline_keyboard: [[{ text: "⬅️ Back", callback_data: "manage_collections" }]]
            }
        });
        return;
    }

    const keyboard = collections.map(c => ([{ text: c.title, callback_data: `collection_edit_start_${c.id}` }]));
    keyboard.push([{ text: "⬅️ Back", callback_data: "manage_collections" }]);

    bot.sendMessage(chatId, "✏️ Select a collection to edit:", {
        reply_markup: { inline_keyboard: keyboard }
    });
};

const displayCollectionEditMenu = (bot: TelegramBot, chatId: number, messageId: number, collectionId: string) => {
    const collections = readCollections();
    const collection = collections.find(c => c.id === collectionId);

    if (!collection) {
        bot.sendMessage(chatId, "Error: Collection not found.");
        return;
    }

    const text = `*Editing: ${collection.title}*\n\n` +
                 `*Description:* ${collection.description}\n` +
                 `*Movies:* \`${collection.movieIds.join(', ')}\`\n\n` +
                 `Select a field to edit:`;

    bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✏️ Edit Title", callback_data: `collection_edit_field_title_${collection.id}` }],
                [{ text: "✏️ Edit Description", callback_data: `collection_edit_field_description_${collection.id}` }],
                [{ text: "🎬 Edit Movies", callback_data: `collection_edit_field_movieIds_${collection.id}` }],
                [{ text: "⬅️ Back to List", callback_data: "collection_edit_select" }]
            ]
        }
    });
};

const promptForCollectionEdit = (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const userId = query.from.id;
    const chatId = query.message!.chat.id;
    const parts = query.data!.split('_');
    const field = parts[3];
    const collectionId = parts.slice(4).join('_');

    setUserState(userId, {
        command: 'collection_edit_value',
        collectionId: collectionId,
        field: field,
    });

    let promptText = `Please enter the new *${field}*.`;
    if (field === 'movieIds') {
        promptText = `Please enter the new movie IDs, separated by commas.`;
    }

    bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
};


// --- CALLBACK ROUTER ---
export const handleCollectionCallback = async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    // This now handles both callback queries and text message responses via state.
    const isCallback = !!query.data;
    const msg = query.message!;
    const userId = msg.from!.id;
    const state = getUserState(userId);
    const data = isCallback ? query.data : state?.command;

    // --- Creation Flow ---
    if (data === 'collection_create_start') {
        setUserState(userId, { command: 'collection_create_title', collectionData: {} });
        bot.sendMessage(msg.chat.id, "Enter the title for the new collection:");
    } else if (state?.command === 'collection_create_title' && !isCallback && msg.text) {
        state.collectionData.title = msg.text;
        state.command = 'collection_create_desc';
        setUserState(userId, state);
        bot.sendMessage(msg.chat.id, "Great. Now enter a short description for it:");
    } else if (state?.command === 'collection_create_desc' && !isCallback && msg.text) {
        state.collectionData.description = msg.text;
        state.command = 'collection_create_movies';
        setUserState(userId, state);
        bot.sendMessage(msg.chat.id, "Finally, provide the movie IDs to include, separated by commas (e.g., jagun-jagun,anikalupo):");
    } else if (state?.command === 'collection_create_movies' && !isCallback && msg.text) {
        const movieIds = msg.text.split(',').map(id => id.trim());
        const collections = readCollections();
        const newCollection: Collection = {
            id: state.collectionData.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            title: state.collectionData.title,
            description: state.collectionData.description,
            movieIds,
        };
        writeCollections([...collections, newCollection]);
        bot.sendMessage(msg.chat.id, `✅ Collection "${newCollection.title}" created successfully!`);
        clearUserState(userId);
    }
    
    // --- Edit Flow ---
    else if (data === 'collection_edit_select') {
        showCollectionsForEditing(bot, msg.chat.id, msg.message_id);
    } else if (data && data.startsWith('collection_edit_start_')) {
        const collectionId = data.replace('collection_edit_start_', '');
        displayCollectionEditMenu(bot, msg.chat.id, msg.message_id, collectionId);
    } else if (data && data.startsWith('collection_edit_field_')) {
        promptForCollectionEdit(bot, query);
    } else if (state?.command === 'collection_edit_value') {
        const { collectionId, field } = state;
        let newValue: any = msg.text!;
        
        if (field === 'movieIds') {
            newValue = newValue.split(',').map((id: string) => id.trim());
        }

        const collections = readCollections();
        const collectionIndex = collections.findIndex(c => c.id === collectionId);

        if (collectionIndex > -1) {
            (collections[collectionIndex] as any)[field] = newValue;
            writeCollections(collections);
            bot.sendMessage(msg.chat.id, `✅ Field *${field}* updated successfully!`, { parse_mode: 'Markdown' });
            clearUserState(userId);
            // After update, show the menu again with fresh data
            displayCollectionEditMenu(bot, msg.chat.id, 0, collectionId);
        } else {
            bot.sendMessage(msg.chat.id, "Error: Could not find collection to update.");
            clearUserState(userId);
        }
    }
    
    // --- Delete Flow ---
    else if (data === 'collection_delete_select') {
        const collections = readCollections();
        if (collections.length === 0) {
            bot.sendMessage(msg.chat.id, "There are no collections to delete.", {
                reply_markup: {
                    inline_keyboard: [[{ text: "⬅️ Back", callback_data: "manage_collections" }]]
                }
            });
        } else {
             bot.sendMessage(msg.chat.id, "🗑️ Select a collection to delete:", {
                reply_markup: {
                    inline_keyboard: collections.map(c => ([{ text: c.title, callback_data: `collection_delete_exec_${c.id}` }]))
                }
            });
        }
    } else if (data && data.startsWith('collection_delete_exec_')) {
        const collectionId = data.replace('collection_delete_exec_', '');
        const updatedCollections = readCollections().filter(c => c.id !== collectionId);
        writeCollections(updatedCollections);
        bot.answerCallbackQuery(query.id, { text: "Collection deleted!" });
        showCollectionsMenu(bot, msg.chat.id, 0);
    }

    if(isCallback && query.id) bot.answerCallbackQuery(query.id);
};
