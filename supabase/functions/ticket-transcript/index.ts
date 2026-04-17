// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
const ARCHIVE_CHANNEL_ID = '1464445321881845976';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  try {
    const body = await req.json();
    const { channelId, channelName } = body;

    if (!BOT_TOKEN || !channelId) {
      return new Response(
        JSON.stringify({ error: 'Missing config' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 1. Fetch messages from the ticket channel
    const messagesRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );

    if (!messagesRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages', status: messagesRes.status }),
        { status: messagesRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const messages = await messagesRes.json();
    messages.reverse(); // oldest first

    // 2. Build transcript
    const embeds = [];
    let currentEmbed = {
      title: `📋 Архив тикета: ${channelName || channelId}`,
      description: `📅 ${new Date().toLocaleString('ru-RU')}\n📊 Всего сообщений: ${messages.length}`,
      color: 0x5865F2,
      fields: [],
      footer: { text: 'LOLA Ticket Archive' },
    };

    for (const msg of messages) {
      const author = msg.author?.username || msg.webhook_id ? 'Webhook' : 'Unknown';
      const content = msg.content?.substring(0, 500) || '[Empty/Attachment]';
      const timestamp = new Date(msg.timestamp).toLocaleString('ru-RU');
      
      currentEmbed.fields.push({
        name: `${author} • ${timestamp}`,
        value: content,
        inline: false,
      });

      // Discord embed limit: 25 fields per embed
      if (currentEmbed.fields.length >= 25) {
        embeds.push({ ...currentEmbed });
        currentEmbed = { title: `${channelName || channelId} (cont.)`, description: '', color: 0x5865F2, fields: [], footer: { text: 'LOLA Ticket Archive' } };
      }
    }

    if (currentEmbed.fields.length > 0) {
      embeds.push(currentEmbed);
    }

    // 3. Send to archive channel
    const sendRes = await fetch(
      `https://discord.com/api/v10/channels/${ARCHIVE_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds }),
      }
    );

    return new Response(
      JSON.stringify({ success: sendRes.ok, sent: embeds.length }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
