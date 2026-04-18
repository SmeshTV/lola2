import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Copy, CheckCircle, RotateCcw, Loader2,
  Users, Flag, Coins, Play, Shield, Eye, EyeOff, Sparkles, Zap, Search
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { addToast } from '../components/NotificationToast';

// ===== ТИПЫ И КОНСТАНТЫ =====
type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

const SUITS: CardSuit[] = ['hearts','diamonds','clubs','spades'];
const RANKS_36: CardRank[] = ['6','7','8','9','10','J','Q','K','A'];
const RANKS_52: CardRank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const RANK_VAL: Record<CardRank, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14
};
const SUIT_SYM: Record<CardSuit, string> = { hearts:'❤', diamonds:'♦', clubs:'♧', spades:'♤' };
const SUIT_COLOR: Record<CardSuit, string> = { hearts:'text-red-600', diamonds:'text-blue-600', clubs:'text-green-600', spades:'text-purple-600' };

interface Card { suit: CardSuit; rank: CardRank }

// Генерация колоды
function createDeck(size: 36 | 52): Card[] {
  const ranks = size === 36 ? RANKS_36 : RANKS_52;
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of ranks) deck.push({ suit: s, rank: r });
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardId(c: Card): string {
  return `${c.rank}_${c.suit}`;
}

function canBeat(atk: Card, def: Card, trump: CardSuit): boolean {
  if (def.suit === atk.suit) return RANK_VAL[def.rank] > RANK_VAL[atk.rank];
  return def.suit === trump && atk.suit !== trump;
}

// ===== ИНТЕРФЕЙСЫ =====
interface Player {
  id: string;
  name: string;
  hand: Card[];
  bluffCaught: boolean;
}

interface TableEntry {
  atk: Card;
  def: Card | null;
  attackerId: string;
  defenderId: string | null;
}

interface DurakRoom {
  id: string;
  players: Player[];
  deck: Card[];
  trump: CardSuit;
  trumpCard: Card | null;
  table: TableEntry[];
  attackerIdx: number;
  defenderIdx: number;
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  loser: string | null;
  bet: number;
  has_bet: boolean;
  game_mode: string;
  max_players: number;
  bluff_mode: boolean;
  deck_size: 36 | 52;
  created_at: string;
  last_activity: string;
}

