import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Users, MessageSquare, Send, Ban,
  BarChart3, Gamepad2, ShoppingBag, Loader2,
  CheckCircle, XCircle, Ticket, ChevronRight, Reply,
  Calendar, FileText, Edit, Trash2, Save, X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { getCached, setCached } from '../lib/cache';

// Discord Markdown → HTML конвертер
const renderDiscordMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/30 rounded px-2 py-1 text-sm font-mono my-1">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 rounded px-1 py-0.5 font-mono text-sm text-mushroom-neon">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\|\|(.+?)\|\|/g, '<span class="bg-gray-600 text-transparent hover:text-white rounded px-1 cursor-pointer transition-colors">$1</span>')
    .replace(/^[\s]*[-•]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-2">$1</h1>');
};

interface Event {
  id: string;
  title: string;
  description: string;
  game: string;
  game_emoji: string;
  date: string;
  time: string;
  host_id: string;
  host_name: string;
  max_players: number;
  registered_players: string[];
  status: string;
  created_at: string;
  discord_message_id?: string;
}

interface TopUser {
  username: string;
  mushrooms: number;
  games_played: number;
  wins: number;
}

interface Stats {
  totalUsers: number;
  totalGames: number;
  totalPurchases: number;
  topUsers: TopUser[];
}

interface User {
  id: string;
  username: string;
  mushrooms: number;
  level: number;
  games_played: number;
  wins: number;
}

interface TicketChannel {
  id: string;
  name: string;
  parent_id: string;
}

interface TicketMessage {
  id: string;
  author: string;
  authorId: string;
  content: string;
  timestamp: string;
  isBot: boolean;
}

interface RoleApplication {
  id: string;
  user_id: string;
  username: string;
  discord_id: string;
  desired_role: string;
  reason: string;
  experience: string;
  activity_hours: string;
  about_me: string;
  status: string;
  admin_note: string;
  created_at: string;
}

