import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Crown, ArrowLeft, Copy, CheckCircle, RotateCcw, Loader2,
  Users, Timer, Flag, Coins
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { addToast } from '../components/NotificationToast';

type Color = 'w' | 'b';
interface Piece { c: Color; k: boolean }
type Board = (Piece | null)[][];
type Pos = [number, number];
interface RulesConfig {
  kingFlying: boolean;
  captureBackwards: boolean;
  forcedCaptures: boolean;
  fastKings: boolean;
  mode: string;
}
const defaultRules: RulesConfig = {
  kingFlying: true,
  captureBackwards: true,
  forcedCaptures: true,
  fastKings: true,
  mode: 'russian',
};
const SZ = 8;

const initBoard = (): Board =>
  Array.from({ length: SZ }, (_, r) =>
    Array.from({ length: SZ }, (_, c) => {
      if ((r + c) % 2 === 1) {
        if (r < 3) return { c: 'b' as Color, k: false };
        if (r > 4) return { c: 'w' as Color, k: false };
      }
      return null;
    })
  );

// --- Classic: forward only, king moves 1, captures forward only ---
function getClassicMoves(b: Board, r: number, c: number, forced: Pos | null, rules: RulesConfig): Pos[] {
  const pc = b[r][c];
  if (!pc) return [];
  if (forced && (forced[0] !== r || forced[1] !== c)) return [];
  const out: Pos[] = [];
  if (pc.k) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = r+dr, nc = c+dc;
      if (nr>=0 && nr<SZ && nc>=0 && nc<SZ && !b[nr][nc] && !forced) out.push([nr,nc]);
      const jr = r+dr*2, jc = c+dc*2, mr = r+dr, mc = c+dc;
      if (jr>=0 && jr<SZ && jc>=0 && jc<SZ && !b[jr][jc] && b[mr][mc] && b[mr][mc]!.c !== pc.c)
        out.push([jr,jc]);
    }
  } else {
    const fwd = pc.c === 'w' ? -1 : 1;
    for (const dc of [-1,1]) {
      const nr = r+fwd, nc = c+dc;
      if (nr>=0 && nr<SZ && nc>=0 && nc<SZ && !b[nr][nc] && !forced) out.push([nr,nc]);
    }
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      if (!rules.captureBackwards && dr !== fwd) continue;
      const jr = r+dr*2, jc = c+dc*2, mr = r+dr, mc = c+dc;
      if (jr>=0 && jr<SZ && jc>=0 && jc<SZ && !b[jr][jc] && b[mr][mc] && b[mr][mc]!.c !== pc.c)
        out.push([jr,jc]);
    }
  }
  return out;
}

// --- Russian: captures backward, king flies ---
function getRussianMoves(b: Board, r: number, c: number, forced: Pos | null, rules: RulesConfig): Pos[] {
  const pc = b[r][c];
  if (!pc) return [];
  if (forced && (forced[0] !== r || forced[1] !== c)) return [];
  const out: Pos[] = [];
  if (pc.k) {
    if (!rules.kingFlying) {
      return getClassicMoves(b, r, c, forced, rules);
    }
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let s = 1;
      while (true) {
        const nr = r+dr*s, nc = c+dc*s;
        if (nr<0||nr>=SZ||nc<0||nc>=SZ) break;
        if (b[nr][nc]) {
          if (b[nr][nc]!.c !== pc.c) {
            let l = 2;
            while (true) {
              const lr = nr+dr*l, lc = nc+dc*l;
              if (lr<0||lr>=SZ||lc<0||lc>=SZ||b[lr][lc]) break;
              out.push([lr,lc]);
              l++;
            }
          }
          break;
        }
        if (!forced) out.push([nr,nc]);
        s++;
      }
    }
  } else {
    const fwd = pc.c === 'w' ? -1 : 1;
    for (const dc of [-1,1]) {
      const nr = r+fwd, nc = c+dc;
      if (nr>=0 && nr<SZ && nc>=0 && nc<SZ && !b[nr][nc] && !forced) out.push([nr,nc]);
    }
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      if (!rules.captureBackwards && dr !== fwd) continue;
      const jr = r+dr*2, jc = c+dc*2, mr = r+dr, mc = c+dc;
      if (jr>=0 && jr<SZ && jc>=0 && jc<SZ && !b[jr][jc] && b[mr][mc] && b[mr][mc]!.c !== pc.c)
        out.push([jr,jc]);
    }
  }
  return out;
}

