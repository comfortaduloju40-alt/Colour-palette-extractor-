require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { extractColors, generatePaletteImage } = require('./colorExtractor');

// Webhook mode — no polling
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Map colour names to emoji
function colorEmoji(name) {
  const map = {
    Red: '🔴', Orange: '🟠', Yellow: '🟡',
    Green: '🟢', Blue: '🔵', Purple: '🟣',
    Pink: '🩷', Cyan: '🩵', Gray: '🩶',
    Black: '⬛', White: '⬜'
  };
  return map[name] || '🎨';
}

// Shared logic to process any image
async function handleImage(chatId, fileId) {
  await bot.sendMessage(chatId, '⏳ Analysing your image, please wait...');

  try {
    // Download image from Telegram
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    // Extract 6 dominant colours
    const colors = await extractColors(imageBuffer, 6);

    // Generate palette swatch image
    const paletteImage = await generatePaletteImage(colors);

    // Send palette image
    await bot.sendPhoto(chatId, paletteImage, {
      caption: '🎨 *Your Colour Palette*',
      parse_mode: 'Markdown'
    });

    // Build colour breakdown text
    let text = '📋 *Colour Breakdown:*\n\n';
    colors.forEach((color, i) => {
      const emoji = colorEmoji(color.name);
      text += `${emoji} *Colour ${i + 1} — ${color.name}*\n`;
      text += `   Hex : \`${color.hex}\`\n`;
      text += `   RGB : \`rgb(${color.r}, ${color.g}, ${color.b})\`\n\n`;
    });
    text += '_Send another photo to extract more colours!_';

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('Processing error:', err.message);
    bot.sendMessage(
      chatId,
      '❌ Something went wrong processing your image.\nPlease try sending it again.'
    );
  }
}

// ─── /start ─────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'there';

  bot.sendMessage(
    chatId,
    `👋 Hello, ${name}!\n\n` +
    `I'm your *Colour Palette Extractor Bot*! 🎨\n\n` +
    `*How it works:*\n` +
    `1️⃣ Send me any photo\n` +
    `2️⃣ I extract the 6 dominant colours\n` +
    `3️⃣ You get a palette image + hex codes!\n\n` +
    `*Commands:*\n` +
    `❓ /help — How to use this bot\n` +
    `ℹ️ /about — About this bot\n\n` +
    `📸 Send me a photo to get started!`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /help ──────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `❓ *How to Use Colour Palette Bot*\n\n` +
    `1. Send any photo or image\n` +
    `2. Wait a few seconds\n` +
    `3. Receive:\n\n` +
    `   🖼️ A *palette image* with colour swatches\n` +
    `   📋 *Hex codes* for each colour\n` +
    `   🎨 *RGB values* for each colour\n` +
    `   🏷️ *Colour names* (Red, Blue, Green etc.)\n\n` +
    `💡 Works best with colourful, vibrant photos!\n\n` +
    `📸 Send me a photo to try it now!`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /about ─────────────────────────────────────────
bot.onText(/\/about/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `ℹ️ *About Colour Palette Extractor Bot*\n\n` +
    `This bot analyses any image and extracts its 6 dominant colours using a colour clustering algorithm (K-Means).\n\n` +
    `*Great for:*\n` +
    `🎨 Designers finding colour themes\n` +
    `🖼️ Artists studying colour combinations\n` +
    `📱 Getting hex codes from real-world photos\n` +
    `💅 Picking brand or UI colours\n\n` +
    `Built with Node.js · Hosted on Railway 🚀`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Handle photo messages ────────────────────────────
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  // Pick highest quality version (last in array)
  const photo = msg.photo[msg.photo.length - 1];
  await handleImage(chatId, photo.file_id);
});

// ─── Handle images sent as documents ─────────────────
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const doc = msg.document;

  if (!doc.mime_type || !doc.mime_type.startsWith('image/')) {
    bot.sendMessage(chatId, '⚠️ Please send a valid image file (JPG, PNG, etc.)');
    return;
  }

  await handleImage(chatId, doc.file_id);
});

// ─── Handle plain text ────────────────────────────────
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  bot.sendMessage(
    chatId,
    '📸 Please send me a *photo* to extract its colour palette!',
    { parse_mode: 'Markdown' }
  );
});

module.exports = { bot };