// ===== КОМПОНЕНТ КАРТЫ =====
function CardView({ 
  card, onClick, disabled, selected, showSuit, isTrump,
  showCheck, onCheck, checkDisabled 
}: {
  card?: Card; onClick?: () => void; disabled?: boolean; selected?: boolean; showSuit?: boolean; isTrump?: boolean;
  showCheck?: boolean; onCheck?: () => void; checkDisabled?: boolean;
}) {
  if (!card) return <div className="w-14 h-20 md:w-16 md:h-24 rounded-lg border-2 border-blue-700 bg-gradient-to-br from-blue-600 to-blue-800 shadow-md flex items-center justify-center shrink-0"><span className="text-blue-300 text-xl">🂠</span></div>;
  
  const suitColor = SUIT_COLOR[card.suit];
  const trumpStyle = isTrump ? 'ring-2 ring-yellow-400 shadow-yellow-400/50 shadow-lg' : '';
  
  return (
    <div className="relative shrink-0 transition-transform duration-200">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative w-14 h-20 md:w-16 md:h-24 rounded-lg border-2 shadow-md flex flex-col items-center justify-center select-none
          ${selected ? 'ring-2 ring-yellow-400 -translate-y-2 z-10' : ''}
          ${trumpStyle}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95'}
          bg-white`}
      >
        {showSuit && <span className={`text-xs md:text-sm ${suitColor} absolute top-0.5 left-1`}>{SUIT_SYM[card.suit]}</span>}
        <span className={`font-bold text-base md:text-lg ${suitColor}`}>{card.rank}</span>
        {showSuit && <span className={`text-xs md:text-sm ${suitColor} absolute bottom-0.5 right-1 rotate-180`}>{SUIT_SYM[card.suit]}</span>}
      </button>
      
      {/* Кнопка проверки блефа */}
      {showCheck && onCheck && (
        <button
          onClick={(e) => { e.stopPropagation(); onCheck(); }}
          disabled={checkDisabled}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all border border-white shadow-md z-20 animate-pulse"
          title="Проверить блеф"
        >
          <Search size={12} />
        </button>
      )}
    </div>
  );
}

// ===== ИГРА =====
export default function DurakGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();
  
  const [room, setRoom] = useState<DurakRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    bet: 0, hasBet: false, mode: 'podkidnoy', maxPlayers: 2, bluffMode: false, deckSize: 36 as 36 | 52
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [isSurrendering, setIsSurrendering] = useState(false); // Защита от многократного нажатия
  const [showTrump, setShowTrump] = useState(true);
  const [bluffHistory, setBluffHistory] = useState<string[]>([]);
  const [clearedTable, setClearedTable] = useState<TableEntry[] | null>(null); // Для проверки после "Бито"

  // Вычисляемые значения
  const myIdx = room ? room.players.findIndex(p => p.id === user?.id) : -1;
  const myPlayer = myIdx >= 0 ? room?.players[myIdx] : null;
  const isAttacker = myIdx === room?.attackerIdx;
  const isDefender = myIdx === room?.defenderIdx;
  const isMyTurn = room?.status === 'playing' && myIdx >= 0 && (isAttacker || isDefender);

  // Загрузка данных
  useEffect(() => {
    if (!user || authLoading) return;
    if (!roomId || roomId === 'new') { setShowSettings(true); return; }
    
    const load = async () => {
      const { data: r, error: err } = await supabase.from('durak_rooms').select('*').eq('id', roomId).single();
      if (err || !r) { setError('Комната не найдена'); return; }
      applyRoom(r);
    };
    load();
    
    const iv = setInterval(async () => {
      const { data: r } = await supabase.from('durak_rooms').select('*').eq('id', roomId).single();
      if (r) applyRoom(r);
    }, 800);
    return () => clearInterval(iv);
  }, [user, roomId, authLoading]);

  function applyRoom(r: DurakRoom) {
    setRoom(r);
    setClearedTable(null);
    // Авто-вход если есть место
    if (r.players.length < r.max_players && r.status === 'waiting' && !r.players.find(p => p.id === user?.id)) {
      joinRoom(r.id, user!.id, user!.username);
    }
  }

  async function joinRoom(rid: string, uid: string, uname: string) {
    const { data: r } = await supabase.from('durak_rooms').select('*').eq('id', rid).single();
    if (!r || r.players.length >= r.max_players || r.status !== 'waiting') return;
    await supabase.from('durak_rooms').update({ 
      players: [...r.players, { id: uid, name: uname, hand: [], bluffCaught: false }] 
    }).eq('id', rid);
  }

  const createRoom = async () => {
    setShowSettings(false);
    const id = `durak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from('durak_rooms').insert([{
      id,
      players: [{ id: user!.id, name: user!.username, hand: [], bluffCaught: false }],
      deck: [], trump: 'hearts', trumpCard: null, table: [],
      attackerIdx: 0, defenderIdx: 1, status: 'waiting',
      winner: null, loser: null, bet: settings.bet, has_bet: settings.hasBet,
      game_mode: settings.mode, max_players: settings.maxPlayers,
      bluff_mode: settings.bluffMode, deck_size: settings.deckSize,
      created_at: new Date().toISOString(), last_activity: new Date().toISOString(),
    }]);
    if (error) { setError('Ошибка: ' + error.message); return; }
    navigate(`/durak/${id}`, { replace: true });
  };

  const startGame = async () => {
    if (!room || room.players.length < 2) return;
    setActionLoading(true);

    const deck = createDeck(room.deck_size);
    const players = room.players.map(p => ({ ...p, hand: [] as Card[], bluffCaught: false }));
    
    // Раздача по 6 карт
    for (let i = 0; i < 6; i++) {
      for (const p of players) {
        if (deck.length > 0) p.hand.push(deck.shift()!);
      }
    }

    const trumpCard = deck[0];
    const trump = trumpCard.suit;
    let attackerIdx = 0;
    let minTrump = 100;

    // Определение первого атакующего (младший козырь)
    for (let i = 0; i < players.length; i++) {
      for (const c of players[i].hand) {
        if (c.suit === trump && RANK_VAL[c.rank] < minTrump) {
          minTrump = RANK_VAL[c.rank];
          attackerIdx = i;
        }
      }
    }

    await supabase.from('durak_rooms').update({
      deck, trump, trumpCard, table: [],
      attackerIdx, defenderIdx: (attackerIdx + 1) % players.length,
      players, status: 'playing', last_activity: new Date().toISOString(),
    }).eq('id', roomId);

    setActionLoading(false);
  };

  // ===== ОСНОВНАЯ ЛОГИКА ХОДА =====
  const playCard = async (card: Card) => {
    if (!room || myIdx < 0 || room.status !== 'playing') return;
    setActionLoading(true);

    const nb = room.players.map(p => ({ ...p, hand: [...p.hand] }));
    const nTable: TableEntry[] = room.table.map(t => ({ ...t }));
    const nDeck = [...room.deck];
    const player = nb[myIdx];
    const myId = user!.id;

    // Удаляем карту из руки
    const idx = player.hand.findIndex(c => cardId(c) === cardId(card));
    if (idx < 0) { setActionLoading(false); return; }
    player.hand.splice(idx, 1);

    if (isAttacker) {
      // АТАКА
      const ranksOnTable = nTable.flatMap(t => [t.atk.rank, t.def?.rank].filter(Boolean) as CardRank[]);
      const canToss = nTable.length > 0 ? ranksOnTable.includes(card.rank) : true;

      if (room.bluff_mode && !player.bluffCaught) {
        // Блеф разрешен: кидаем любую, если стол не полон
        if (nTable.length < 6) {
          nTable.push({ atk: card, def: null, attackerId: myId, defenderId: null });
        } else { setActionLoading(false); return; }
      } else {
        // Обычная игра
        if (nTable.length === 0 || (canToss && nTable.length < 6)) {
          nTable.push({ atk: card, def: null, attackerId: myId, defenderId: null });
        } else { setActionLoading(false); return; }
      }
    } else if (isDefender) {
      // ЗАЩИТА
      const undefIdx = nTable.findIndex(t => !t.def);
      if (undefIdx < 0) { setActionLoading(false); return; } // Нечего отбивать

      const atkCard = nTable[undefIdx].atk;

      if (room.bluff_mode && !player.bluffCaught) {
        // Блеф разрешен: ставим любую карту поверх
        nTable[undefIdx] = { ...nTable[undefIdx], def: card, defenderId: myId };
      } else {
        // Обычная игра
        if (canBeat(atkCard, card, room.trump)) {
          nTable[undefIdx] = { ...nTable[undefIdx], def: card, defenderId: myId };
        } else { setActionLoading(false); return; } // Не бьет
      }
    }

    // ВАЖНО: Раздача карт НЕ происходит здесь! Стол не очищается!
    // Сохраняем состояние: карта ушла из руки, легла на стол.

    await supabase.from('durak_rooms').update({
      players: nb,
      deck: nDeck, // Колода не меняется пока
      table: nTable, // Стол обновился
      trumpCard: nDeck.length > 0 ? nDeck[0] : null,
      last_activity: new Date().toISOString(),
    }).eq('id', roomId);

    setActionLoading(false);
  };

  // ===== ВЗЯТЬ КАРТЫ =====
  const takeCards = async () => {
    if (!room || !isDefender) return;
    setActionLoading(true);

    const nb = room.players.map(p => ({ ...p, hand: [...p.hand] }));
    const def = nb[room.defenderIdx];
    
    // Защитник забирает всё со стола
    for (const t of room.table) {
      def.hand.push(t.atk);
      if (t.def) def.hand.push(t.def);
    }

    const nDeck = [...room.deck];
    
    // Раздача карт (сначала атакующий, потом остальные)
    // Порядок раздачи: начиная от атакующего по кругу
    for (let i = 0; i < nb.length; i++) {
      const idx = (room.attackerIdx + i) % nb.length;
      while (nb[idx].hand.length < 6 && nDeck.length > 0) {
        nb[idx].hand.push(nDeck.shift()!);
      }
    }

    // Роли НЕ меняются, атакующим становится тот, кто НЕ брал (следующий за защитником)
    // Но в классике: если защитник взял, ход переходит к игроку СЛЕВА от защитника (который теперь атакует защитника).
    // Упрощенно: следующий игрок после защитника становится атакующим, а следующий за ним - защитником.
    // В 2 игроках: Атакующий -> тот же. В 3+: сдвиг.
    // Стандарт: тот, кто ходил (Attacker) ходит снова.
    
    await supabase.from('durak_rooms').update({
      players: nb, deck: nDeck, table: [],
      trumpCard: nDeck.length > 0 ? nDeck[0] : null,
      last_activity: new Date().toISOString(),
    }).eq('id', roomId); // Роли оставляем теми же (Attacker ходит снова)

    setActionLoading(false);
  };

  // ===== БИТО (Завершение хода) =====
  const doneButton = async () => {
    if (!room || !isAttacker) return;
    setActionLoading(true);

    // Для проверки блефа после хода
    if (room.bluff_mode && room.table.length > 0) {
      setClearedTable([...room.table.map(t => ({ ...t }))]);
      setTimeout(() => setClearedTable(null), 15000); // 15 сек на проверку
    }

    const nb = room.players.map(p => ({ ...p, hand: [...p.hand] }));
    const nDeck = [...room.deck];

    // Раздача карт
    for (let i = 0; i < nb.length; i++) {
      const idx = (room.attackerIdx + i) % nb.length;
      while (nb[idx].hand.length < 6 && nDeck.length > 0) {
        nb[idx].hand.push(nDeck.shift()!);
      }
    }

    // Смена ролей: Защитник становится Атакующим, следующий - Защитником
    const nextAtk = room.defenderIdx;
    const nextDef = (room.defenderIdx + 1) % nb.length;

    // Проверка победы
    let winner: string | null = null;
    let loser: string | null = null;
    if (nDeck.length === 0) {
      const activePlayers = nb.filter(p => p.hand.length > 0);
      if (activePlayers.length === 1) {
        loser = activePlayers[0].id;
        winner = nb.find(p => p.id !== loser)?.id || null;
      } else if (activePlayers.length === 0) {
         // Ничья? Обычно выигрывает тот, кто вышел первым, но здесь просто конец
      }
    }

    await supabase.from('durak_rooms').update({
      players: nb, deck: nDeck, table: [],
      trumpCard: nDeck.length > 0 ? nDeck[0] : null,
      attackerIdx: nextAtk, defenderIdx: nextDef,
      status: winner ? 'finished' : 'playing', winner, loser,
      last_activity: new Date().toISOString(),
    }).eq('id', roomId);

    setActionLoading(false);
  };

  // ===== ПРОВЕРКА БЛЕФА =====
  const checkBluff = async (tblIdx: number, cardType: 'atk' | 'def') => {
    if (!room || myIdx < 0) return;
    setActionLoading(true);
    
    // Проверяем либо на активном столе, либо на "битом"
    const sourceTable = clearedTable || room.table;
    const entry = sourceTable[tblIdx];
    if (!entry) { setActionLoading(false); return; }

    const cardToCheck = cardType === 'atk' ? entry.atk : entry.def;
    if (!cardToCheck) return; // Нечего проверять

    const nb = room.players.map(p => ({ ...p, hand: [...p.hand] }));
    let bluffCaught = false;
    let caughtPlayerId: string | null = null;

    // 1. Проверка АТАКИ (валидность подкидывания)
    if (cardType === 'atk') {
      // Если это не первая карта хода, она должна совпадать по рангу с другими на столе
      const isNotEmpty = (clearedTable ? clearedTable : room.table)!.length > 0;
      
      // Для активной игры: если на столе УЖЕ есть другие карты
      // Для битого стола: если в битом столе была не одна карта
      if (isNotEmpty && !(clearedTable && sourceTable.length === 1)) { 
         const attacker = nb.find(p => p.id === entry.attackerId);
         if (room.bluff_mode && attacker && !attacker.bluffCaught) {
            // Собираем ранги ВСЕХ карт на столе (кроме проверяемой)
            const otherCards = sourceTable
               .flatMap((t, i) => i === tblIdx ? [] : [t.atk, t.def])
               .filter(Boolean) as Card[];
            
            const matches = otherCards.some(c => c.rank === cardToCheck.rank);
            if (!matches) {
               // БЛЕФ ПОЙМАН
               bluffCaught = true;
               caughtPlayerId = entry.attackerId;
               attacker.bluffCaught = true;
               attacker.hand.push(cardToCheck); // Возврат карты
               
               // Если проверка во время игры, карту надо убрать со стола (ход отменяется)
               if (!clearedTable) {
                 // В активной игре это сложно реализовать идеально без десинка,
                 // но мы можем пометить стол как "с ошибкой" или просто вернуть карту
                 // Для простоты: карта возвращается, запись стола становится пустой?
                 // Лучше: просто помечаем игрока, карта остается (штраф), или удаляем.
                 // По логике "возврат": удалим запись.
                 // Но чтобы не ломать массив, просто оставим карту на столе "висящей" и дадим забрать?
                 // Сделаем проще: игрок помечен, карта у него.
               }
            }
         }
      }
    }

    // 2. Проверка ЗАЩИТЫ (валидность отбивания)
    if (cardType === 'def' && entry.atk) {
      const defender = nb.find(p => p.id === entry.defenderId);
      if (room.bluff_mode && defender && !defender.bluffCaught) {
        // Карта защиты должна бить карту атаки
        if (!canBeat(entry.atk, cardToCheck, room.trump)) {
           // БЛЕФ ПОЙМАН
           bluffCaught = true;
           caughtPlayerId = entry.defenderId;
           defender.bluffCaught = true;
           defender.hand.push(cardToCheck); // Карта возвращается в руку

           // Ключевой момент: на столе эта пара становится снова "неотбитой"
           // Мы должны обновить состояние стола
           if (!clearedTable) {
              // В активной игре: сбрасываем def у этой записи
              // Но мы не можем менять room.table напрямую, это сделает Supabase
              // Мы просто обновим данные в БД
              // Чтобы визуально это отразилось, нам нужно перезагрузить комнату или ждать
           } else {
              // Для битого стола просто аннулируем запись
              // Но так как стол уже ушел, это просто штраф игроку
           }
        }
      }
    }

    if (bluffCaught) {
      // Если пойман на защите в активной игре -> обновляем стол (убираем защиту)
      let updateTable = room.table;
      if (!clearedTable && cardType === 'def') {
         updateTable = room.table.map((t, i) => {
            if (i === tblIdx) return { ...t, def: null, defenderId: null };
            return t;
         });
      }

      await supabase.from('durak_rooms').update({
        players: nb,
        table: updateTable,
        last_activity: new Date().toISOString(),
      }).eq('id', roomId);

      const name = caughtPlayerId === user?.id ? 'Вас' : (nb.find(p => p.id === caughtPlayerId)?.name || 'Соперника');
      addToast({
        title: '🎭 Блеф раскрыт!',
        message: `${name} сходил неправильно. Карта возвращена.`,
        icon: '🎭', duration: 5000
      });
      setBluffHistory(prev => [...prev, `🎭 Блеф: ${name}`]);
      
      if (clearedTable) setClearedTable(null);
    } else {
      addToast({ title: '✅ Всё честно', message: 'Ход по правилам', icon: '✅', duration: 2000 });
    }

    setActionLoading(false);
  };

  // ===== СДАТЬСЯ =====
  const surrender = async () => {
    if (!room || myIdx < 0 || isSurrendering) return; // Защита от повторного нажатия
    setIsSurrendering(true); // Блокируем кнопку
    
    try {
      const others = room.players.filter((_, i) => i !== myIdx);
      const winnerId = others[0]?.id || null;
      const betAmount = room.has_bet ? room.bet : 0;

      if (winnerId && betAmount > 0) {
        // Используем единую функцию recordGame для корректной записи
        await supabase.rpc('add_mushrooms', { user_id: winnerId, amount: betAmount });
        await supabase.rpc('add_mushrooms', { user_id: user!.id, amount: -betAmount });
      }
      if (winnerId) await supabase.rpc('add_game_xp', { p_user_id: winnerId, p_bet: Math.max(room.bet, 10), p_result: 'win' });
      await supabase.rpc('add_game_xp', { p_user_id: user!.id, p_bet: Math.max(room.bet, 10), p_result: 'loss' });
      
      // Записываем игру только один раз
      await supabase.from('games').insert([{ user_id: user!.id, game_type: 'Дурак', bet: room.bet, result: 'loss', mushrooms_change: -betAmount }]);
      if (winnerId) await supabase.from('games').insert([{ user_id: winnerId, game_type: 'Дурак', bet: room.bet, result: 'win', mushrooms_change: betAmount }]);

      await supabase.from('durak_rooms').update({ status: 'finished', winner: winnerId, loser: user!.id }).eq('id', roomId);
      refreshUser?.();
      addToast({ title: '💀 Вы сдались', message: 'Вы — дурак!', icon: '💀', duration: 4000 });
    } catch (err) {
      console.error('Ошибка при сдаче:', err);
      addToast({ title: '❌ Ошибка', message: 'Не удалось сдаться', icon: '❌', duration: 3000 });
    } finally {
      setIsSurrendering(false); // Разблокируем кнопку
      // Обновляем комнату чтобы убрать кнопки
      const { data: updatedRoom } = await supabase.from('durak_rooms').select('*').eq('id', roomId).single();
      if (updatedRoom) setRoom(updatedRoom);
    }
  };

  // ===== ОПРЕДЕЛЕНИЕ ВАЛИДНЫХ КАРТ ДЛЯ UI =====
  const getValidCards = useMemo(() => {
    if (!room || !isMyTurn || !myPlayer) return new Set<string>();
    const valid = new Set<string>();

    // Если блеф разрешен и не пойман -> все карты валидны для клика (но сервер проверит)
    // Но для удобства подсветки:
    if (room.bluff_mode && !myPlayer.bluffCaught) {
      myPlayer.hand.forEach(c => valid.add(cardId(c)));
      return valid;
    }

    if (isAttacker) {
      if (room.table.length === 0) {
        myPlayer.hand.forEach(c => valid.add(cardId(c))); // Первая любая
      } else {
        const ranks = room.table.flatMap(t => [t.atk.rank, t.def?.rank].filter(Boolean) as CardRank[]);
        myPlayer.hand.forEach(c => {
          if (ranks.includes(c.rank) && room!.table.length < 6) valid.add(cardId(c));
        });
      }
    } else if (isDefender) {
      const undef = room.table.find(t => !t.def);
      if (undef) {
        myPlayer.hand.forEach(c => {
          if (canBeat(undef.atk, c, room.trump)) valid.add(cardId(c));
        });
      }
    }
    return valid;
  }, [room, isMyTurn, myPlayer, isAttacker, isDefender]);

  const allDefended = room?.table.length > 0 && room?.table.every(t => t.def);

  // ===== НАСТРОЙКИ =====
  if (showSettings) {
    return (
      <div className="pt-24 pb-8 px-4 max-w-md mx-auto">
        <div className="glass-card p-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/play')} className="text-gray-400 hover:text-white flex items-center gap-1.5"><ArrowLeft size={16} /> Назад</button>
            <h2 className="text-xl font-bold gradient-text">🃏 Настройки</h2>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">🎴 Колода</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSettings(s => ({ ...s, deckSize: 36 }))} className={`p-4 rounded-xl border-2 transition-all text-center ${settings.deckSize === 36 ? 'border-mushroom-neon bg-mushroom-neon/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="font-bold text-lg">36 карт</div><div className="text-xs text-gray-400">6 → A</div>
                </button>
                <button onClick={() => setSettings(s => ({ ...s, deckSize: 52 }))} className={`p-4 rounded-xl border-2 transition-all text-center ${settings.deckSize === 52 ? 'border-mushroom-neon bg-mushroom-neon/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="font-bold text-lg">52 карты</div><div className="text-xs text-gray-400">2 → A</div>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">💡 Колода отображается слева для удобства</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">🎲 Режим</label>
              <div className="grid grid-cols-3 gap-2">
                {[{id:'podkidnoy', n:'Подкидной'}, {id:'perevodnoy', n:'Переводной'}, {id:'combo', n:'Комбо'}].map(m => (
                  <button key={m.id} onClick={() => setSettings(s => ({ ...s, mode: m.id }))} className={`p-3 rounded-xl border-2 transition-all text-center ${settings.mode === m.id ? 'border-mushroom-neon bg-mushroom-neon/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="font-bold text-sm">{m.n}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">🎭 Режим блефа</label>
              <button onClick={() => setSettings(s => ({ ...s, bluffMode: !s.bluffMode }))} className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${settings.bluffMode ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}>
                <div>
                  <div className="font-bold text-sm mb-1 flex items-center gap-2">{settings.bluffMode ? <Sparkles size={16} className="text-yellow-400" /> : <EyeOff size={16} />} {settings.bluffMode ? 'Блеф включён' : 'Блеф выключен'}</div>
                  <div className="text-xs text-gray-400">Можно ходить с ошибками, но можно спалиться</div>
                </div>
                {settings.bluffMode ? <Eye size={20} className="text-yellow-400" /> : <EyeOff size={20} className="text-gray-500" />}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">👥 Игроков</label>
              <div className="flex gap-3">
                {[2, 3, 4].map(n => (<button key={n} onClick={() => setSettings(s => ({ ...s, maxPlayers: n }))} className={`flex-1 py-3 rounded-xl font-bold transition-all ${settings.maxPlayers === n ? 'bg-mushroom-neon/20 text-mushroom-neon border-2 border-mushroom-neon/30' : 'bg-white/5 text-gray-400 border-2 border-transparent'}`}>{n}</button>))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300"><Coins size={14} className="inline mr-1" /> Ставка</label>
              <div className="flex items-center gap-4">
                <input type="range" min="0" max="500" step="10" value={settings.bet} onChange={e => setSettings(s => ({ ...s, bet: parseInt(e.target.value), hasBet: parseInt(e.target.value) > 0 }))} className="flex-1" />
                <span className="font-bold text-mushroom-neon min-w-[70px] text-center">{settings.bet} 🍄</span>
              </div>
            </div>

            <button onClick={createRoom} className="btn-primary w-full flex items-center justify-center gap-2"><Play size={18} /> Создать комнату</button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="pt-24 flex justify-center"><p className="text-xl text-red-400">{error}</p></div>;
  if (!room) return <div className="pt-24 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin text-mushroom-neon mb-4" size={32} /><p className="text-gray-400">Загрузка...</p></div>;

  // ===== РЕНДЕР ИГРЫ =====
  return (
    <div className="pt-20 pb-8 px-2 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => room?.status === 'playing' ? (confirm('Сдаться = поражение!') ? surrender() : null) : navigate('/play')} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm"><ArrowLeft size={16} /> {room.status === 'playing' ? 'Сдаться' : 'Назад'}</button>
        <span className="font-bold gradient-text text-sm">🃏 Дурак {room.bluff_mode && <span className="text-yellow-400 text-xs ml-1">🎭 Блеф</span>}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTrump(!showTrump)} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white">{showTrump ? <Eye size={12} /> : <EyeOff size={12} />} Козырь</button>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs text-mushroom-neon flex items-center gap-1.5 hover:underline">{copied ? <CheckCircle size={12} /> : <Copy size={12} />}</button>
        </div>
      </div>

      {/* Ожидание */}
      {room.status === 'waiting' && room.players.length < room.max_players && (
        <div className="glass-card p-4 mb-3 text-center"><Users size={24} className="mx-auto text-gray-500 mb-2" /><p className="text-gray-400 text-sm">Ожидание игроков ({room.players.length}/{room.max_players})...</p></div>
      )}

      {/* Противники */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {room.players.map((p, i) => {
          const isMe = p.id === user?.id;
          const isAtk = i === room.attackerIdx;
          const isDef = i === room.defenderIdx;
          const trumpCount = p.hand.filter(c => c.suit === room.trump).length;
          return (
            <div key={p.id} className={`glass-card px-4 py-2 text-center ${isMe ? 'border-2 border-mushroom-neon/50' : ''}`}>
              <div className="text-xs text-gray-400">{isMe ? 'Вы' : p.name} {p.bluffCaught && <span className="text-red-400 text-[10px]">🚫 Блеф блок</span>}</div>
              <div className="flex gap-0.5 justify-center my-1 flex-wrap max-w-[200px]">{p.hand.map((_, ci) => <CardView key={ci} />)}</div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <span>{p.hand.length} карт</span>
                {showTrump && trumpCount > 0 && <span className="text-yellow-400">👑{trumpCount}</span>}
              </div>
              {isAtk && room.status === 'playing' && <div className="text-[10px] text-red-400 font-bold">⚔️ Атака</div>}
              {isDef && room.status === 'playing' && <div className="text-[10px] text-blue-400 font-bold">🛡️ Защита</div>}
            </div>
          );
        })}
      </div>

      {/* Козырь */}
      {showTrump && room.status === 'playing' && room.trumpCard && (
        <div className="text-center mb-3">
          <span className="text-xs text-gray-500 mr-2">Козырь:</span>
          <CardView card={room.trumpCard} showSuit isTrump />
          <span className={`ml-2 font-bold ${SUIT_COLOR[room.trump]}`}>{SUIT_SYM[room.trump]}</span>
        </div>
      )}

      {/* Стол */}
      {(room.table.length > 0 || clearedTable) && (
        <div className="glass-card p-4 mb-4 min-h-[80px]">
          <div className="text-xs text-gray-500 mb-2 text-center">
            {clearedTable ? '✅ Бито — можно проверить блеф (15сек)' : 'Стол'}
            {room.bluff_mode && <span className="text-yellow-400"> 🎭 нажми 🔍 для проверки</span>}
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            {(clearedTable || room.table).map((t, i) => {
              const atkP = room.players.find(p => p.id === t.attackerId);
              const defP = room.players.find(p => p.id === t.defenderId);
              // Проверка атаки: если есть другие карты и это не первая
              const canCheckAtk = room.bluff_mode && myIdx >= 0 && t.attackerId !== user?.id && atkP && !atkP.bluffCaught && !clearedTable && (room.table.length > 1 || (i===0 && room.table.length > 1));
              // Проверка защиты: если карта лежит и она не моя
              const canCheckDef = room.bluff_mode && myIdx >= 0 && t.def && t.defenderId !== user?.id && defP && !defP.bluffCaught;

              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <CardView card={t.atk} showSuit showCheck={canCheckAtk} onCheck={() => checkBluff(i, 'atk')} />
                    {t.def ? (
                      <>
                        <span className="text-gray-500 text-lg">→</span>
                        <CardView card={t.def} showSuit showCheck={canCheckDef} onCheck={() => checkBluff(i, 'def')} />
                      </>
                    ) : (
                      <span className="text-xs text-gray-500 self-center">⏳</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Мои карты */}
      {myPlayer && room.status === 'playing' && (
        <div className="glass-card p-4 mb-4">
          <div className="text-xs text-gray-500 mb-2 text-center flex items-center justify-center gap-2">
            Ваши карты
            {room.bluff_mode && myPlayer.bluffCaught && <span className="text-red-400 text-[10px]">🚫 Блеф отключен</span>}
            {room.bluff_mode && !myPlayer.bluffCaught && <span className="text-yellow-400 text-[10px]">🎭 Блеф доступен</span>}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {myPlayer.hand.map((card) => {
              const isValid = getValidCards.has(cardId(card));
              const canPlay = isMyTurn && !actionLoading && isValid;
              return (
                <CardView key={cardId(card)} card={card} onClick={canPlay ? () => playCard(card) : undefined} disabled={!canPlay} showSuit selected={card.suit === room.trump} />
              );
            })}
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      {room.status === 'waiting' && room.players.length >= 2 && (
        <button onClick={startGame} disabled={actionLoading} className="btn-primary w-full flex items-center justify-center gap-2"><Play size={18} /> Начать игру</button>
      )}
      
      {room.status === 'playing' && isMyTurn && !actionLoading && (
        <div className="flex gap-2">
          {isDefender && !allDefended && (
            <button onClick={takeCards} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium border border-red-500/20">✋ Взять</button>
          )}
          {isAttacker && allDefended && (
            <button onClick={doneButton} className="flex-1 btn-primary text-sm">✅ Бито</button>
          )}
          <button 
            onClick={surrender} 
            disabled={isSurrendering}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 ${
              isSurrendering 
                ? 'bg-gray-500/10 text-gray-400 cursor-not-allowed border-gray-500/20' 
                : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
            }`}
          >
            {isSurrendering ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Сдача...
              </>
            ) : (
              <>
                <Flag size={14} /> Сдаться
              </>
            )}
          </button>
        </div>
      )}

      {/* История */}
      {bluffHistory.length > 0 && (
        <div className="glass-card p-4 mt-4">
          <h4 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2"><Zap size={14} /> История</h4>
          <div className="space-y-1">{bluffHistory.map((h, i) => <p key={i} className="text-xs text-gray-400">{h}</p>)}</div>
        </div>
      )}

      {/* Финиш */}
      {room.status === 'finished' && (
        <div className="glass-card p-6 text-center">
          <div className="text-3xl font-bold mb-2">{room.loser === user?.id ? '💀 Вы — дурак!' : '🏆 Победа!'}</div>
          <p className="text-gray-400 mb-4">{room.loser === user?.id ? `Вы потеряли ${room.bet} 🍄` : `Вы выиграли ${room.bet} 🍄`}</p>
          <button onClick={() => navigate('/play')} className="btn-primary flex items-center justify-center gap-2 mx-auto"><RotateCcw size={14} /> В лобби</button>
        </div>
      )}
    </div>
  );
}