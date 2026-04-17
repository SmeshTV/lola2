// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = '1463228311118549124';

// Категория для тикетов (замени на ID категории тикетов)
const TICKET_CATEGORY_ID = '1464445658638323935'; // или создай отдельную категорию

// Роли модераторов (имеют доступ к тикетам)
const STAFF_ROLES = [
  '1463230825041756302', // Lola
  '1463271031501357067', // Main Moderator
  '1464965472704266414', // Grand Mod
  '1478351837835825235', // Admin
  '1466565907857014825', // Tech Admin
  '1464964592575709309', // Mod
  '1464787504183115816', // Helper
];

// Биты разрешений
const VIEW_CHANNEL = '1024';
const SEND_MESSAGES = '2048';
const READ_MESSAGE_HISTORY = '65536';

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
    const { action, userId, subject, description, ticketChannelId } = body;

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: 'Bot token not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const headers = {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    };

    if (action === 'open') {
      // Создаём канал-тикет
      const channelName = `ticket-${userId}`;

      // Permission overwrites
      const permissionOverwrites = [
        // @everyone - нет доступа
        {
          id: GUILD_ID,
          type: 0,
          deny: VIEW_CHANNEL,
          allow: '0',
        },
        // Пользователь - полный доступ
        {
          id: userId,
          type: 1,
          allow: (parseInt(VIEW_CHANNEL) | parseInt(SEND_MESSAGES) | parseInt(READ_MESSAGE_HISTORY)).toString(),
          deny: '0',
        },
        // Модераторы - полный доступ
        ...STAFF_ROLES.map(roleId => ({
          id: roleId,
          type: 0,
          allow: (parseInt(VIEW_CHANNEL) | parseInt(SEND_MESSAGES) | parseInt(READ_MESSAGE_HISTORY)).toString(),
          deny: '0',
        })),
      ];

      const response = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: channelName,
          type: 0, // text channel
          parent_id: TICKET_CATEGORY_ID,
          permission_overwrites: permissionOverwrites,
          reason: `Ticket opened by website: ${subject}`,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Discord API error:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to create channel', detail: err, status: response.status }),
          { status: response.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const channel = await response.json();

      // Создаём вебхук для отправки сообщений от имени пользователей
      const webhookRes = await fetch(`${DISCORD_API}/channels/${channel.id}/webhooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'LOLA Ticket Bot',
        }),
      });

      let webhookUrl = '';
      if (webhookRes.ok) {
        const webhook = await webhookRes.json();
        webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
      }

      // Отправляем приветственное сообщение БЕЗ кнопок (кнопка закрытия на сайте)
      await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          embeds: [{
            title: '🎫 Тикет создан',
            description: description,
            color: 0x00FF87,
            fields: [
              { name: 'Тема', value: subject, inline: true },
              { name: 'Пользователь', value: `<@${userId}>`, inline: true },
              { name: 'Управление', value: '🔒 Закрыть тикет можно на сайте LOLA', inline: false },
            ],
            footer: { text: 'Создано через сайт LOLA' },
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      // Пингуем модераторов
      await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: `<@&1464964592575709309> Новый тикет создан!`,
        }),
      });

      return new Response(
        JSON.stringify({
          success: true,
          channelId: channel.id,
          channelUrl: `https://discord.com/channels/${GUILD_ID}/${channel.id}`,
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );

    } else if (action === 'close') {
      // Закрываем канал
      if (!ticketChannelId) {
        return new Response(
          JSON.stringify({ error: 'Missing ticketChannelId' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const response = await fetch(`${DISCORD_API}/channels/${ticketChannelId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const err = await response.text();
        return new Response(
          JSON.stringify({ error: 'Failed to close ticket', detail: err }),
          { status: response.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