const AdminPanel = () => {
  const { user, permissions, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'warnings' | 'webhooks' | 'events' | 'tickets' | 'applications'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(() => getCached('admin_stats'));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [webhookTitle, setWebhookTitle] = useState('');
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventGame, setEventGame] = useState('Among Us');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventMaxPlayers, setEventMaxPlayers] = useState('10');
  const [eventExclusiveDuration, setEventExclusiveDuration] = useState('0'); // hours
  const [createDiscordEvent, setCreateDiscordEvent] = useState(false);
  const [discordEventPrivacy, setDiscordEventPrivacy] = useState(2); // 1=public, 2=guild-only
  const gameOptions = [
    'Among Us', 'Шахматы', 'Дурак', 'Clash Royale', 'Brawl Stars',
    'Minecraft', 'JackBox', 'Бункер', 'Шпион', 'Codenames', 'Alias', 'Gartic Phone', 'Roblox',
  ];

  // Event management state
  const [adminEvents, setAdminEvents] = useState<Event[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  // Embed настройки
  const [embedColor, setEmbedColor] = useState('#00D4FF');
  const [embedFooter, setEmbedFooter] = useState('✨ LOLA Server');
  const [embedThumbnail, setEmbedThumbnail] = useState('https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png');
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const [rolePing, setRolePing] = useState(false);
  const [botName, setBotName] = useState('LOLA Events');
  const [botAvatar, setBotAvatar] = useState('https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png');
  // Events webhook URL
  const eventsWebhookUrl = 'https://discord.com/api/webhooks/1492929379573956658/mYSn3oq9_EilPtNt4ih7O3Oyc8Qafhy0duNr62lOTLZChLuE2aXoOhc5CBqT9YTu7own';

  // Ticket state
  const [tickets, setTickets] = useState<TicketChannel[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketChannel | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketInput, setTicketInput] = useState('');
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketPolling, setTicketPolling] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<RoleApplication[]>([]);

  // Warnings
  interface Warning {
    id: string;
    user_id: string;
    username: string;
    discord_id: string;
    reason: string;
    issued_by: string;
    status: string;
    admin_note: string | null;
    created_at: string;
  }
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [warningLoading, setWarningLoading] = useState(false);
  const [newWarningUser, setNewWarningUser] = useState('');
  const [newWarningReason, setNewWarningReason] = useState('');

  const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;
  const isAdmin = permissions?.isAdmin;
  const isEventMaker = permissions?.isEventMaker;
  const isSpecial = permissions?.isSpecial;
  const userRoles = permissions?.roles || [];

  // Только эти 4 роли могут видеть вкладку "Ивенты"
  const EVENT_MAKER_ROLE_IDS = [
    '1465825700031234172', // @𝓔𝓿𝓮𝓷𝓽 𝓜𝓪𝓴𝓮𝓻
    '1478094359332126812', // @Minecraft
    '1475558835035963602', // @Clash Royale
    '1485703963280937181', // @Brawl Stars
  ];

  const canManageEvents = EVENT_MAKER_ROLE_IDS.some(roleId => userRoles.includes(roleId));

  // Stats
  useEffect(() => {
    if (!isAdmin && !isEventMaker && !isSpecial) return;
    const loadStats = async () => {
      setLoading(true);
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: totalGames } = await supabase.from('games').select('*', { count: 'exact', head: true });
      const { count: totalPurchases } = await supabase.from('shop_purchases').select('*', { count: 'exact', head: true });
      const { data: topUsers } = await supabase.from('users').select('username, mushrooms, games_played, wins').order('mushrooms', { ascending: false }).limit(5);
      const newStats = { totalUsers: totalUsers || 0, totalGames: totalGames || 0, totalPurchases: totalPurchases || 0, topUsers: topUsers || [] };
      setStats(newStats);
      setCached('admin_stats', newStats);
      setLoading(false);
    };
    loadStats();
  }, [isAdmin, isEventMaker, isSpecial]);

  // Users
  useEffect(() => {
    if (!isAdmin) return;
    const loadUsers = async () => {
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setAllUsers(data);
    };
    loadUsers();
  }, [isAdmin]);

  // Fetch open tickets
  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/get-server-info`);
      if (res.ok) {
        const data = await res.json();
        const ticketChannels: TicketChannel[] = (data.channels || [])
          .filter((ch: { name?: string }) => ch.name?.startsWith('ticket-'))
          .map((ch: { id: string; name: string; parent_id: string }) => ({
            id: ch.id,
            name: ch.name,
            parent_id: ch.parent_id,
          }));
        setTickets(ticketChannels);
      }
    } catch (e) {
      logger.error('Tickets fetch error:', e);
    }
    setTicketsLoading(false);
  }, [FUNCTIONS_URL]);

  useEffect(() => {
    if (activeTab === 'tickets' && isAdmin) {
      fetchTickets();
    }
  }, [activeTab, isAdmin]);

  // Fetch ticket messages
  useEffect(() => {
    if (!selectedTicket) return;

    const controller = new AbortController();

    const fetchMsgs = async () => {
      setTicketPolling(true);
      try {
        const res = await fetch(`${FUNCTIONS_URL}/ticket-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch', channelId: selectedTicket.id }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages) {
            setTicketMessages(data.messages);
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        logger.error('Msg fetch error:', e);
      }
      setTicketPolling(false);
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [selectedTicket]);

  // Scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [ticketMessages]);

  const sendWebhook = async () => {
    if (!webhookUrl || !webhookMessage) return;
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const payload: { content: string; embeds?: Array<{ title: string; color: number; timestamp: string }> } = { content: webhookMessage };
      if (webhookTitle) payload.embeds = [{ title: webhookTitle, color: 0x00FF87, timestamp: new Date().toISOString() }];
      const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok || res.status === 204) {
        setWebhookResult({ success: true, message: 'Сообщение отправлено!' });
        setWebhookMessage('');
        setWebhookTitle('');
      } else {
        setWebhookResult({ success: false, message: 'Ошибка отправки' });
      }
    } catch { setWebhookResult({ success: false, message: 'Ошибка сети' }); }
    setWebhookLoading(false);
  };

  const banUser = async (userId: string) => {
    if (!isAdmin) return;
    await supabase.from('users').update({ mushrooms: 0 }).eq('id', userId);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, mushrooms: 0 } : u));
  };

  const sendTicketMessage = async () => {
    if (!ticketInput.trim() || !selectedTicket) return;
    setTicketSending(true);
    try {
      const adminName = user?.username || 'Admin';
      const res = await fetch(`${FUNCTIONS_URL}/ticket-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          channelId: selectedTicket.id,
          content: ticketInput.trim(),
          username: `🛡️ ${adminName}`,
          senderId: 'admin',
        }),
      });
      if (res.ok) {
        setTicketInput('');
      }
    } catch (e) {
      logger.error('Send error:', e);
    }
    setTicketSending(false);
  };

  const closeTicketChannel = async (channelId: string) => {
    if (!confirm('Закрыть тикет? Архив будет отправлен в канал логов.')) return;
    
    try {
      // 1. Сначала отправляем транскрипт в архив
      await fetch(`${FUNCTIONS_URL}/ticket-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedTicket?.id || channelId,
          channelName: selectedTicket?.name || channelId,
        }),
      });
    } catch (e) {
      logger.error('Transcript error:', e);
    }

    // 2. Закрываем тикет
    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', ticketChannelId: channelId }),
      });
      if (res.ok) {
        fetchTickets();
        setSelectedTicket(null);
      }
    } catch (e) { logger.error('Close error:', e); }
  };

  // Загрузка заявок
  useEffect(() => {
    if (activeTab === 'applications' && isAdmin) {
      supabase.from('role_applications').select('*').order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setApps(data); });
    }
  }, [activeTab, isAdmin]);

  // Загрузка варнов
  useEffect(() => {
    if (activeTab === 'warnings' && isAdmin) {
      setWarningLoading(true);
      supabase.from('warnings').select('*').order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setWarnings(data);
          setWarningLoading(false);
        });
    }
  }, [activeTab, isAdmin]);

  // Принять/отклонить варн
  const handleReviewWarning = async (warningId: string, action: 'accepted' | 'rejected', note: string) => {
    const warning = warnings.find(w => w.id === warningId);
    if (!warning) return;

    const { error } = await supabase
      .from('warnings')
      .update({
        status: action,
        admin_note: note,
        reviewed_by: user?.username,
        reviewed_at: new Date().toISOString(),
        mute_duration_hours: action === 'accepted' ? 72 : null, // 3 дня мута
      })
      .eq('id', warningId);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    // Если принят — проверяем количество варнов
    if (action === 'accepted' && warning.discord_id) {
      const { data: acceptedWarnings } = await supabase
        .from('warnings')
        .select('id')
        .eq('user_id', warning.user_id)
        .eq('status', 'accepted');

      // 3 варна = мут 3 дня через бота
      if (acceptedWarnings && acceptedWarnings.length >= 3) {
        try {
          await fetch(`${FUNCTIONS_URL}/issue-mute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: warning.discord_id, durationHours: 72 }),
          });
        } catch (e) {
          console.error('Mute error:', e);
        }
      }
    }

    setWarnings(prev => prev.map(w =>
      w.id === warningId ? { ...w, status: action, admin_note: note } : w
    ));
  };

  // Выдать варн
  const handleIssueWarning = async () => {
    if (!newWarningUser || !newWarningReason) {
      alert('Заполни все поля!');
      return;
    }

    // Ищем пользователя
    const { data: foundUser } = await supabase
      .from('users')
      .select('id, username, discord_id')
      .ilike('username', newWarningUser)
      .limit(1)
      .single();

    if (!foundUser) {
      alert('Пользователь не найден!');
      return;
    }

    const { error } = await supabase
      .from('warnings')
      .insert([{
        user_id: foundUser.id,
        username: foundUser.username,
        discord_id: foundUser.discord_id,
        reason: newWarningReason,
        issued_by: user?.username,
        status: 'pending',
      }]);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    // Уведомляем пользователя в ЛС
    try {
      const guild = await (async () => {
        const res = await fetch(`${FUNCTIONS_URL}/get-server-info`);
        if (res.ok) return await res.json();
        return null;
      })();
    } catch {}

    setNewWarningUser('');
    setNewWarningReason('');
    setWarnings(prev => [{
      id: Date.now().toString(),
      user_id: foundUser.id,
      username: foundUser.username,
      discord_id: foundUser.discord_id,
      reason: newWarningReason,
      issued_by: user?.username || '',
      status: 'pending',
      admin_note: null,
      created_at: new Date().toISOString(),
    }, ...prev]);

    alert(`✅ Варн выдан ${foundUser.username}!`);
  };

  // Загрузка мероприятий для редактирования
  useEffect(() => {
    if (activeTab === 'events' && canManageEvents) {
      loadAdminEvents();
    }
  }, [activeTab, canManageEvents]);

  // Подписка на изменения таблицы events в реальном времени
  useEffect(() => {
    if (!canManageEvents) return;

    const channel = supabase
      .channel('admin-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          loadAdminEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canManageEvents]);

  const loadAdminEvents = async () => {
    setEventLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) logger.error('Load events error:', error);
    setAdminEvents(data || []);
    setEventLoading(false);
  };

  const deleteDiscordMessage = async (messageId: string) => {
    if (!messageId) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        const res = await fetch(`${FUNCTIONS_URL}/event-discord`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'delete',
            event: { discord_message_id: messageId },
          }),
        });

        if (res.ok) {
          return true;
        }

        const errorText = await res.text();
        logger.error('Discord delete function failed:', errorText);
      }
    } catch (e) {
      logger.error('Discord delete function error:', e);
    }

    // Фоллбек на удаление через webhook для старых сообщений
    try {
      const urlParts = eventsWebhookUrl.split('/');
      const webhookId = urlParts[urlParts.length - 2];
      const webhookToken = urlParts[urlParts.length - 1];

      await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (e) {
      logger.error('Discord webhook delete error:', e);
      return false;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Удалить это мероприятие?')) return;

    const eventToDelete = adminEvents.find(e => e.id === eventId);

    if (eventToDelete?.discord_message_id) {
      await deleteDiscordMessage(eventToDelete.discord_message_id);
    }

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }
    setAdminEvents(prev => prev.filter(e => e.id !== eventId));
    if (editingEvent?.id === eventId) setEditingEvent(null);
  };

  const handleCancelEvent = async (event: Event) => {
    if (!confirm(`Отменить мероприятие "${event.title}"?`)) return;

    const { error } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', event.id);

    if (error) {
      alert('Ошибка отмены: ' + error.message);
      return;
    }

    // Обновляем embed в Discord
    if (event.discord_message_id) {
      try {
        const urlParts = eventsWebhookUrl.split('/');
        const webhookId = urlParts[urlParts.length - 2];
        const webhookToken = urlParts[urlParts.length - 1];

        const gameEmojis: Record<string, string> = {
          'Among Us': '🚀', 'Шахматы': '♟️', 'Дурак': '🃏', 'Clash Royale': '👑',
          'Brawl Stars': '⭐', 'Minecraft': '⛏️', 'JackBox': '📦', 'Бункер': '🏚️',
          'Шпион': '🕵️', 'Codenames': '🔤', 'Alias': '🗣️', 'Gartic Phone': '🎨', 'Roblox': '🟢',
        };
        const emoji = gameEmojis[event.game] || event.game_emoji || '🎮';

        const cancelPayload = {
          content: null,
          embeds: [{
            title: `${emoji} ${event.title}`,
            description: `❌ **МЕРОПРИЯТИЕ ОТМЕНЕНО**\n\n${event.description}`,
            color: 0xFF4444,
            thumbnail: { url: 'https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png' },
            fields: [
              { name: '🎮 **Игра**', value: `\`${event.game || 'Не указана'}\``, inline: true },
              { name: '🗓️ **Дата**', value: `\`${event.date || 'Не указана'}\``, inline: true },
              { name: '⏰ **Время**', value: `\`${event.time || 'Не указано'}\``, inline: true },
              { name: '👥 **Участники**', value: `\`${(event.registered_players?.length || 0)}/${event.max_players || 10}\``, inline: true },
              { name: '👤 **Ведущий**', value: event.host_name || 'Не указан', inline: true },
              { name: '📊 **Статус**', value: '❌ `Отменён`', inline: true },
            ],
            footer: { text: '✨ LOLA Server' },
            timestamp: new Date().toISOString(),
          }],
        };

        await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${event.discord_message_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cancelPayload),
        });
      } catch (e) {
        logger.error('Discord cancel sync error:', e);
      }
    }

    setAdminEvents(prev => prev.map(e =>
      e.id === event.id ? { ...e, status: 'cancelled' } : e
    ));

    if (editingEvent?.id === event.id) {
      setEditingEvent(null);
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEventName(event.title);
    setEventDescription(event.description);
    setEventGame(event.game);
    setEventDate(event.date);
    setEventTime(event.time);
    setEventMaxPlayers(String(event.max_players));
    setEventExclusiveDuration(String(event.exclusive_access_duration || 0));
  };

  const handleSaveEvent = async () => {
    if (!editingEvent || !eventName || !eventDescription || !eventDate || !eventTime) return;

    const gameEmojis: Record<string, string> = {
      'Among Us': '🚀', 'Шахматы': '♟️', 'Дурак': '🃏', 'Clash Royale': '👑',
      'Brawl Stars': '⭐', 'Minecraft': '⛏️', 'JackBox': '📦', 'Бункер': '🏚️',
      'Шпион': '🕵️', 'Codenames': '🔤', 'Alias': '🗣️', 'Gartic Phone': '🎨', 'Roblox': '🟢',
    };

    // Рассчитываем exclusive_until
    const exclusiveDurationHours = parseInt(eventExclusiveDuration) || 0;
    let exclusiveUntil: string | null = null;
    if (exclusiveDurationHours > 0) {
      const eventDateTime = new Date(`${eventDate}T${eventTime}`);
      exclusiveUntil = new Date(eventDateTime.getTime() - exclusiveDurationHours * 60 * 60 * 1000).toISOString();
    }

    const eventData = {
      title: eventName,
      description: eventDescription,
      game: eventGame,
      game_emoji: gameEmojis[eventGame] || '🎮',
      date: eventDate,
      time: eventTime,
      max_players: parseInt(eventMaxPlayers) || 10,
      registered_players: editingEvent.registered_players || [],
      status: editingEvent.status || 'upcoming',
      host_id: editingEvent.host_id,
      host_name: editingEvent.host_name,
      discord_message_id: editingEvent.discord_message_id,
      exclusive_access_duration: exclusiveDurationHours,
      exclusive_until: exclusiveUntil,
      exclusive_description: 'Регистрация раньше остальных',
    };

    const { error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', editingEvent.id);

    if (error) {
      alert('Ошибка сохранения: ' + error.message);
      return;
    }

    // Обновляем embed в Discord
    try {
      const hexColor = parseInt(embedColor.replace('#', ''), 16);
      const urlParts = eventsWebhookUrl.split('/');
      const webhookId = urlParts[urlParts.length - 2];
      const webhookToken = urlParts[urlParts.length - 1];
      
      const updatePayload = {
        content: null,
        embeds: [{
          title: `${gameEmojis[eventGame] || '🎮'} ${eventName}`,
          description: eventDescription ? `**📝 Описание:**\n${eventDescription}` : null,
          color: hexColor,
          thumbnail: { url: embedThumbnail },
          fields: [
            { name: '🎮 **Игра**', value: `\`${eventGame}\``, inline: true },
            { name: '🗓️ **Дата**', value: `\`${eventDate}\``, inline: true },
            { name: '⏰ **Время**', value: `\`${eventTime}\``, inline: true },
            { name: '👥 **Участники**', value: `\`${(editingEvent.registered_players?.length || 0)}/${parseInt(eventMaxPlayers) || 10}\``, inline: true },
            { name: '👤 **Ведущий**', value: editingEvent.host_name || 'Admin', inline: true },
            { name: '📊 **Статус**', value: editingEvent.status === 'upcoming' ? '📅 `Предстоящий`' : editingEvent.status === 'completed' ? '✅ `Завершён`' : '❌ `Отменён`', inline: true },
            { name: '\u200b', value: `🔗 [Зарегистрироваться](https://loolaa.netlify.app/events)\n💬 [Discord сервер](https://discord.gg/lolaamongus)`, inline: false },
          ],
          footer: { text: embedFooter, icon_url: embedThumbnail },
          timestamp: new Date().toISOString(),
        }],
      };

      await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${editingEvent.discord_message_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    } catch (e) {
      logger.error('Discord update error:', e);
    }

    setEditingEvent(null);
    setEventName('');
    setEventDescription('');
    setEventGame('Among Us');
    setEventDate('');
    setEventTime('');
    setEventMaxPlayers('10');
    setEventExclusiveDuration('0');
    loadAdminEvents();
  };

  const cancelEdit = () => {
    setEditingEvent(null);
    setEventName('');
    setEventDescription('');
    setEventGame('Among Us');
    setEventDate('');
    setEventTime('');
    setEventMaxPlayers('10');
    setEventExclusiveDuration('0');
  };

  const resetEmbedSettings = () => {
    setEmbedColor('#00D4FF');
    setEmbedFooter('✨ LOLA Server');
    setEmbedThumbnail('https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png');
    setRolePing(false);
    setBotName('LOLA Events');
    setBotAvatar('https://cdn.discordapp.com/icons/1463228311118549124/a_1463228311118549124.png');
  };

  // Динамическое определение статуса по дате
  const getEventStatus = (event: Event): { status: string; label: string; color: string } => {
    if (event.status === 'cancelled') return { status: 'cancelled', label: 'Отменён', color: 'bg-red-500/20 text-red-400' };

    const eventDateStr = `${event.date}T${event.time || '00:00'}`;
    const eventDate = new Date(eventDateStr);
    const now = new Date();
    const diffMs = eventDate.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < -2) {
      return { status: 'completed', label: 'Завершено', color: 'bg-gray-500/20 text-gray-400' };
    }
    if (diffMinutes <= 0 && diffHours >= -2) {
      return { status: 'live', label: '🔴 Идёт сейчас', color: 'bg-green-500/20 text-green-400 animate-pulse' };
    }
    if (diffMinutes > 0 && diffMinutes <= 60) {
      return { status: 'upcoming', label: '⚡ Скоро начнётся', color: 'bg-orange-500/20 text-orange-400' };
    }
    if (diffHours > -2 && diffHours <= 24) {
      return { status: 'upcoming', label: 'Предстоящий', color: 'bg-blue-500/20 text-blue-400' };
    }
    return { status: 'completed', label: 'Завершено', color: 'bg-gray-500/20 text-gray-400' };
  };

  const handleClearAllReviews = async () => {
    if (!confirm('Удалить ВСЕ отзывы о мероприятиях? Это действие нельзя отменить.')) return;
    const { error } = await supabase.from('event_reviews').delete().neq('id', '');
    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }
    alert('✅ Все отзывы удалены!');
  };

  if (authLoading) return null;

  // Система прав по ролям
  const hasAnyPermission = permissions?.isAdmin || permissions?.isEventMaker || permissions?.isSpecial;
  if (!user) return <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen"><p className="text-2xl text-gray-400">Войдите через Discord</p></div>;
  if (!hasAnyPermission) return <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen"><div className="text-center"><Shield className="w-16 h-16 mx-auto text-gray-500 mb-4" /><h1 className="text-3xl font-bold text-gray-400 mb-2">Доступ запрещён</h1></div></div>;

  // Роли для конкретной функциональности
  const MODERATOR_ROLES = ['1463230825041756302', '1463271031501357067', '1464965472704266414', '1478351837835825235', '1466565907857014825', '1464964592575709309', '1464787504183115816', '1469686860627447931', '1465825700031234172']; // Все модеры+
  const TICKET_MOD_ROLES = ['1464964592575709309', '1464787504183115816']; // Mod, Helper
  const isTicketMod = TICKET_MOD_ROLES.some(r => userRoles.includes(r)) || isAdmin;

  const tabs = [
    { id: 'overview' as const, label: 'Обзор', icon: BarChart3, required: 'any', color: 'from-green-500 to-emerald-500' },
    { id: 'warnings' as const, label: 'Варны', icon: Ban, required: 'admin', color: 'from-red-500 to-orange-500' },
    { id: 'tickets' as const, label: 'Тикеты', icon: Ticket, required: 'ticketMod', color: 'from-blue-500 to-cyan-500' },
    { id: 'applications' as const, label: 'Заявки', icon: FileText, required: 'admin', color: 'from-purple-500 to-pink-500' },
    { id: 'users' as const, label: 'Пользователи', icon: Users, required: 'admin', color: 'from-indigo-500 to-blue-500' },
    { id: 'webhooks' as const, label: 'Вебхуки', icon: MessageSquare, required: 'admin', color: 'from-amber-500 to-orange-500' },
    { id: 'events' as const, label: 'Ивенты', icon: Gamepad2, required: 'eventMaker', color: 'from-violet-500 to-purple-500' },
  ];

  const hasAccess = (required: string) => {
    switch (required) {
      case 'any': return hasAnyPermission;
      case 'admin': return isAdmin;
      case 'ticketMod': return isTicketMod;
      case 'eventMaker': return canManageEvents;
      default: return false;
    }
  };

  const visibleTabs = tabs.filter(t => hasAccess(t.required));
  const lockedTabs = tabs.filter(t => !hasAccess(t.required));

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-2">🛡️ Панель управления</h1>
          <p className="text-gray-400">Управление сервером LOLA</p>
          <div className="flex gap-2 mt-3">
            {isAdmin && <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold border border-red-500/30">👑 Администратор</span>}
            {isEventMaker && <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold border border-blue-500/30">🎮 Ивент-мейкер</span>}
            {isSpecial && <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold border border-purple-500/30">⭐ Особый гость</span>}
          </div>
        </motion.div>

        <div className="flex gap-2 mb-2 overflow-x-auto">
          {visibleTabs.map(tab => { const Icon = tab.icon; return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTicket(null); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? `bg-gradient-to-r ${tab.color} text-white border border-white/20 shadow-lg` : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} />{tab.label}
              {tab.id === 'tickets' && tickets.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{tickets.length}</span>}
            </button>
          ); })}
        </div>
        {lockedTabs.length > 0 && (
          <div className="flex gap-2 mb-8 overflow-x-auto opacity-40">
            {lockedTabs.map(tab => { const Icon = tab.icon; return (
              <div key={tab.id} className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium whitespace-nowrap bg-white/5 text-gray-600 cursor-not-allowed">
                <Icon size={18} />{tab.label}
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              </div>
            ); })}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-mushroom-neon" size={32} /></div> : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="glass-card p-6"><div className="flex items-center gap-4"><Users className="text-blue-400" size={32} /><div><p className="text-gray-400">Всего игроков</p><p className="text-3xl font-bold">{stats?.totalUsers}</p></div></div></div>
                  <div className="glass-card p-6"><div className="flex items-center gap-4"><Gamepad2 className="text-mushroom-neon" size={32} /><div><p className="text-gray-400">Всего игр</p><p className="text-3xl font-bold">{stats?.totalGames}</p></div></div></div>
                  <div className="glass-card p-6"><div className="flex items-center gap-4"><ShoppingBag className="text-yellow-400" size={32} /><div><p className="text-gray-400">Покупок</p><p className="text-3xl font-bold">{stats?.totalPurchases}</p></div></div></div>
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-2xl font-bold mb-4">🏆 Топ игроков по грибам</h3>
                  {stats && stats.topUsers && stats.topUsers.length > 0 ? (
                    <div className="space-y-3">
                    {stats.topUsers.map((u: TopUser, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-gradient-to-br from-mushroom-neon to-mushroom-purple flex items-center justify-center text-sm font-bold text-black">#{i + 1}</span><span className="font-medium">{u.username}</span></div>
                        <div className="flex gap-6 text-sm"><span className="text-mushroom-neon font-bold">{u.mushrooms} 🍄</span><span className="text-gray-400">{u.games_played} игр</span><span className="text-yellow-400">{u.wins} побед</span></div>
                      </div>
                    ))}
                  </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">Пока нет данных</p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Warnings Tab */}
        {activeTab === 'warnings' && isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Issue Warning Form */}
            <div className="glass-card p-6 mb-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Ban className="text-red-400" /> Выдать варн</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Никнейм игрока</label>
                  <input type="text" value={newWarningUser} onChange={e => setNewWarningUser(e.target.value)} placeholder="Введи ник..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2">Причина</label>
                  <textarea value={newWarningReason} onChange={e => setNewWarningReason(e.target.value)} placeholder="За что варн..." rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none" />
                </div>
                <button onClick={handleIssueWarning} className="btn-primary flex items-center gap-2"><Ban size={16} /> Выдать варн</button>
              </div>
            </div>

            {/* Pending Warnings */}
            <div className="glass-card p-6 mb-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Ban size={20} className="text-yellow-400" /> Ожидание ({warnings.filter(w => w.status === 'pending').length})</h3>
              {warningLoading ? (
                <div className="text-center text-gray-500 py-8">Загрузка...</div>
              ) : warnings.filter(w => w.status === 'pending').length > 0 ? (
                <div className="space-y-3">
                  {warnings.filter(w => w.status === 'pending').map(w => (
                    <div key={w.id} className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-white">{w.username}</p>
                          <p className="text-sm text-gray-400 mt-1">{w.reason}</p>
                          <p className="text-xs text-gray-600 mt-1">Выдал: {w.issued_by} • {new Date(w.created_at).toLocaleString('ru-RU')}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => handleReviewWarning(w.id, 'accepted', 'Принят')} className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 text-sm font-bold flex items-center gap-1"><CheckCircle size={14} /> ✓</button>
                          <button onClick={() => handleReviewWarning(w.id, 'rejected', 'Отклонён')} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-bold flex items-center gap-1"><XCircle size={14} /> ✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Нет ожидающих варнов ✅</p>
              )}
            </div>

            {/* Warning History */}
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield size={20} className="text-gray-400" /> История варнов</h3>
              {warnings.filter(w => w.status !== 'pending').length > 0 ? (
                <div className="space-y-2">
                  {warnings.filter(w => w.status !== 'pending').map(w => (
                    <div key={w.id} className={`p-3 rounded-xl flex items-center justify-between ${w.status === 'accepted' ? 'bg-red-500/5 border border-red-500/20' : 'bg-green-500/5 border border-green-500/20'}`}>
                      <div>
                        <p className="font-bold text-sm text-white">{w.username}</p>
                        <p className="text-xs text-gray-400">{w.reason}</p>
                        <p className="text-xs text-gray-600">Ревью: {w.reviewed_by || '-'} • {w.admin_note || ''}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${w.status === 'accepted' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {w.status === 'accepted' ? '✓ Принят' : '✕ Отклонён'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">История пуста</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {selectedTicket ? (
              /* Chat View */
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white transition-colors"><ChevronRight className="rotate-180" size={20} /></button>
                    <div>
                      <p className="font-bold">{selectedTicket.name}</p>
                      <p className="text-xs text-gray-400">Открытый тикет</p>
                    </div>
                  </div>
                  <button onClick={() => closeTicketChannel(selectedTicket.id)} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors">🔒 Закрыть и удалить</button>
                </div>

                <div ref={chatRef} className="h-96 overflow-y-auto p-4 space-y-3">
                  {ticketMessages.map((msg: TicketMessage) => {
                    const isOwn = msg.authorId === 'admin' || (!msg.isBot && msg.author === `🛡️ ${user?.username}`);
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isOwn ? 'bg-mushroom-neon/20 text-white rounded-br-sm' : 'bg-purple-500/20 text-white rounded-bl-sm'}`}>
                          {!isOwn && <p className="text-xs font-bold text-mushroom-neon mb-1">{msg.author}</p>}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className="text-xs text-gray-500 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })}
                  {ticketPolling && <div className="text-center text-gray-500 text-sm animate-pulse">Загрузка...</div>}
                </div>

                <div className="p-4 border-t border-white/10 flex gap-2">
                  <input type="text" value={ticketInput} onChange={(e) => setTicketInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !ticketSending && sendTicketMessage()} placeholder="Ответить..." className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3" maxLength={2000} />
                  <button onClick={sendTicketMessage} disabled={ticketSending || !ticketInput.trim()} className="btn-primary px-4 disabled:opacity-50 flex items-center">
                    {ticketSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            ) : (
              /* Ticket List */
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-2"><Ticket className="text-mushroom-neon" /> Открытые тикеты</h3>
                  <button onClick={fetchTickets} className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Reply size={14} /> Обновить</button>
                </div>

                {ticketsLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-mushroom-neon" size={32} /></div> : (
                  tickets.length > 0 ? (
                    <div className="space-y-2">
                      {tickets.map(ticket => (
                        <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setTicketMessages([]); }} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <Ticket className="text-mushroom-neon" size={24} />
                            <div>
                              <p className="font-bold">{ticket.name}</p>
                              <p className="text-sm text-gray-400">Канал Discord</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">Открыт</span>
                            <ChevronRight size={18} className="text-gray-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Ticket className="mx-auto text-gray-500 mb-4" size={48} />
                      <p className="text-xl text-gray-400 mb-2">Нет открытых тикетов</p>
                      <p className="text-gray-500">Все обращения обработаны!</p>
                    </div>
                  )
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6">
              <h3 className="text-2xl font-bold mb-4">👥 Все пользователи</h3>
              <div className="space-y-2">
                {allUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mushroom-neon to-mushroom-purple flex items-center justify-center font-bold text-black">{u.username.charAt(0)}</div>
                      <div><p className="font-bold">{u.username}</p><p className="text-sm text-gray-400">Lvl {u.level} • {u.games_played} игр • {u.wins} побед</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-mushroom-neon font-bold">{u.mushrooms} 🍄</span>
                      <button onClick={() => banUser(u.id)} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors" title="Обнулить грибы"><Ban size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><MessageSquare className="text-mushroom-neon" /> Отправка вебхуков</h3>
              <p className="text-gray-400 mb-6">Отправляй сообщения в Discord каналы через вебхуки</p>
              <div className="space-y-4">
                <div><label className="block text-gray-400 mb-2">Webhook URL</label><input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3" /></div>
                <div><label className="block text-gray-400 mb-2">Заголовок (опционально)</label><input type="text" value={webhookTitle} onChange={(e) => setWebhookTitle(e.target.value)} placeholder="📢 Объявление" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3" /></div>
                <div><label className="block text-gray-400 mb-2">Сообщение</label><textarea value={webhookMessage} onChange={(e) => setWebhookMessage(e.target.value)} placeholder="Текст сообщения..." rows={4} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 resize-none" /></div>
                <button onClick={sendWebhook} disabled={webhookLoading || !webhookUrl || !webhookMessage} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  {webhookLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}{webhookLoading ? 'Отправка...' : 'Отправить'}
                </button>
                {webhookResult && (<div className={`flex items-center gap-2 p-4 rounded-xl ${webhookResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>{webhookResult.success ? <CheckCircle /> : <XCircle />}<span>{webhookResult.message}</span></div>)}
              </div>
            </div>
          </motion.div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && canManageEvents && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6 mb-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Gamepad2 className="text-mushroom-neon" /> {editingEvent ? 'Редактировать мероприятие' : 'Создать мероприятие'}</h3>
              <p className="text-gray-400 mb-6">Мероприятие появится на сайте и будет автоматически удалено через 3 дня после завершения</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Название</label>
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="🎮 Турнир по Among Us" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2">Описание</label>
                  <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Подробности мероприятия..." rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 resize-none text-white" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-2">Игра</label>
                    <select value={eventGame} onChange={(e) => setEventGame(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white">
                      {gameOptions.map((g) => <option key={g} value={g} className="bg-gray-900">{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">Макс. игроков</label>
                    <input type="number" value={eventMaxPlayers} onChange={(e) => setEventMaxPlayers(e.target.value)} min="2" max="100" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 mb-2">⏰ Эксклюзивный доступ для резервистов (часы)</label>
                  <input
                    type="number"
                    value={eventExclusiveDuration}
                    onChange={(e) => setEventExclusiveDuration(e.target.value)}
                    min="0"
                    max="168"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {eventExclusiveDuration === '0' || eventExclusiveDuration === ''
                      ? '0 = регистрация сразу для всех'
                      : `Регистрация для резервистов откроется за ${eventExclusiveDuration} ч. до начала`}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-2">Дата</label>
                    <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">Время</label>
                    <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                  </div>
                </div>

                {/* Настройки Embed */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-gray-400 uppercase">🎨 Настройки Embed</h4>
                    <button onClick={resetEmbedSettings} className="text-xs text-gray-500 hover:text-white transition-colors">Сбросить</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-gray-400 mb-1 text-xs">Цвет полоски</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent" />
                        <input type="text" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} placeholder="#00D4FF" className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono" maxLength={7} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 text-xs">Footer текст</label>
                      <input type="text" value={embedFooter} onChange={(e) => setEmbedFooter(e.target.value)} placeholder="✨ LOLA Server" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 text-xs">URL картинки embed</label>
                      <input type="text" value={embedThumbnail} onChange={(e) => setEmbedThumbnail(e.target.value)} placeholder="https://..." className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-gray-400 mb-1 text-xs">🤖 Имя бота (отправитель)</label>
                      <input type="text" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="LOLA Events" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 text-xs">🖼️ Аватарка бота (URL)</label>
                      <input type="text" value={botAvatar} onChange={(e) => setBotAvatar(e.target.value)} placeholder="https://..." className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-xs" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-gray-400 mb-2 text-xs">🔔 Тегать роль при создании</label>
                    <button
                      onClick={() => setRolePing(!rolePing)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        rolePing
                          ? 'bg-mushroom-neon/10 border-mushroom-neon/30 text-mushroom-neon'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-6 rounded-full transition-colors relative ${rolePing ? 'bg-mushroom-neon' : 'bg-gray-600'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rolePing ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium">Тегать <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">@Event Ping</code></span>
                      </div>
                      <span className="text-xs">{rolePing ? '✅ Включено' : '⬜ Выключено'}</span>
                    </button>
                    <p className="text-xs text-gray-500 mt-1">Роль ID: 1491866877486436573</p>
                  </div>

                  {/* Discord Event */}
                  <div className="mb-3">
                    <label className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all bg-white/5 border-white/10 hover:bg-white/10">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={createDiscordEvent} onChange={e => setCreateDiscordEvent(e.target.checked)} className="w-5 h-5 rounded accent-green-500" />
                        <div>
                          <div className="text-sm font-medium text-white">📅 Создать Discord Event</div>
                          <div className="text-xs text-gray-500">Событие появится в Discord</div>
                        </div>
                      </div>
                      <span className="text-xs">{createDiscordEvent ? '✅ Вкл' : '⬜ Выкл'}</span>
                    </label>
                    {createDiscordEvent && (
                      <div className="mt-3 p-3 bg-mushroom-neon/5 border border-mushroom-neon/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span>👥</span>
                          <select value={discordEventPrivacy} onChange={e => setDiscordEventPrivacy(parseInt(e.target.value))} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                            <option value={2} className="bg-gray-900">Только сервер</option>
                            <option value={1} className="bg-gray-900">Публичный</option>
                          </select>
                        </div>
                        <p className="text-xs text-mushroom-neon">✅ Event будет создан в Discord при сохранении</p>
                      </div>
                    )}
                  </div>

                  {/* Инструкция по Markdown */}
                  <button onClick={() => setShowMarkdownHelp(!showMarkdownHelp)} className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-mushroom-neon">📝 Инструкция по символам оформления</span>
                      <ChevronRight size={16} className={`transition-transform ${showMarkdownHelp ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {showMarkdownHelp && (
                    <div className="mt-3 p-4 bg-black/30 rounded-xl text-sm space-y-2 border border-white/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">**жирный**</code>
                            <span className="text-white font-bold">жирный</span>
                          </div>
                          <p className="text-xs text-gray-500">Выделяет текст жирным</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">*курсив*</code>
                            <span className="text-white italic">курсив</span>
                          </div>
                          <p className="text-xs text-gray-500">Делает текст курсивом</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">***жирный курсив***</code>
                            <span className="text-white font-bold italic">жирный курсив</span>
                          </div>
                          <p className="text-xs text-gray-500">Жирный + курсив вместе</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">`код`</code>
                            <code className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono text-mushroom-neon">код</code>
                          </div>
                          <p className="text-xs text-gray-500">Выделяет как код</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">~~зачеркнутый~~</code>
                            <span className="text-white line-through">зачеркнутый</span>
                          </div>
                          <p className="text-xs text-gray-500">Зачёркивает текст</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">||спойлер||</code>
                            <span className="bg-gray-600 text-gray-600 px-1 rounded text-xs">спойлер</span>
                          </div>
                          <p className="text-xs text-gray-500">Скрывает текст (спойлер)</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded"># Заголовок</code>
                            <span className="text-white text-lg font-bold">Заголовок</span>
                          </div>
                          <p className="text-xs text-gray-500">Большой заголовок</p>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <code className="text-xs bg-white/10 px-2 py-0.5 rounded">- пункт списка</code>
                            <span className="text-white">• пункт</span>
                          </div>
                          <p className="text-xs text-gray-500">Маркированный список</p>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-mushroom-neon/10 rounded-lg border border-mushroom-neon/20">
                        <p className="text-xs text-mushroom-neon">💡 Эти символы работают и на сайте и в Discord embed!</p>
                      </div>
                    </div>
                  )}
                </div>

                {editingEvent && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEvent}
                      disabled={!eventName || !eventDescription || !eventDate || !eventTime}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Save size={18} />
                      Сохранить изменения
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/20 flex items-center gap-2"
                    >
                      <X size={18} />
                      Отмена
                    </button>
                  </div>
                )}

                {!editingEvent && (
                  <button
                    onClick={async () => {
                      if (!eventName || !eventDescription || !eventDate || !eventTime) return;
                      const gameEmojis: Record<string, string> = {
                        'Among Us': '🚀', 'Шахматы': '♟️', 'Дурак': '🃏', 'Clash Royale': '👑',
                        'Brawl Stars': '⭐', 'Minecraft': '⛏️', 'JackBox': '📦', 'Бункер': '🏚️',
                        'Шпион': '🕵️', 'Codenames': '🔤', 'Alias': '🗣️', 'Gartic Phone': '🎨', 'Roblox': '🟢',
                      };

                      // Рассчитываем exclusive_until
                      const exclusiveDurationHours = parseInt(eventExclusiveDuration) || 0;
                      let exclusiveUntil: string | null = null;
                      if (exclusiveDurationHours > 0) {
                        const eventDateTime = new Date(`${eventDate}T${eventTime}`);
                        exclusiveUntil = new Date(eventDateTime.getTime() - exclusiveDurationHours * 60 * 60 * 1000).toISOString();
                      }

                      const eventData = {
                        title: eventName,
                        description: eventDescription,
                        game: eventGame,
                        game_emoji: gameEmojis[eventGame] || '🎮',
                        date: eventDate,
                        time: eventTime,
                        host_id: user?.id || '',
                        host_name: user?.username || 'Admin',
                        max_players: parseInt(eventMaxPlayers) || 10,
                        registered_players: [],
                        status: 'upcoming',
                        exclusive_access_duration: exclusiveDurationHours,
                        exclusive_until: exclusiveUntil,
                        exclusive_description: 'Регистрация раньше остальных',
                      };

                      // Сначала создаём в Supabase
                      const { data, error } = await supabase
                        .from('events')
                        .insert([eventData])
                        .select()
                        .single();

                      if (error) {
                        alert('Ошибка создания: ' + error.message);
                        return;
                      }

                      // Отправляем embed в Discord через Supabase Edge Function
                      try {
                        const response = await fetch(`${FUNCTIONS_URL}/event-discord`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                          },
                          body: JSON.stringify({
                            action: 'create',
                            event: {
                              ...eventData,
                              discord_message_id: null,
                              thumbnail: embedThumbnail,
                              footer: embedFooter,
                            },
                            rolePing: rolePing ? '1467975816297054512' : null,
                            createDiscordEvent,
                            discordEventPrivacy,
                          }),
                        });

                        const result = await response.json();
                        if (!response.ok || result.error) {
                          const errorText = result.error || `Discord sync failed with status ${response.status}`;
                          logger.error('Failed to sync event to Discord:', errorText, result.discord_error || result.discordEventError);
                          alert('Ошибка синхронизации события в Discord: ' + errorText);
                        } else {
                          const updateData: any = { discord_message_id: result.messageId };
                          if (result.discordEventId) {
                            updateData.discord_event_id = result.discordEventId;
                          }
                          await supabase
                            .from('events')
                            .update(updateData)
                            .eq('id', data.id);
                        }
                      } catch (e) {
                        logger.error('Discord sync error:', e);
                        alert('Ошибка синхронизации события в Discord. Проверьте консоль.');
                      }

                      setEventName('');
                      setEventDescription('');
                      setEventDate('');
                      setEventTime('');
                      setEventMaxPlayers('10');
                      setEventExclusiveDuration('0');
                      resetEmbedSettings();
                      loadAdminEvents();

                      alert('Мероприятие создано! ✅');
                    }}
                    disabled={!eventName || !eventDescription || !eventDate || !eventTime}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Calendar size={18} />
                    Создать мероприятие
                  </button>
                )}
              </div>
            </div>

            {/* Список мероприятий для редактирования */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold flex items-center gap-2"><Gamepad2 className="text-mushroom-neon" /> Все мероприятия</h3>
                <button
                  onClick={handleClearAllReviews}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm transition-colors border border-red-500/20 flex items-center gap-2"
                  title="Удалить все отзывы"
                >
                  <Trash2 size={14} />
                  Удалить все отзывы
                </button>
              </div>
              {eventLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-mushroom-neon" size={32} /></div>
              ) : adminEvents.length > 0 ? (
                <div className="space-y-3">
                  {adminEvents.map((event) => {
                    const dynamicStatus = getEventStatus(event);
                    return (
                    <div key={event.id} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-2xl">{event.game_emoji || '🎮'}</span>
                          <div>
                            <h4 className="font-bold">{event.title}</h4>
                            <p className="text-sm text-gray-400 mb-1" dangerouslySetInnerHTML={{ __html: renderDiscordMarkdown(event.description) }} />
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Calendar size={12} />{event.date} {event.time}</span>
                              <span className="flex items-center gap-1"><Users size={12} />{event.registered_players.length}/{event.max_players}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dynamicStatus.color}`}>
                                {dynamicStatus.label}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors"
                            title="Редактировать"
                          >
                            <Edit size={16} />
                          </button>
                          {event.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancelEvent(event)}
                              className="p-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-400 transition-colors"
                              title="Отменить"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar size={48} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400 text-lg mb-2">Нет мероприятий</p>
                  <p className="text-gray-500 text-sm">Создайте первое мероприятие!</p>
                </div>
              )}
            </div>

            {/* Старая форма вебхука */}
            <div className="glass-card p-6 mt-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><MessageSquare className="text-mushroom-neon" /> Быстрый вебхук</h3>
              <div className="space-y-4">
                <div><label className="block text-gray-400 mb-2">Webhook URL</label><input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" /></div>
                <div><label className="block text-gray-400 mb-2">Заголовок</label><input type="text" value={webhookTitle} onChange={(e) => setWebhookTitle(e.target.value)} placeholder="📢 Объявление" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" /></div>
                <div><label className="block text-gray-400 mb-2">Сообщение</label><textarea value={webhookMessage} onChange={(e) => setWebhookMessage(e.target.value)} placeholder="Текст..." rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 resize-none text-white" /></div>
                <button onClick={sendWebhook} disabled={webhookLoading || !webhookUrl || !webhookMessage} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  {webhookLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}{webhookLoading ? 'Отправка...' : 'Отправить'}
                </button>
                {webhookResult && (<div className={`flex items-center gap-2 p-4 rounded-xl ${webhookResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>{webhookResult.success ? <CheckCircle /> : <XCircle />}<span>{webhookResult.message}</span></div>)}
              </div>
            </div>
          </motion.div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><FileText className="text-mushroom-neon" /> Заявки на роли</h3>
              {apps.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Пока нет заявок</p>
              ) : (
                <div className="space-y-4">
                  {apps.map((app) => (
                      <div key={app.id} className="p-5 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mushroom-neon/20 to-mushroom-purple/20 flex items-center justify-center font-bold text-mushroom-neon">
                              {app.username.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold">{app.username}</h4>
                              <p className="text-xs text-gray-400">На роль: <span className="text-mushroom-neon">{app.desired_role}</span></p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Мотивация</p>
                            <p className="text-gray-300">{app.reason}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Опыт</p>
                            <p className="text-gray-300">{app.experience}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Активность</p>
                            <p className="text-gray-300">{app.activity_hours}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">О себе</p>
                            <p className="text-gray-300">{app.about_me}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          {new Date(app.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    ))}
                  </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
