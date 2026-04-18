// deno-lint-ignore-file
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const EVENTS_CHANNEL_ID = '1474409280349274397';
const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID') || '1463228311118549124';
const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
      },
    });
  }

  if (!BOT_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Bot token not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const body = await req.json();
    const { action, event, rolePing, createDiscordEvent, discordEventPrivacy } = body;

    if (!action || !event) {
      return new Response(
        JSON.stringify({ error: 'Missing action or event' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const gameEmojis: Record<string, string> = {
      'Among Us': '🚀', 'Шахматы': '♟️', 'Дурак': '🃏', 'Clash Royale': '👑',
      'Brawl Stars': '⭐', 'Minecraft': '⛏️', 'JackBox': '📦', 'Бункер': '🏚️',
      'Шпион': '🕵️', 'Codenames': '🔤', 'Alias': '🗣️', 'Gartic Phone': '🎨', 'Roblox': '🟢',
    };

    const emoji = gameEmojis[event.game] || event.game_emoji || '🎮';
    const statusColors: Record<string, number> = { upcoming: 0x00D4FF, completed: 0x00FF88, cancelled: 0xFF4444, live: 0x00FF00 };
    const statusLabels: Record<string, string> = { upcoming: '📅 Предстоящий', completed: '✅ Завершён', cancelled: '❌ Отменён', live: '🔴 Идёт сейчас' };
    const color = statusColors[event.status] || 0x00D4FF;

    // Content с пингом (только при создании)
    const content = (action === 'create' && rolePing) ? `<@&${rolePing}>` : null;

    const embed: any = {
      title: `${emoji} ${event.title}`,
      description: event.description ? `**📝 Описание:**\n${event.description}` : null,
      color: color,
      thumbnail: { url: event.thumbnail || 'https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png' },
      fields: [
        { name: '🎮 **Игра**', value: `\`${event.game || 'Не указана'}\``, inline: true },
        { name: '🗓️ **Дата**', value: `\`${event.date || 'Не указана'}\``, inline: true },
        { name: '⏰ **Время**', value: `\`${event.time || 'Не указано'}\``, inline: true },
        { name: '👥 **Участники**', value: `\`${(event.registered_players?.length || 0)}/${event.max_players || 10}\``, inline: true },
        { name: '👤 **Ведущий**', value: event.host_name || 'Не указан', inline: true },
        { name: '📊 **Статус**', value: statusLabels[event.status] || '📋 Неизвестно', inline: true },
        { name: '\u200b', value: `🔗 [Зарегистрироваться](https://loolaa.netlify.app/events)\n💬 [Discord сервер](https://discord.gg/lolaamongus)`, inline: false },
      ],
      footer: { text: event.footer || '✨ LOLA Server', icon_url: event.thumbnail || 'https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png' },
      timestamp: new Date().toISOString(),
    };

    const payload = { content, embeds: [embed] };

    if (action === 'create') {
      const res = await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: 'Failed to send', discord_error: err }), {
          status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const msg = await res.json();
      let discordEventId: string | null = null;
      let discordEventError: string | null = null;

      // Создаём Discord scheduled event если флаг установлен
      if (createDiscordEvent && event.date && event.time) {
        try {
          const eventDateTime = new Date(`${event.date}T${event.time}`);

          const discordEventPayload = {
            name: event.title,
            description: event.description || `Игра: ${event.game}`,
            scheduled_start_time: eventDateTime.toISOString(),
            privacy_level: discordEventPrivacy || 2,
            entity_type: 3,
            entity_metadata: {
              location: `На сервере LOLA`,
            },
          };

          const discordEventRes = await fetch(
            `${DISCORD_API}/guilds/${GUILD_ID}/scheduled-events`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(discordEventPayload),
            }
          );

          if (discordEventRes.ok) {
            const discordEvent = await discordEventRes.json();
            discordEventId = discordEvent.id;
            console.log('Discord event created:', discordEventId);
          } else {
            const err = await discordEventRes.text();
            discordEventError = `Failed to create Discord event: ${err}`;
            console.error(discordEventError);
          }
        } catch (e: any) {
          discordEventError = `Error creating Discord event: ${e.message}`;
          console.error(discordEventError);
        }
      }

      const responseBody: any = { success: true, messageId: msg.id, discordEventId };
      if (discordEventError) responseBody.discordEventError = discordEventError;
      return new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (action === 'update') {
      if (!event.discord_message_id) {
        return new Response(JSON.stringify({ error: 'Missing discord_message_id' }), {
          status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const res = await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages/${event.discord_message_id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: 'Failed to update', discord_error: err }), {
          status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (action === 'delete') {
      if (!event.discord_message_id) {
        return new Response(JSON.stringify({ error: 'Missing discord_message_id' }), {
          status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const res = await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages/${event.discord_message_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: 'Failed to delete', discord_error: err }), {
          status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
