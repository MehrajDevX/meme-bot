const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const fetch = require("node-fetch");
const Groq = require("groq-sdk");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const BOT_PERSONA = `You are MemeBot — a chaotic, funny, and lovable Discord bot created by MehrajDevX.
Your vibe: Gen-Z humor, friendly roasts, meme references, internet culture.
Rules:
- Keep replies SHORT (1-3 sentences max)
- Be funny but never actually mean or offensive
- Friendly roast energy — like a best friend clowning on you
- Use casual internet language (lol, bruh, ngl, bestie, no cap, etc.)
- Occasionally reference the meme you just posted
- Never be boring. Never be robotic.
- You were built by MehrajDevX from VibeCoBD 🔥`;

const conversationHistory = new Map();

// ─── Fetch a random meme from meme-api ───────────────────────────────────────
async function fetchMeme() {
  try {
    const res = await fetch("https://meme-api.com/gimme");
    const data = await res.json();
    if (data && data.url && !data.nsfw && !data.spoiler) {
      return { url: data.url, title: data.title, subreddit: data.subreddit };
    }
    return null;
  } catch (err) {
    console.error("Meme fetch error:", err.message);
    return null;
  }
}

// ─── Generate a funny caption for the meme ───────────────────────────────────
async function generateCaption(memeTitle) {
  try {
    const res = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      max_tokens: 100,
      messages: [
        { role: "system", content: BOT_PERSONA },
        {
          role: "user",
          content: `Generate a short funny caption or reaction for this meme titled: "${memeTitle}". Make it hilarious and relatable. 1-2 sentences only.`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || "bruh this meme lives rent free in my head 😂";
  } catch (err) {
    console.error("Caption gen error:", err.message);
    return "ok this one broke me 💀";
  }
}

// ─── Post meme to channel ────────────────────────────────────────────────────
async function postMeme() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return console.error("Channel not found.");

  const meme = await fetchMeme();
  if (!meme) return console.error("No meme fetched.");

  const caption = await generateCaption(meme.title);

  await channel.send({
    content: `${caption}\n\n*(from r/${meme.subreddit})*`,
    files: [meme.url],
  });

  console.log(`[${new Date().toISOString()}] Meme posted: ${meme.title}`);
}

// ─── AI chat reply ───────────────────────────────────────────────────────────
async function generateReply(userId, userMessage) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  const history = conversationHistory.get(userId);
  history.push({ role: "user", content: userMessage });

  // Keep last 10 messages only
  if (history.length > 10) history.splice(0, history.length - 10);

  try {
    const res = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      max_tokens: 150,
      messages: [{ role: "system", content: BOT_PERSONA }, ...history],
    });

    const reply = res.choices[0]?.message?.content?.trim() || "bruh idk what to say lmao 💀";
    history.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("Chat reply error:", err.message);
    return "my brain just buffered, try again bestie 😭";
  }
}

// ─── Bot events ─────────────────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`✅ MemeBot is online as ${client.user.tag}`);

  // Post immediately on startup
  postMeme();

  // Schedule every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    postMeme();
  });
});

client.on("messageCreate", async (message) => {
  // Ignore bots and messages outside the channel
  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  const content = message.content.trim();
  if (!content) return;

  // Typing indicator for that human feel
  await message.channel.sendTyping();

  const reply = await generateReply(message.author.id, content);
  await message.reply(reply);
});

client.login(process.env.DISCORD_TOKEN);
