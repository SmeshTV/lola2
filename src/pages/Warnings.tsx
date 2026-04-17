import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, CheckCircle, Shield,
  Search, Ban, Clock, Loader2, Send,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { getCached, setCached } from '../lib/cache';

interface Warning {
  id: string;
  user_id: string;
  username: string;
  moderator_id: string;
  moderator_name: string;
  reason: string;
  created_at: string;
  active: boolean;
}

interface SearchResultUser {
  id: string;
  username: string;
  level: number;
}

const WarningsPage = () => {
  const { user, permissions, loading: authLoading, supabaseUser } = useAuth();
  const [warnings, setWarnings] = useState<Warning[]>(() => getCached('warnings_list_my') || []);
  const [allWarnings, setAllWarnings] = useState<Warning[]>(() => getCached('warnings_list') || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [showWarnForm, setShowWarnForm] = useState(false);
  const [warnReason, setWarnReason] = useState('');
  const [warnLoading, setWarnLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResultUser | null>(null);

  const isAdmin = permissions?.isAdmin;

  // Загрузка предупреждений
  useEffect(() => {
    if (authLoading) return;

    const loadWarnings = async () => {
      if (user) {
        const { data } = await supabase
          .from('warnings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        setWarnings(data || []);
        setCached('warnings_list_my', data || []);
      }

      if (isAdmin) {
        const { data } = await supabase
          .from('warnings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        setAllWarnings(data || []);
        setCached('warnings_list', data || []);
      }
    };

    loadWarnings();
  }, [user, authLoading, isAdmin]);

  const searchUsers = async () => {
    if (!searchTerm.trim()) return;
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('username', `%${searchTerm}%`)
      .limit(10);

    setSearchResults(data || []);
  };

  const addWarning = async () => {
    if (!selectedUser || !warnReason.trim() || !isAdmin) return;

    setWarnLoading(true);
    try {
      // Сохраняем варн
      const { error } = await supabase.from('warnings').insert([{
        user_id: selectedUser.id,
        username: selectedUser.username,
        moderator_id: supabaseUser?.id,
        moderator_name: user?.username || 'Admin',
        reason: warnReason.trim(),
        active: true,
      }]);

      if (error) throw error;

      // Отправляем в Discord через webhook
      const webhookUrl = import.meta.env.VITE_WARNINGS_WEBHOOK_URL;
      if (!webhookUrl) {
        logger.warn('VITE_WARNINGS_WEBHOOK_URL не настроен');
      } else {
        const userWarns = allWarnings.filter(w => w.user_id === selectedUser.id && w.active);
        const warnCount = userWarns.length + 1;

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '⚠️ Новое предупреждение',
              color: warnCount >= 3 ? 0xFF0000 : 0xFFA500,
              fields: [
                { name: 'Пользователь', value: selectedUser.username, inline: true },
                { name: 'Модератор', value: user?.username || 'Admin', inline: true },
                { name: 'Причина', value: warnReason.trim(), inline: false },
                { name: 'Предупреждений', value: `${warnCount}/3`, inline: true },
              ],
              footer: { text: warnCount >= 3 ? '⛔ ДОСТИГНУТ ЛИМИТ — РЕКОМЕНДУЕТСЯ БАН' : 'JuniperBot Warning System' },
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      }

      setWarnReason('');
      setSelectedUser(null);
      setShowWarnForm(false);

      // Обновляем
      const { data } = await supabase.from('warnings').select('*').order('created_at', { ascending: false }).limit(100);
      setAllWarnings(data || []);
      setCached('warnings_list', data || []);
    } catch (e: unknown) {
      logger.error('Warning error:', e);
    }
    setWarnLoading(false);
  };

  const removeWarning = async (warningId: string) => {
    if (!isAdmin) return;
    await supabase.from('warnings').update({ active: false }).eq('id', warningId);

    const { data } = await supabase.from('warnings').select('*').order('created_at', { ascending: false }).limit(100);
    setAllWarnings(data || []);
    setCached('warnings_list', data || []);
    if (user) {
      const { data: myWarnings } = await supabase.from('warnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setWarnings(myWarnings || []);
      setCached('warnings_list_my', myWarnings || []);
    }
  };

  const activeWarnings = warnings.filter(w => w.active);

  if (authLoading) return null;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-2">⚠️ Предупреждения</h1>
          <p className="text-gray-400">Система предупреждений JuniperBot</p>
        </motion.div>

        {/* Warning Level Badge */}
        {user && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`glass-card p-6 mb-8 border-l-4 ${
              activeWarnings.length >= 3 ? 'border-red-500 bg-red-500/5' :
              activeWarnings.length >= 1 ? 'border-orange-500 bg-orange-500/5' :
              'border-green-500 bg-green-500/5'
            }`}
          >
            <div className="flex items-center gap-4">
              {activeWarnings.length >= 3 ? <Ban className="text-red-500" size={40} /> :
               activeWarnings.length >= 1 ? <AlertTriangle className="text-orange-500" size={40} /> :
               <CheckCircle className="text-green-500" size={40} />}
              <div>
                <p className="text-lg font-bold">
                  {activeWarnings.length >= 3 ? '⛔ Критический уровень' :
                   activeWarnings.length >= 1 ? '⚠️ Есть предупреждения' :
                   '✅ Чисто'}
                </p>
                <p className="text-gray-400">
                  {activeWarnings.length}/3 предупреждений
                  {activeWarnings.length >= 3 && ' — рекомендуется бан'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="text-red-400" />
                Управление предупреждениями
              </h3>
              <button
                onClick={() => setShowWarnForm(!showWarnForm)}
                className="btn-primary flex items-center gap-2"
              >
                <AlertTriangle size={16} />
                Выдать предупреждение
              </button>
            </div>

            <AnimatePresence>
              {showWarnForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 rounded-xl p-4 mb-4 space-y-4"
                >
                  {/* Player Search */}
                  <div>
                    <label className="block text-gray-400 mb-2">Поиск игрока</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                        placeholder="Введи никнейм..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3"
                      />
                      <button onClick={searchUsers} disabled={!searchTerm.trim()} className="btn-primary px-4 disabled:opacity-50">
                        <Search size={18} />
                      </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                        {searchResults.map(u => {
                          const uWarns = allWarnings.filter(w => w.user_id === u.id && w.active).length;
                          const isSelected = selectedUser?.id === u.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => { setSelectedUser(u); setSearchTerm(u.username); }}
                              className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                                isSelected
                                  ? 'bg-mushroom-neon/20 border border-mushroom-neon/50'
                                  : 'bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mushroom-neon to-mushroom-purple flex items-center justify-center text-sm font-bold text-black">
                                  {u.username.charAt(0)}
                                </div>
                                <span className="font-medium">{u.username}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {uWarns > 0 && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    uWarns >= 3 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                  }`}>
                                    {uWarns}/3 ⚠️
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">Lvl {u.level}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {searchTerm && searchResults.length === 0 && (
                      <p className="text-gray-500 text-sm mt-2 text-center">Игрок не найден</p>
                    )}

                    {selectedUser && (
                      <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle size={14} />
                        <span>Выбран: <strong>{selectedUser.username}</strong></span>
                        <button onClick={() => { setSelectedUser(null); setSearchTerm(''); }} className="text-gray-500 hover:text-white ml-2">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-gray-400 mb-2">Причина предупреждения</label>
                    <textarea
                      value={warnReason}
                      onChange={(e) => setWarnReason(e.target.value)}
                      placeholder="Подробно опиши причину..."
                      rows={3}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 resize-none"
                    />
                  </div>

                  <button
                    onClick={addWarning}
                    disabled={warnLoading || !selectedUser || !warnReason.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {warnLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    {warnLoading ? 'Выдача...' : 'Выдать предупреждение'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <h4 className="font-bold text-gray-300 mb-3">Последние предупреждения</h4>
            <div className="space-y-2">
              {allWarnings.slice(0, 20).map(w => (
                <div key={w.id} className={`flex items-center justify-between p-3 rounded-xl ${
                  w.active ? 'bg-orange-500/5 border border-orange-500/20' : 'bg-gray-800/30 opacity-50'
                }`}>
                  <div className="flex items-center gap-3">
                    {w.active ? <AlertTriangle className="text-orange-400" size={18} /> : <CheckCircle className="text-green-400" size={18} />}
                    <div>
                      <p className="font-bold text-sm">{w.username}</p>
                      <p className="text-xs text-gray-400">{w.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Модератор: {w.moderator_name}</p>
                      <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString('ru-RU')}</p>
                    </div>
                    {w.active && (
                      <button
                        onClick={() => removeWarning(w.id)}
                        className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                        title="Снять предупреждение"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* User Warnings */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="text-mushroom-neon" />
              Мои предупреждения
            </h3>

            {activeWarnings.length > 0 ? (
              <div className="space-y-3">
                {activeWarnings.map(w => (
                  <div key={w.id} className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-orange-400 flex-shrink-0 mt-1" size={20} />
                      <div className="flex-1">
                        <p className="font-bold">{w.reason}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Выдал: <span className="text-mushroom-neon">{w.moderator_name}</span> • {new Date(w.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="text-red-400" size={20} />
                    <div>
                      <p className="font-bold text-red-400">Внимание!</p>
                      <p className="text-sm text-gray-300">
                        При 3 предупреждениях рекомендуется бан. Будь осторожен!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
                <p className="text-gray-400">У тебя нет предупреждений</p>
                <p className="text-sm text-gray-500 mt-1">Так держать! 🎉</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WarningsPage;
