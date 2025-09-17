// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { Actor } from './types';
import { setUserState, getUserState, clearUserState, atomicWrite } from './utils';
import { generateActorProfile } from './aiHandler';

const ACTORS_PATH = path.join(__dirname, '../data/actors.json');

const readActors = (): Actor[] => {
    try {
        if (!fs.existsSync(ACTORS_PATH)) return [];
        const data = fs.readFileSync(ACTORS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};

const writeActors = (actors: Actor[]) => atomicWrite(ACTORS_PATH, JSON.stringify(actors, null, 2));

export const startAddActorFlow = (bot: TelegramBot, chatId: number) => {
    setUserState(chatId, { command: 'actor_get_name' });
    bot.sendMessage(chatId, "Enter the full name of the actor to add or update:");
};

export const handleActorResponse = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const text = msg.text;
    const state = getUserState(userId);
    if (!state || !text) return;

    if (state.command === 'actor_get_name') {
        const actorName = text.trim();
        bot.sendMessage(userId, `🔎 Searching for details for "${actorName}"...`);
        await bot.sendChatAction(userId, 'typing');
        
        const profile = await generateActorProfile(actorName);

        if (!profile || !profile.bio) {
            bot.sendMessage(userId, `Could not find enough information for "${actorName}". Please try a different name or check the spelling.`);
            clearUserState(userId);
            return;
        }

        state.actorData = { name: actorName, bio: profile.bio, imageUrl: profile.imageUrl || 'https://picsum.photos/seed/actor/300/300' };
        setUserState(userId, state);
        
        const confirmationMessage = `*AI Generated Profile for ${actorName}:*\n\n` +
                                  `*Bio:* ${profile.bio}\n\n` +
                                  `*Image URL:* ${profile.imageUrl || 'Not found, using placeholder.'}\n\n` +
                                  `Type 'yes' to save this profile. Type anything else to cancel.`;

        bot.sendMessage(userId, confirmationMessage, {
            parse_mode: 'Markdown',
            // Disable web page preview for the image URL to keep the message clean
            disable_web_page_preview: true 
        });
        state.command = 'actor_confirm_save';
        setUserState(userId, state);

    } else if (state.command === 'actor_confirm_save') {
        if (text.toLowerCase() === 'yes') {
            const actors = readActors();
            const existingIndex = actors.findIndex(a => a.name.toLowerCase() === state.actorData.name.toLowerCase());

            if (existingIndex > -1) {
                actors[existingIndex] = state.actorData;
            } else {
                actors.push(state.actorData);
            }

            writeActors(actors);
            bot.sendMessage(userId, `✅ Actor profile for "${state.actorData.name}" has been saved!`);
        } else {
            bot.sendMessage(userId, "Operation cancelled.");
        }
        clearUserState(userId);
    }
};
