import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Copy, Play, Users, Globe, X, ArrowLeft, Loader2, Hand, Scissors, FileText, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/cache';

type RpsChoice = 'rock' | 'paper' | 'scissors';
type RoomStatus = 'waiting' | 'choosing' | 'revealed' | 'finished';

interface RpsRoom {
  id: string;
  name: string;
  host_id: string;
  host_name: string;
  guest_id: string | null;
  guest_name: string | null;
  host_choice: RpsChoice | null;
  guest_choice: RpsChoice | null;
  winner: string | null;
  status: RoomStatus;
  bet: number;
  is_private: boolean;
  created_at: string;
}

const CHOICES: { id: RpsChoice; emoji: string; label: string; icon: typeof Hand }[] = [
  { id: 'rock', emoji: '✊', label: 'Камень', icon: Hand },
  { id: 'paper', emoji: '✋', label: 'Бумага', icon: FileText },
  { id: 'scissors', emoji: '✌️', label: 'Ножницы', icon: Scissors },
];

const getWinner = (a: RpsChoice, b: RpsChoice): RpsChoice | 'draw' => {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return a;
  return b;
};

export default function GameRooms() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [rooms, setRooms] = useState<RpsRoom[]>(() => getCached('rps_rooms') || []);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // Create form
  const [newRoom, setNewRoom] = useState({ name: '', bet: 10, isPrivate: false });

  // Active room
  const [activeRoom, setActiveRoom] = useState<RpsRoom | null>(null);
  const [myChoice, setMyChoice] = useState<RpsChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const choiceMadeRef = useRef(false);

  // Load rooms
  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rps_rooms')
      .select('*')
      .eq('is_private', false) // НЕ показываем приватные комнаты
      .order('created_at', { ascending: false });

    // Фильтруем finished и пустые waiting комнаты
    const activeRooms = (data || []).filter(room =>
      room.status !== 'finished' &&
      !(room.status === 'waiting' && !room.guest_id &&
        new Date(room.created_at) < new Date(Date.now() - 5 * 60 * 1000)) // старше 5 минут
    );

    setRooms(activeRooms);
    setCached('rps_rooms', activeRooms);
  }, []);

  useEffect(() => {
    if (!user || authLoading) return;
    loadRooms();

    // Real-time subscription
    const channel = supabase
      .channel('rps_rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rps_rooms' },
        () => loadRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, loadRooms]);

  // If in a room, poll for updates to detect opponent choice reveal
  useEffect(() => {
    if (!activeRoom) return;

    const poll = async () => {
      // If room was deleted, exit
      const { data } = await supabase
        .from('rps_rooms')
        .select('*')
        .eq('id', activeRoom.id)
        .single();

      if (!data) {
        // Room was deleted - cleanup
        setActiveRoom(null);
        setMyChoice(null);
        setRevealed(false);
        choiceMadeRef.current = false;
        return;
      }
      
      const updated: RpsRoom = data;
      
      // Check if both chose
      const bothChose = updated.host_choice && updated.guest_choice;
      
      // If game just finished and we haven't revealed yet
      if (updated.status === 'finished' && bothChose && !revealed) {
        setRevealed(true);
      }

      setActiveRoom(updated);
    };

    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [activeRoom?.id, revealed]);

  const createRoom = async () => {
    if (!newRoom.name.trim() || !user) return;

    const { data, error } = await supabase
      .from('rps_rooms')
      .insert([{
        id: `rps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: newRoom.name.trim(),
        host_id: user.id,
        host_name: user.username,
        guest_id: null,
        guest_name: null,
        host_choice: null,
        guest_choice: null,
        winner: null,
        status: 'waiting',
        bet: newRoom.bet,
        is_private: newRoom.isPrivate,
      }])
      .select()
      .single();

    if (data && !error) {
      setActiveRoom(data);
      setShowCreate(false);
      setNewRoom({ name: '', bet: 10, isPrivate: false });
    }
  };

  const joinRoom = async (room: RpsRoom) => {
    if (!user) {
      alert('Войди в систему чтобы играть!');
      return;
    }

    if (room.host_id === user.id) {
      alert('Это твоя комната!');
      return;
    }

    console.log('🎮 Join room:', room.id, 'by', user.username);

    const { data, error } = await supabase
      .from('rps_rooms')
      .update({
        guest_id: user.id,
        guest_name: user.username,
        status: 'choosing',
      })
      .eq('id', room.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Join error:', error);
      alert('Ошибка подключения: ' + error.message);
      return;
    }

    if (data) {
      console.log('✅ Joined room:', data);
      setActiveRoom(data);
      setShowJoin(false);
      setJoinCode('');
    }
  };

  const leaveRoom = async () => {
    if (activeRoom?.status === 'waiting' && activeRoom.host_id === user?.id) {
      // Delete room if host leaves while waiting
      await supabase.from('rps_rooms').delete().eq('id', activeRoom.id);
    } else if (activeRoom?.status === 'finished') {
      // Delete finished room immediately
      await supabase.from('rps_rooms').delete().eq('id', activeRoom.id);
    }
    setActiveRoom(null);
    setMyChoice(null);
    setRevealed(false);
    choiceMadeRef.current = false;
  };

  const submitChoice = async (choice: RpsChoice) => {
    if (!activeRoom || !user || choiceMadeRef.current) return;
    
    // Проверяем что у игрока достаточно грибов
    if (user.mushrooms < activeRoom.bet) {
      alert('Недостаточно грибов!');
      return;
    }

    setSubmitting(true);
    choiceMadeRef.current = true;
    setMyChoice(choice);

    const isHost = activeRoom.host_id === user.id;
    const update: Record<string, unknown> = {
      [isHost ? 'host_choice' : 'guest_choice']: choice,
    };

    // If opponent already chose, reveal immediately
    const oppChoiceKey = isHost ? 'guest_choice' : 'host_choice';
    const oppChoiceValue = activeRoom[oppChoiceKey];
    
    if (oppChoiceValue) {
      // ОБА ВЫБРАЛИ — определяем победителя
      const myChoiceValue = choice;
      const winner = getWinner(myChoiceValue, oppChoiceValue);

      const bet = activeRoom.bet;
      let hostMushrooms = 0;
      let guestMushrooms = 0;

      if (winner === 'draw') {
        hostMushrooms = 0;
        guestMushrooms = 0;
      } else {
        const hostChoice = isHost ? myChoiceValue : oppChoiceValue;
        const guestChoice = isHost ? oppChoiceValue : myChoiceValue;
        const gameWinner = getWinner(hostChoice, guestChoice);
        
        if (gameWinner === hostChoice) {
          // Хост победил: получает свою ставку назад + ставку гостя
          hostMushrooms = bet;
          guestMushrooms = -bet;
        } else {
          // Гость победил: получает свою ставку назад + ставку хоста
          hostMushrooms = -bet;
          guestMushrooms = bet;
        }
      }

      const winnerId = winner === 'draw' ? null : (
        winner === (isHost ? myChoiceValue : oppChoiceValue)
          ? activeRoom.host_id
          : activeRoom.guest_id
      );

      console.log('🏆 Game finished:', {
        host: activeRoom.host_name,
        hostChoice: isHost ? myChoiceValue : oppChoiceValue,
        guest: activeRoom.guest_name,
        guestChoice: isHost ? oppChoiceValue : myChoiceValue,
        winner: winner,
        winnerId,
        hostMushrooms,
        guestMushrooms
      });

      // Update room to finished
      await supabase
        .from('rps_rooms')
        .update({
          ...update,
          winner: winner === 'draw' ? 'draw' : winnerId,
          status: 'finished',
        })
        .eq('id', activeRoom.id);

      // Update mushrooms via RPC
      try {
        if (hostMushrooms !== 0) {
          const { error: hostError } = await supabase.rpc('add_mushrooms', {
            user_id: activeRoom.host_id,
            amount: hostMushrooms
          });
          if (hostError) console.error('❌ Host mushrooms error:', hostError);
        }
        if (activeRoom.guest_id && guestMushrooms !== 0) {
          const { error: guestError } = await supabase.rpc('add_mushrooms', {
            user_id: activeRoom.guest_id,
            amount: guestMushrooms
          });
          if (guestError) console.error('❌ Guest mushrooms error:', guestError);
        }

        // Начисляем XP обоим игрокам
        const xpBet = Math.max(bet, 10);
        const hostResult = winner === 'draw' ? 'draw' : (winnerId === activeRoom.host_id ? 'win' : 'loss');
        const guestResult = winner === 'draw' ? 'draw' : (winnerId === activeRoom.guest_id ? 'win' : 'loss');
        
        await supabase.rpc('add_game_xp', {
          p_user_id: activeRoom.host_id,
          p_bet: xpBet,
          p_result: hostResult
        });
        
        if (activeRoom.guest_id) {
          await supabase.rpc('add_game_xp', {
            p_user_id: activeRoom.guest_id,
            p_bet: xpBet,
            p_result: guestResult
          });
        }
      } catch (e) {
        console.error('❌ Mushroom/XP update error:', e);
      }

      // Record games
      try {
        await supabase.from('games').insert([{
          user_id: activeRoom.host_id,
          game_type: 'Камень-Ножницы-Бумага',
          bet,
          result: winner === 'draw' ? 'draw' : (winnerId === activeRoom.host_id ? 'win' : 'loss'),
          mushrooms_change: hostMushrooms
        }]);
        
        if (activeRoom.guest_id) {
          await supabase.from('games').insert([{
            user_id: activeRoom.guest_id,
            game_type: 'Камень-Ножницы-Бумага',
            bet,
            result: winner === 'draw' ? 'draw' : (winnerId === activeRoom.guest_id ? 'win' : 'loss'),
            mushrooms_change: guestMushrooms
          }]);
        }
      } catch (e) {
        console.error('❌ Games record error:', e);
      }
    } else {
      // Waiting for opponent
      await supabase
        .from('rps_rooms')
        .update(update)
        .eq('id', activeRoom.id);
    }

    setSubmitting(false);

    // Refresh room state immediately
    const { data } = await supabase.from('rps_rooms').select('*').eq('id', activeRoom.id).single();
    if (data) {
      setActiveRoom(data);
      console.log('🔄 Room state updated:', data);
      
      // If game finished, mark as revealed
      if (data.status === 'finished' && data.host_choice && data.guest_choice) {
        setRevealed(true);
      }
    }
    
    // Also refresh user data to update mushrooms
    if (data?.status === 'finished') {
      await refreshUser();
      
      // УДАЛЯЕМ комнату после завершения игры с задержкой
      // Даём время обоим игрокам увидеть результат
      setTimeout(async () => {
        console.log('🗑️ Deleting finished room:', activeRoom.id);
        await supabase.from('rps_rooms').delete().eq('id', activeRoom.id);
        setActiveRoom(null);
        setMyChoice(null);
        setRevealed(false);
        choiceMadeRef.current = false;
      }, 5000); // 5 секунд чтобы увидеть результат
    }
  };

  const isHost = activeRoom?.host_id === user?.id;
  // const oppChoice = isHost ? activeRoom?.guest_choice : activeRoom?.host_choice;
  // const myChosen = isHost ? activeRoom?.host_choice : activeRoom?.guest_choice;

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <p className="text-2xl text-gray-400">Войдите через Discord</p>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-2">✊✋✌️ Камень-Ножницы-Бумага</h1>
          <p className="text-gray-400">Создай комнату или присоединись к PvP!</p>
        </motion.div>

        {/* Active Room */}
        {activeRoom ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8">
            <div className="flex items-center justify-between mb-6">
              <button onClick={leaveRoom} className="text-gray-400 hover:text-white flex items-center gap-2">
                <ArrowLeft size={18} /> Покинуть комнату
              </button>
              <div className="flex items-center gap-2">
                {activeRoom.is_private && (
                  <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm flex items-center gap-1">
                    🔒 Приватная
                  </span>
                )}
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                  Ставка: {activeRoom.bet} 🍄
                </span>
              </div>
            </div>

            {/* Players */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Player 1 (Host) */}
              <div className={`p-6 rounded-xl text-center border-2 ${isHost ? 'border-mushroom-neon bg-mushroom-neon/10' : 'border-white/10 bg-white/5'}`}>
                <p className="text-sm text-gray-400 mb-2">{isHost ? 'Ты (Хост)' : activeRoom.host_name}</p>
                <p className="font-bold text-lg mb-2">{activeRoom.host_name}</p>
                {activeRoom.status === 'finished' ? (
                  <div className="text-5xl">
                    {activeRoom.host_choice === 'rock' ? '✊' : activeRoom.host_choice === 'paper' ? '✋' : '✌️'}
                  </div>
                ) : isHost && myChoice ? (
                  <p className="text-mushroom-neon font-bold">Выбрано ✓</p>
                ) : isHost ? (
                  <p className="text-gray-600 text-sm">Твой ход ↓</p>
                ) : (
                  <p className="text-gray-600 text-sm">Ожидание...</p>
                )}
              </div>

              {/* Player 2 (Guest) */}
              <div className={`p-6 rounded-xl text-center border-2 ${!isHost ? 'border-mushroom-neon bg-mushroom-neon/10' : 'border-white/10 bg-white/5'}`}>
                {activeRoom.guest_id ? (
                  <>
                    <p className="text-sm text-gray-400 mb-2">{!isHost ? 'Ты' : activeRoom.guest_name}</p>
                    <p className="font-bold text-lg mb-2">{activeRoom.guest_name}</p>
                    {activeRoom.status === 'finished' ? (
                      <div className="text-5xl">
                        {activeRoom.guest_choice === 'rock' ? '✊' : activeRoom.guest_choice === 'paper' ? '✋' : '✌️'}
                      </div>
                    ) : !isHost && myChoice ? (
                      <p className="text-mushroom-neon font-bold">Выбрано ✓</p>
                    ) : !isHost ? (
                      <p className="text-gray-600 text-sm">Твой ход ↓</p>
                    ) : (
                      <p className="text-gray-600 text-sm">Ожидание...</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mb-2">Ожидание...</p>
                    <p className="font-bold text-lg mb-2 text-gray-500">?</p>
                    <p className="text-gray-600 text-sm">Противник не подключился</p>
                  </>
                )}
              </div>
            </div>

            {/* Result */}
            {activeRoom.status === 'finished' && activeRoom.winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-6"
              >
                <div className="text-6xl mb-4">
                  {activeRoom.winner === 'draw' ? '🤝' : activeRoom.winner === user?.id ? '🏆' : '💀'}
                </div>
                <h2 className="text-3xl font-bold mb-2">
                  {activeRoom.winner === 'draw' ? 'Ничья!' : activeRoom.winner === user?.id ? 'Победа!' : 'Поражение!'}
                </h2>
                <p className="text-xl text-gray-400">
                  {activeRoom.winner === 'draw'
                    ? 'Ничья — грибы возвращены'
                    : activeRoom.winner === user?.id
                      ? `+${activeRoom.bet} 🍄`
                      : `-${activeRoom.bet} 🍄`}
                </p>
              </motion.div>
            )}

            {/* Waiting for opponent */}
            {activeRoom.status === 'waiting' && (
              <div className="text-center mb-6">
                <Loader2 className="mx-auto animate-spin text-mushroom-neon mb-3" size={32} />
                <p className="text-xl text-gray-400">Ожидание противника...</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(activeRoom.id); }}
                  className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                >
                  <Copy size={16} /> Скопировать код комнаты
                </button>
              </div>
            )}

            {/* Choose phase */}
            {activeRoom.status === 'choosing' && !myChoice && activeRoom.guest_id && (
              <div className="text-center mb-6">
                <p className="text-xl font-bold mb-6">
                  {isHost ? 'Противник готов! Выбери свой ход!' : 'Выбери свой ход!'}
                </p>
                <div className="flex gap-4 justify-center">
                  {CHOICES.map(({ id, emoji, label }) => (
                    <button
                      key={id}
                      onClick={() => submitChoice(id)}
                      disabled={submitting}
                      className="glass-card p-6 rounded-xl hover:bg-mushroom-neon/10 hover:border-mushroom-neon/50 border-2 border-transparent transition-all cursor-pointer disabled:opacity-50 flex flex-col items-center gap-2 min-w-[120px]"
                    >
                      <span className="text-5xl">{emoji}</span>
                      <span className="font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Waiting for opponent to choose */}
            {activeRoom.status === 'choosing' && myChoice && !activeRoom.winner && (
              <div className="text-center mb-6">
                <Loader2 className="mx-auto animate-spin text-yellow-400 mb-3" size={32} />
                <p className="text-xl text-gray-400">Противник выбирает...</p>
              </div>
            )}

            {/* Both chose but game not finished yet */}
            {activeRoom.status === 'choosing' && activeRoom.host_choice && activeRoom.guest_choice && (
              <div className="text-center mb-6">
                <Loader2 className="mx-auto animate-spin text-mushroom-neon mb-3" size={32} />
                <p className="text-xl text-mushroom-neon font-bold">Раскрываем...</p>
              </div>
            )}

            {/* Waiting for opponent to connect */}
            {activeRoom.status === 'choosing' && !myChoice && !activeRoom.guest_id && (
              <div className="text-center mb-6">
                <Loader2 className="mx-auto animate-spin text-mushroom-neon mb-3" size={32} />
                <p className="text-xl text-gray-400">Ожидание противника...</p>
              </div>
            )}

            {/* Finished - back to lobby */}
            {activeRoom.status === 'finished' && (
              <div className="flex gap-3">
                <button onClick={leaveRoom} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Trophy size={18} /> Вернуться в лобби
                </button>
                <button
                  onClick={() => {
                    const bet = activeRoom.bet;
                    leaveRoom();
                    setShowCreate(true);
                    setNewRoom({ name: `Реванш ${user?.username}`, bet });
                  }}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-mushroom-purple to-mushroom-pink"
                >
                  🔄 Играть снова
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {/* Action Buttons */}
            <div className="flex gap-4 mb-8">
              <button onClick={() => setShowCreate(true)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Plus size={18} /> Создать комнату
              </button>
              <button onClick={() => setShowJoin(true)} className="btn-primary flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500">
                <Search size={18} /> Присоединиться
              </button>
            </div>

            {/* Game Info */}
            <div className="glass-card p-6 mb-8 flex items-center gap-6">
              <div className="text-6xl">✊✋✌️</div>
              <div>
                <h3 className="text-2xl font-bold mb-1">Камень-Ножницы-Бумага</h3>
                <p className="text-gray-400">Классическая PvP игра. Камень бьёт ножницы, ножницы режут бумагу, бумага накрывает камень.</p>
              </div>
            </div>

            {/* Room List */}
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Globe className="text-mushroom-neon" size={24} />
              Открытые комнаты
            </h3>
            {rooms.length > 0 ? (
              <div className="space-y-2">
                {rooms.map(room => (
                  <div key={room.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">✊✋✌️</span>
                      <div>
                        <p className="font-bold">{room.name}</p>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <Globe size={12} />
                          {room.host_name} • Ставка: {room.bet} 🍄
                        </p>
                      </div>
                    </div>
                    {room.status === 'waiting' && !room.guest_id ? (
                      <button onClick={() => joinRoom(room)} className="btn-primary text-sm">
                        Играть
                      </button>
                    ) : (
                      <span className="text-gray-500 text-sm">Играют...</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center">
                <Users className="mx-auto text-gray-500 mb-4" size={48} />
                <p className="text-xl text-gray-400 mb-2">Нет открытых комнат</p>
                <p className="text-gray-500">Создай первую комнату!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Создать комнату</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Название</label>
                  <input
                    type="text"
                    value={newRoom.name}
                    onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                    placeholder="Моя комната..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Ставка</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="500"
                      step="5"
                      value={newRoom.bet}
                      onChange={e => setNewRoom({ ...newRoom, bet: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="font-bold text-mushroom-neon min-w-[60px] text-center">{newRoom.bet} 🍄</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all bg-white/5 border-white/10 hover:bg-white/10">
                    <div>
                      <div className="text-sm font-bold text-white">🔒 Приватная комната</div>
                      <div className="text-xs text-gray-500">Видна только по коду, не в списке</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={newRoom.isPrivate}
                      onChange={e => setNewRoom(s => ({...s, isPrivate: e.target.checked}))}
                      className="w-5 h-5 rounded accent-green-500"
                    />
                  </label>
                </div>

                <button onClick={createRoom} disabled={!newRoom.name.trim()} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  <Play size={18} /> Создать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowJoin(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Присоединиться</h3>
                <button onClick={() => setShowJoin(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Код комнаты</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="Вставь код..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3"
                  />
                </div>

                <button
                  onClick={async () => {
                    if (!joinCode.trim()) return;
                    const { data } = await supabase.from('rps_rooms').select('*').eq('id', joinCode.trim()).single();
                    if (data && data.status === 'waiting' && !data.guest_id) {
                      joinRoom(data);
                    } else {
                      alert('Комната не найдена или уже заполнена');
                    }
                  }}
                  className="btn-primary w-full"
                >
                  Найти комнату
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
