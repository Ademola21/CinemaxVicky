// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { User } from './types';
import { setUserState, getUserState, clearUserState } from './utils';

const USERS_PATH = path.join(__dirname, '../data/users.json');

const readUsers = (): User[] => {
    try {
        if (!fs.existsSync(USERS_PATH)) return [];
        const data = fs.readFileSync(USERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
};

export const startUserLookup = (bot: TelegramBot, chatId: number) => {
    setUserState(chatId, { command: 'user_lookup_email' });
    bot.sendMessage(chatId, "Enter the email address of the user you want to look up:");
};

export const handleUserLookupResponse = (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const email = msg.text;
    if (!email) return;

    const users = readUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (foundUser) {
        const userDetails = `*User Found*\n\n` +
                            `*ID:* \`${foundUser.id}\`\n` +
                            `*Name:* ${foundUser.name}\n` +
                            `*Email:* ${foundUser.email}`;
        bot.sendMessage(userId, userDetails, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(userId, `No user found with the email: ${email}`);
    }

    clearUserState(userId);
};