function getMovesFn(b: Board, r: number, c: number, forced: Pos | null, rules: RulesConfig): Pos[] {
  return rules.mode === 'russian' ? getRussianMoves(b, r, c, forced, rules) : getClassicMoves(b, r, c, forced, rules);
}

function hasJumps(b: Board, color: Color, rules: RulesConfig): boolean {
  for (let r = 0; r < SZ; r++)
    for (let c = 0; c < SZ; c++)
      if (b[r][c]?.c === color)
        if (getMovesFn(b, r, c, null, rules).some(m => Math.abs(m[0]-r)>=2 || Math.abs(m[1]-c)>=2)) return true;
  return false;
}

function cnt(b: Board, color: Color) {
  let n = 0;
  for (let r = 0; r < SZ; r++) for (let c = 0; c < SZ; c++) if (b[r][c]?.c === color) n++;
  return n;
}

interface Room {
  id: string; name: string;
  player_white: string; player_white_name: string;
  player_black: string | null; player_black_name: string | null;
  board_state: Board; current_turn: Color;
  status: string; winner: Color | null;
  must_jump: Pos | null;
  bet: number; has_bet: boolean; game_mode: string;
  rules_config: { kingFlying: boolean; captureBackwards: boolean; forcedCaptures: boolean; fastKings: boolean; mode: string } | null;
  created_at: string; last_activity: string;
  reset_requested_by: string | null;
}

export default function CheckersOnline() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();

  // UI state
  const [room, setRoom] = useState<Room | null>(null);
  const [myColor, setMyColor] = useState<Color | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    bet: 0,
    hasBet: false,
    gameMode: 'russian' as string,
    kingFlying: true,      // Дамка летает
    captureBackwards: true, // Ест назад
    forcedCaptures: true,   // Обязательное взятие
    fastKings: true,        // Быстрые дамки
  });
  const [board, setBoard] = useState<Board>(initBoard());
  const [turn, setTurn] = useState<Color>('w');
  const [sel, setSel] = useState<Pos | null>(null);
  const [vMoves, setVMoves] = useState<Pos[]>([]);
  const [forced, setForced] = useState<Pos | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const busy = useRef(false);
  const modeRef = useRef('russian');

  // --- Create room ---
  if (roomId === 'new' && !showSettings) {
    setShowSettings(true);
  }

  useEffect(() => {
    if (!user || authLoading) return;
    if (!roomId || roomId === 'new') return;

    let cancelled = false;

    const load = async () => {
      const { data: r } = await supabase.from('checkers_rooms').select('*').eq('id', roomId).single();
      if (!r) { if (!cancelled) setError('Комната не найдена'); return; }
      applyRoom(r);
    };
    load();

    const sub = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkers_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (!cancelled) applyRoom(payload.new as Room);
        }
      )
      .subscribe();

    const iv = setInterval(async () => {
      const { data: r } = await supabase.from('checkers_rooms').select('*').eq('id', roomId).single();
      if (r && !cancelled) applyRoom(r);
    }, 2000);

    return () => { cancelled = true; clearInterval(iv); supabase.removeChannel(sub); };
  }, [user, roomId, authLoading]);

  const myColorRef = useRef<Color | null>(null);

  function applyRoom(r: Room) {
    modeRef.current = r.rules_config?.mode || r.game_mode || 'russian';
    setRoom(r);
    setBoard(r.board_state);
    setTurn(r.current_turn);
    setWinner(r.winner);
    setForced(r.must_jump);
    setSel(null);
    setVMoves([]);
    busy.current = false;

    // Определяем мой цвет (только один раз)
    if (!myColorRef.current) {
      if (r.player_white === user?.id) {
        myColorRef.current = 'w';
        setMyColor('w');
      } else if (r.player_black === user?.id) {
        myColorRef.current = 'b';
        setMyColor('b');
      } else if (!r.player_black && user) {
        myColorRef.current = 'b';
        setMyColor('b');
        supabase.from('checkers_rooms').update({
          player_black: user.id,
          player_black_name: user.username,
          status: 'playing',
          last_activity: new Date().toISOString(),
        }).eq('id', roomId);
      } else if (r.player_black && r.player_white !== user?.id) {
        setError('Комната заполнена');
      }
    }

    if (r.last_activity) {
      const elapsed = Math.floor((Date.now() - new Date(r.last_activity).getTime()) / 1000);
      setTimeLeft(Math.max(0, 600 - elapsed));
    }
  }

  // Timer
  useEffect(() => {
    if (!room || room.status !== 'playing' || winner) return;
    if (timeLeft <= 0) {
      const w = turn === 'w' ? 'b' : 'w';
      endGame(w);
      return;
    }
    const iv = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(iv);
  }, [timeLeft, room?.status, winner, turn]);

  // Flip
  useEffect(() => { if (myColorRef.current) setFlipped(myColorRef.current === 'b'); }, []);

  async function endGame(winColor: Color) {
    if (!room) return;
    const wId = winColor === 'w' ? room.player_white : room.player_black;
    const lId = winColor === 'w' ? room.player_black : room.player_white;
    const mushrooms = room.has_bet ? room.bet : 5;

    // Начисляем XP обоим игрокам за игру
    const xpBet = Math.max(room.bet, 10);
    if (wId) {
      await supabase.rpc('add_mushrooms', { user_id: wId, amount: mushrooms });
      await supabase.rpc('add_game_xp', { p_user_id: wId, p_bet: xpBet, p_result: 'win' });
    }
    if (lId) {
      if (room.has_bet) await supabase.rpc('add_mushrooms', { user_id: lId, amount: -room.bet });
      await supabase.rpc('add_game_xp', { p_user_id: lId, p_bet: xpBet, p_result: 'loss' });
    }

    await supabase.from('checkers_rooms').update({ status: 'finished', winner: winColor }).eq('id', roomId);
    setWinner(winColor);
    refreshUser?.();
    addToast({
      title: winColor === myColorRef.current ? '🏆 Победа!' : '💀 Поражение',
      message: winColor === myColorRef.current ? `+${mushrooms} 🍄` : 'Время вышло / соперник сдался',
      icon: winColor === myColorRef.current ? '🏆' : '💀', duration: 5000,
    });
  }

  function doMove(from: Pos, to: Pos) {
    if (!room) return;
    busy.current = true;
    const nb = board.map(r => [...r]);
    const pc = { ...nb[from[0]][from[1]]! };
    nb[from[0]][from[1]] = null;
    nb[to[0]][to[1]] = pc;

    let captured = false;
    const dr = Math.sign(to[0]-from[0]), dc = Math.sign(to[1]-from[1]);
    if (room.game_mode === 'russian' && pc.k) {
      let cr = from[0]+dr, cc = from[1]+dc;
      while (cr !== to[0] || cc !== to[1]) { if (nb[cr][cc]) { nb[cr][cc]=null; captured=true; } cr+=dr; cc+=dc; }
    } else if (Math.abs(to[0]-from[0]) === 2) {
      nb[from[0]+dr][from[1]+dc] = null; captured = true;
    }

    if ((pc.c==='w' && to[0]===0) || (pc.c==='b' && to[0]===7)) pc.k = true;

    let next: Color = turn==='w' ? 'b' : 'w';
    let nf: Pos | null = null;
    if (captured) {
      const rules = room.rules_config || defaultRules;
      const fj = getMovesFn(nb, to[0], to[1], to, rules)
        .filter(m => Math.abs(m[0]-to[0])>=2 || Math.abs(m[1]-to[1])>=2);
      if (fj.length > 0) { next = turn; nf = to; }
    }

    let nw: Color | null = null;
    if (cnt(nb,'w')===0) nw = 'b';
    if (cnt(nb,'b')===0) nw = 'w';

    supabase.from('checkers_rooms').update({
      board_state: nb, current_turn: next, winner: nw,
      must_jump: nf, status: nw ? 'finished' : 'playing',
      last_activity: new Date().toISOString(),
    }).eq('id', roomId);

    if (nw) endGame(nw);

    setBoard(nb); setTurn(next); setWinner(nw); setForced(nf);
    setSel(nf ? to : null);
    const nextRules = room.rules_config || defaultRules;
    setVMoves(nf ? getMovesFn(nb, to[0], to[1], to, nextRules).filter(m => Math.abs(m[0]-to[0])>=2) : []);
    setTimeLeft(600);
  }

  function tap(r: number, c: number) {
    if (winner || !myColorRef.current || turn !== myColorRef.current || busy.current || !room) return;
    const rules = room.rules_config || defaultRules;
    const pc = board[r][c];
    
    // Если кликнули на допустимый ход - выполняем
    if (sel && vMoves.some(m => m[0]===r && m[1]===c)) {
      doMove(sel, [r,c]);
      return;
    }
    
    // Если кликнули на свою шашку - выбираем её
    if (pc?.c === myColorRef.current) {
      const hj = rules.forcedCaptures && hasJumps(board, myColorRef.current, rules);
      const forcedSelection = forced ? forced : (hj ? [r,c] : null);
      const m = getMovesFn(board, r, c, forcedSelection, rules);
      setSel([r,c]);
      setVMoves(m);
      return;
    }
    
    // Кликнули на пустую клетку или вражескую шашку без выбора - сбрасываем
    setSel(null);
    setVMoves([]);
  }

  const createRoom = async () => {
    setShowSettings(false);
    const id = `checkers-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const rulesConfig = {
      kingFlying: settings.kingFlying,
      captureBackwards: settings.captureBackwards,
      forcedCaptures: settings.forcedCaptures,
      fastKings: settings.fastKings,
      mode: settings.gameMode,
    };
    const { error } = await supabase.from('checkers_rooms').insert([{
      id, name: 'Шашки', player_white: user!.id, player_white_name: user!.username,
      player_black: null, player_black_name: null, board_state: initBoard(),
      current_turn: 'w', status: 'waiting', winner: null, must_jump: null,
      bet: settings.bet, has_bet: settings.hasBet, game_mode: settings.gameMode,
      rules_config: rulesConfig,
      created_at: new Date().toISOString(), last_activity: new Date().toISOString(),
      reset_requested_by: null,
    }]);
    if (error) { setError('Ошибка: '+error.message); return; }
    navigate(`/checkers-online/${id}`, { replace: true });
  };

  const surrender = () => {
    if (!room || winner || !myColorRef.current) return;
    endGame(myColorRef.current === 'w' ? 'b' : 'w');
  };

  const requestReset = async () => {
    if (!room || !user) return;
    if (room.reset_requested_by === user.id) {
      await supabase.from('checkers_rooms').update({
        board_state: initBoard(), current_turn: 'w', status: 'playing',
        winner: null, must_jump: null, reset_requested_by: null,
        last_activity: new Date().toISOString(),
      }).eq('id', roomId);
      setBoard(initBoard()); setTurn('w'); setWinner(null); setForced(null);
      setSel(null); setVMoves([]); setTimeLeft(600);
      addToast({ title:'🔄 Сброшено!', message:'Начинаем заново', icon:'🔄', duration:4000 });
    } else {
      await supabase.from('checkers_rooms').update({ reset_requested_by: user.id }).eq('id', roomId);
      addToast({ title:'Запрос на сброс', message:'Ждём соперника...', icon:'🔄', duration:3000 });
    }
  };

  // --- Settings screen ---
  if (showSettings && roomId === 'new') {
    return (
      <div className="pt-24 pb-8 px-4 max-w-md mx-auto">
        <div className="glass-card p-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => { setShowSettings(false); navigate('/play'); }} className="text-gray-400 hover:text-white flex items-center gap-1.5"><ArrowLeft size={16}/> Назад</button>
            <h2 className="text-xl font-bold gradient-text">⚙️ Настройки</h2>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">🎲 Режим игры</label>
              <div className="grid grid-cols-2 gap-3">
                {['russian', 'classic'].map(mode => (
                  <button key={mode} onClick={() => setSettings(s=>({...s,gameMode:mode}))}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${settings.gameMode===mode?'border-mushroom-neon bg-mushroom-neon/10':'border-white/10 bg-white/5'}`}>
                    <div className="font-bold text-sm mb-1">{mode==='russian'?'🇷🇺 Русские':'🏛️ Классические'}</div>
                    <div className="text-xs text-gray-400">{mode==='russian'?'Ест назад, дамка летает':'Ест вперёд, дамка на 1'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">⚙️ Правила</label>
              <div className="space-y-3">
                {[
                  { key: 'forcedCaptures', label: '🎯 Обязательное взятие', desc: 'Если можно съесть — обязательно ешь' },
                  { key: 'captureBackwards', label: '🔄 Взятие назад', desc: 'Простая шашка ест назад' },
                  { key: 'kingFlying', label: '✈️ Летающая дамка', desc: 'Дамка ходит на любое число клеток' },
                  { key: 'fastKings', label: '⚡ Быстрые дамки', desc: 'Дамка ест и назад тоже' },
                ].map(opt => (
                  <label key={opt.key} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    settings[opt.key as keyof typeof settings]
                      ? 'bg-mushroom-neon/5 border-mushroom-neon/30'
                      : 'bg-white/5 border-white/10'
                  }`}>
                    <div>
                      <div className="text-sm font-bold text-white">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                    <input type="checkbox" checked={!!settings[opt.key as keyof typeof settings]}
                      onChange={e => setSettings(s => ({...s, [opt.key]: e.target.checked}))}
                      className="w-5 h-5 rounded accent-green-500" />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300"><Coins size={14} className="inline mr-1"/>Ставка</label>
              <div className="flex items-center gap-4">
                <input type="range" min="0" max="500" step="10" value={settings.bet}
                  onChange={e => setSettings(s=>({...s, bet: parseInt(e.target.value), hasBet: parseInt(e.target.value)>0}))}
                  className="flex-1"/>
                <span className="font-bold text-mushroom-neon min-w-[70px] text-center">{settings.bet} 🍄</span>
              </div>
            </div>
            <button onClick={createRoom} className="btn-primary w-full flex items-center justify-center gap-2">
              <Users size={18}/> Создать комнату
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="pt-24 flex justify-center"><p className="text-xl text-red-400">{error}</p></div>;
  if (!room) return <div className="pt-24 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin text-mushroom-neon mb-4" size={32}/><p className="text-gray-400">Загрузка...</p></div>;

  const myTurn = turn === myColorRef.current && !winner;
  const wCnt = cnt(board,'w'), bCnt = cnt(board,'b');
  const coords = ['a','b','c','d','e','f','g','h'];
  const mins = Math.floor(timeLeft/60), secs = timeLeft%60;
  const resetByOther = room.reset_requested_by && room.reset_requested_by !== user?.id;
  const rules = room.rules_config;

  return (
    <div className="pt-20 pb-8 px-2 max-w-lg mx-auto">
      {/* Top */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => winner || room.status !== 'playing' ? navigate('/play') : surrender()}
          className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16}/> {winner || room.status !== 'playing' ? 'Назад' : 'Сдаться'}
        </button>
        <span className="font-bold gradient-text text-sm">🏁 Шашки</span>
        <div className="flex items-center gap-2">
          {room.status==='playing' && !winner && (
            <div className={`flex items-center gap-1 text-sm ${timeLeft<60?'text-red-400 animate-pulse':'text-gray-400'}`}>
              <Timer size={14}/>{mins}:{secs.toString().padStart(2,'0')}
            </div>
          )}
        </div>
      </div>

      {/* Rules info */}
      {rules && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {rules.forcedCaptures && <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400">🎯 Взятие обязательно</span>}
          {rules.captureBackwards && <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-400">🔄 Ест назад</span>}
          {rules.kingFlying && <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400">✈️ Летающая дамка</span>}
          {room.has_bet && <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs text-yellow-400">{room.bet} 🍄</span>}
          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">{rules.mode === 'russian' ? '🇷🇺 Русские' : '🏛️ Классика'}</span>
        </div>
      )}

      {/* Room code */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2 mb-3">
        <span className="text-xs text-gray-500 font-mono">ID: {roomId?.slice(0,12)}</span>
        <button onClick={() => {navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(()=>setCopied(false),2000);}}
          className="text-xs text-mushroom-neon flex items-center gap-1.5 hover:underline">
          {copied ? <><CheckCircle size={12}/> Скопировано!</> : <><Copy size={12}/> Ссылка</>}
        </button>
      </div>

      {/* Waiting */}
      {!room.player_black && (
        <div className="glass-card p-4 mb-3 text-center">
          <Users size={24} className="mx-auto text-gray-500 mb-2"/>
          <p className="text-gray-400 text-sm">Ожидание второго игрока...</p>
          {room.has_bet && <p className="text-mushroom-neon text-sm mt-2"><Coins size={14} className="inline"/> Ставка: {room.bet} 🍄</p>}
        </div>
      )}

      {/* Players */}
      <div className="flex gap-3 mb-3">
        <div className={`flex-1 p-3 rounded-xl ${myColorRef.current==='w'?'bg-mushroom-neon/10 border-2 border-mushroom-neon/40':'bg-white/5 border border-white/10'}`}>
          <div className="flex items-center gap-2 mb-1"><div className="w-5 h-5 rounded-full bg-gradient-to-br from-white to-gray-300 border border-gray-400"/><span className="text-xs text-gray-400">Белые</span></div>
          <p className="font-bold text-sm truncate">{room.player_white_name}</p>
          <p className="text-xs text-gray-500">⚪ {wCnt}</p>
          {turn==='w'&&!winner && <p className="text-xs text-mushroom-neon font-bold mt-1 animate-pulse">⏳</p>}
        </div>
        <div className={`flex-1 p-3 rounded-xl ${myColorRef.current==='b'?'bg-mushroom-neon/10 border-2 border-mushroom-neon/40':'bg-white/5 border border-white/10'}`}>
          <div className="flex items-center gap-2 mb-1"><div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-600 to-black border border-gray-600"/><span className="text-xs text-gray-400">Чёрные</span></div>
          <p className="font-bold text-sm truncate">{room.player_black_name || 'Ожидание...'}</p>
          <p className="text-xs text-gray-500">⚫ {bCnt}</p>
          {turn==='b'&&!winner && <p className="text-xs text-mushroom-neon font-bold mt-1 animate-pulse">⏳</p>}
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-3">
        {winner ? (
          <span className="text-2xl font-bold">{winner===myColorRef.current ? '🏆 Победа!':'💀 Поражение'}</span>
        ) : myTurn ? (
          <p className="text-mushroom-neon font-bold text-lg">Ваш ход!</p>
        ) : room.status==='waiting' ? (
          <p className="text-yellow-400">Ожидание...</p>
        ) : (
          <p className="text-yellow-400 animate-pulse">Ход соперника...</p>
        )}
      </div>

      {/* Board */}
      <div className="rounded-xl shadow-2xl overflow-hidden border-4 border-amber-950 mx-auto relative" style={{aspectRatio:'1/1'}}>
        <div className="absolute top-0 left-0 right-0 flex z-10">
          {(flipped?[...coords].reverse():coords).map(l=><div key={l} className="flex-1 text-center text-[10px] text-amber-200/60 font-bold py-0.5">{l}</div>)}
        </div>
        <div className="grid grid-cols-8 w-full h-full pt-4 pl-4">
          {Array.from({length:SZ},(_,dr)=>Array.from({length:SZ},(_,dc)=>{
            const r = flipped?SZ-1-dr:dr, c = flipped?SZ-1-dc:dc;
            const pc = board[r][c];
            const dark = (r+c)%2===1;
            const isSel = sel?.[0]===r && sel?.[1]===c;
            const canGo = vMoves.some(m=>m[0]===r&&m[1]===c);
            const mine = pc?.c===myColorRef.current && myTurn;
            return (
              <div key={`${r}-${c}`} className={`relative flex items-center justify-center ${dark?'bg-[#B58863]':'bg-[#F0D9B5]'}`} style={{aspectRatio:'1/1'}} onClick={()=>dark&&tap(r,c)}>
                {c===(flipped?SZ-1:0) && <span className="absolute top-0.5 left-0.5 text-[9px] text-amber-200/40 font-bold">{SZ-r}</span>}
                {canGo && <div className="absolute inset-0 flex items-center justify-center z-10"><div className="w-[35%] h-[35%] rounded-full bg-green-500/70 shadow-lg"/></div>}
                {pc && (
                  <div className={`rounded-full flex items-center justify-center transition-all ${mine?'cursor-pointer hover:scale-105 active:scale-95':''} ${isSel?'ring-4 ring-mushroom-neon ring-offset-2 z-20':''}`} style={{width:'82%',height:'82%'}}>
                    <div className={`w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 ${pc.c==='w'?'bg-gradient-to-br from-white to-gray-300 border-gray-400':'bg-gradient-to-br from-gray-600 to-black border-gray-600'}`}>
                      {pc.k && <Crown className={pc.c==='w'?'text-yellow-700':'text-yellow-400'} size={16}/>}
                    </div>
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>

      <div className="flex justify-between px-3 py-2 mt-2 text-xs text-gray-500">
        <span>⚪ Съели: <b className="text-mushroom-neon">{12-wCnt}</b></span>
        <span>⚫ Съели: <b className="text-mushroom-neon">{12-bCnt}</b></span>
      </div>

      {/* Controls */}
      {winner ? (
        <button onClick={()=>navigate('/play')} className="btn-primary w-full mt-3 flex items-center justify-center gap-2"><RotateCcw size={14}/> В лобби</button>
      ) : room.status==='playing' && !winner && myColorRef.current ? (
        <div className="flex gap-2 mt-3">
          <button onClick={surrender} className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-medium border border-red-500/20 flex items-center justify-center gap-2"><Flag size={14}/> Сдаться</button>
          <button onClick={requestReset} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${room.reset_requested_by===user?.id?'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30':resetByOther?'bg-green-500/20 text-green-400 border border-green-500/30':'bg-white/5 text-gray-400 border border-white/10'}`}>
            <RotateCcw size={14}/> {room.reset_requested_by===user?.id?'Ожидание...':resetByOther?'Подтвердить':'Сбросить'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
