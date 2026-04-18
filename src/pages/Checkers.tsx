import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Trophy, ArrowLeft } from 'lucide-react';

interface Piece {
  player: 1 | 2;
  isKing: boolean;
}

interface Cell {
  piece: Piece | null;
  isBlack: boolean;
  row: number;
  col: number;
}

interface Rules {
  canCaptureBackwards: boolean;
  flyingKings: boolean;
  mandatoryCapture: boolean;
}

const Checkers: React.FC = () => {
  const navigate = useNavigate();
  const user = useUser();
  
  const [board, setBoard] = useState<Cell[][]>([]);
  const [selectedPos, setSelectedPos] = useState<{r: number, c: number} | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [validMoves, setValidMoves] = useState<{r: number, c: number, isJump: boolean, jumpOver?: {r: number, c: number}}[]>([]);
  const [gameSettings, setGameSettings] = useState<Rules>({
    canCaptureBackwards: true,
    flyingKings: false,
    mandatoryCapture: true,
  });
  const [showSettings, setShowSettings] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [mustCaptureFrom, setMustCaptureFrom] = useState<{r: number, c: number} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [surrenderClicked, setSurrenderClicked] = useState(false);

  const initBoard = () => {
    const newBoard: Cell[][] = [];
    for (let r = 0; r < 8; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < 8; c++) {
        const isBlack = (r + c) % 2 === 1;
        let piece: Piece | null = null;
        
        if (isBlack) {
          if (r < 3) piece = { player: 2, isKing: false };
          if (r > 4) piece = { player: 1, isKing: false };
        }
        
        row.push({ piece, isBlack, row: r, col: c });
      }
      newBoard.push(row);
    }
    setBoard(newBoard);
    setCurrentPlayer(1);
    setWinner(null);
    setMustCaptureFrom(null);
    setSelectedPos(null);
    setValidMoves([]);
  };

  useEffect(() => {
    if (gameStarted && board.length === 0) {
      initBoard();
    }
  }, [gameStarted]);

  useEffect(() => {
    if (selectedPos && !mustCaptureFrom) {
      const moves = calculateMoves(selectedPos.r, selectedPos.c, board, currentPlayer, gameSettings);
      setValidMoves(moves);
    } else if (mustCaptureFrom) {
      const moves = calculateMoves(mustCaptureFrom.r, mustCaptureFrom.c, board, currentPlayer, gameSettings, true);
      setValidMoves(moves);
      if (moves.length === 0) {
        setMustCaptureFrom(null);
        setIsProcessing(false);
        switchTurn();
      }
    } else {
      setValidMoves([]);
    }
  }, [selectedPos, board, currentPlayer, mustCaptureFrom]);

  const calculateMoves = (r: number, c: number, currentBoard: Cell[][], player: number, rules: Rules, forceJump: boolean = false) => {
    const moves: {r: number, c: number, isJump: boolean, jumpOver?: {r: number, c: number}}[] = [];
    const piece = currentBoard[r][c].piece;
    if (!piece || piece.player !== player) return [];

    const directions = piece.isKing ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[-1, -1], [-1, 1]];

    if (!forceJump && !rules.mandatoryCapture) {
      directions.forEach(([dr, dc]) => {
        if (piece.isKing && rules.flyingKings) {
          let dist = 1;
          while(true) {
            const nr = r + dr * dist;
            const nc = c + dc * dist;
            if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
            if (currentBoard[nr][nc].piece) break;
            moves.push({ r: nr, c: nc, isJump: false });
            dist++;
          }
        } else {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7 && !currentBoard[nr][nc].piece) {
            moves.push({ r: nr, c: nc, isJump: false });
          }
        }
      });
    }

    const jumpDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    jumpDirections.forEach(([dr, dc]) => {
      if (!piece.isKing && dr === 1 && !rules.canCaptureBackwards && !forceJump) return;

      let dist = 1;
      while(true) {
        const midR = r + dr * dist;
        const midC = c + dc * dist;
        
        if (midR < 0 || midR > 7 || midC < 0 || midC > 7) break;
        
        const midCell = currentBoard[midR][midC];
        if (midCell.piece) {
          if (midCell.piece.player !== player) {
            const landR = r + dr * (dist + 1);
            const landC = c + dc * (dist + 1);
            
            if (landR >= 0 && landR <= 7 && landC >= 0 && landC <= 7) {
              const landCell = currentBoard[landR][landC];
              if (!landCell.piece) {
                moves.push({ r: landR, c: landC, isJump: true, jumpOver: { r: midR, c: midC } });
                if (!rules.flyingKings || !piece.isKing) break;
              }
            }
          }
          break;
        }
        
        if (!rules.flyingKings || !piece.isKing) break;
        dist++;
      }
    });

    if (rules.mandatoryCapture && moves.some(m => m.isJump)) {
      return moves.filter(m => m.isJump);
    }
    
    if (forceJump) {
      return moves.filter(m => m.isJump);
    }

    return moves;
  };

  const handleCellClick = (r: number, c: number) => {
    if (winner || isProcessing || !gameStarted) return;
    if (mustCaptureFrom && (r !== mustCaptureFrom.r || c !== mustCaptureFrom.c)) return;

    const cell = board[r][c];

    if (cell.piece && cell.piece.player === currentPlayer) {
      setSelectedPos({ r, c });
      return;
    }

    if (!cell.piece && selectedPos) {
      const move = validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        executeMove(move);
      }
    }
  };

  const executeMove = (move: {r: number, c: number, isJump: boolean, jumpOver?: {r: number, c: number}}) => {
    setIsProcessing(true);
    const newBoard = board.map(row => row.map(cell => ({ ...cell, piece: cell.piece ? { ...cell.piece } : null })));
    const fromR = selectedPos?.r || mustCaptureFrom?.r;
    const fromC = selectedPos?.c || mustCaptureFrom?.c;

    if (fromR === undefined || fromC === undefined) return;

    const movingPiece = newBoard[fromR][fromC].piece!;
    newBoard[fromR][fromC].piece = null;
    newBoard[move.r][move.c].piece = movingPiece;

    let captured = false;
    if (move.isJump && move.jumpOver) {
      newBoard[move.jumpOver.r][move.jumpOver.c].piece = null;
      captured = true;
    }

    if (!movingPiece.isKing) {
      if ((movingPiece.player === 1 && move.r === 0) || (movingPiece.player === 2 && move.r === 7)) {
        movingPiece.isKing = true;
      }
    }

    setBoard(newBoard);

    if (captured) {
      const subsequentMoves = calculateMoves(move.r, move.c, newBoard, currentPlayer, gameSettings, true);
      if (subsequentMoves.length > 0) {
        setMustCaptureFrom({ r: move.r, c: move.c });
        setSelectedPos({ r: move.r, c: move.c });
        setIsProcessing(false);
        return;
      }
    }

    setMustCaptureFrom(null);
    setSelectedPos(null);
    switchTurn(newBoard);
  };

  const switchTurn = (currentBoard = board) => {
    const p1Pieces = currentBoard.flat().filter(c => c.piece?.player === 1).length;
    const p2Pieces = currentBoard.flat().filter(c => c.piece?.player === 2).length;

    if (p1Pieces === 0) {
      setWinner(2);
      setIsProcessing(false);
      return;
    }
    if (p2Pieces === 0) {
      setWinner(1);
      setIsProcessing(false);
      return;
    }

    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    let hasMoves = false;
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c].piece?.player === nextPlayer) {
          const moves = calculateMoves(r, c, currentBoard, nextPlayer, gameSettings);
          if (moves.length > 0) {
            hasMoves = true;
            break;
          }
        }
      }
      if (hasMoves) break;
    }

    if (!hasMoves) {
      setWinner(nextPlayer === 1 ? 2 : 1);
      setIsProcessing(false);
      return;
    }

    setCurrentPlayer(nextPlayer);
    setIsProcessing(false);
  };

  const handleStartGame = async () => {
    if (!user) {
      alert('Необходимо войти в систему');
      return;
    }
    
    setShowSettings(false);
    setGameStarted(true);
    initBoard();
  };

  const handleSurrender = async () => {
      if (surrenderClicked || winner) return;
      if(!window.confirm("Вы уверены, что хотите сдаться?")) return;
      
      setSurrenderClicked(true);
      setWinner(currentPlayer === 1 ? 2 : 1);
  };

  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800 border-gray-700">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Настройки Шашек</h2>
            <p className="text-gray-400">Выберите правила перед началом игры</p>
          </div>
          
          <div className="space-y-4 mb-6">
            <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition">
              <span>Рубка назад обычными</span>
              <input type="checkbox" checked={gameSettings.canCaptureBackwards} onChange={e => setGameSettings({...gameSettings, canCaptureBackwards: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition">
              <span>Летающие дамки</span>
              <input type="checkbox" checked={gameSettings.flyingKings} onChange={e => setGameSettings({...gameSettings, flyingKings: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition">
              <span>Обязательная рубка</span>
              <input type="checkbox" checked={gameSettings.mandatoryCapture} onChange={e => setGameSettings({...gameSettings, mandatoryCapture: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </label>
          </div>

          <Button onClick={handleStartGame} className="w-full py-3 text-lg">
            Создать игру
          </Button>
          <Button variant="outline" onClick={() => navigate('/games')} className="w-full mt-3">
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1606167668584-78701c57f13d?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
            <Button variant="ghost" onClick={() => navigate('/games')} className="text-gray-300 hover:text-white">
                <X className="w-6 h-6" />
            </Button>
            <div className="text-xl font-bold">
                {winner ? (
                    <span className={winner === 1 ? "text-green-400" : "text-red-400"}>
                        {`Победили ${winner === 1 ? 'Вы' : 'Противник'}!`}
                    </span>
                ) : (
                    <span className={currentPlayer === 1 ? "text-blue-400" : "text-red-400"}>
                        {currentPlayer === 1 ? 'Ваш ход' : 'Ход противника'}
                    </span>
                )}
            </div>
            <Button 
                variant="destructive" 
                onClick={handleSurrender} 
                disabled={!!winner || isProcessing || surrenderClicked}
            >
                {surrenderClicked ? 'Сдался' : 'Сдаться'}
            </Button>
        </div>

        <div className="aspect-square w-full bg-[#3a2a1a] rounded-lg shadow-2xl border-4 border-[#5d4037] relative select-none">
            {board.map((row, r) => (
                <div key={r} className="flex h-[12.5%]">
                    {row.map((cell, c) => {
                        const isSelected = selectedPos?.r === r && selectedPos?.c === c;
                        const isValidMove = validMoves.some(m => m.r === r && m.c === c);

                        return (
                            <div 
                                key={c}
                                onClick={() => handleCellClick(r, c)}
                                className={`
                                    w-[12.5%] h-full flex items-center justify-center relative
                                    ${cell.isBlack ? 'bg-[#5d4037]' : 'bg-[#eecfa1]'}
                                    ${isSelected ? 'ring-inset ring-4 ring-yellow-400' : ''}
                                    ${isValidMove ? 'cursor-pointer' : ''}
                                    transition-all duration-150
                                `}
                            >
                                {isValidMove && (
                                    <div className={`absolute w-4 h-4 rounded-full ${cell.piece ? 'ring-2 ring-red-500' : 'bg-green-500 opacity-50'}`}></div>
                                )}
                                
                                <AnimatePresence>
                                    {cell.piece && (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                            className={`
                                                w-[80%] h-[80%] rounded-full shadow-lg flex items-center justify-center border-2
                                                ${cell.piece.player === 1 
                                                    ? 'bg-gradient-to-br from-blue-300 to-blue-600 border-blue-800' 
                                                    : 'bg-gradient-to-br from-red-300 to-red-600 border-red-800'}
                                                ${cell.piece.isKing ? 'ring-2 ring-yellow-400' : ''}
                                                cursor-pointer hover:brightness-110
                                            `}
                                        >
                                            {cell.piece.isKing && <Trophy className="w-1/2 h-1/2 text-yellow-200 drop-shadow-md" />}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>

        {winner && (
            <div className="mt-6 text-center">
                <div className="glass-card p-6 animate-in fade-in zoom-in max-w-md mx-auto">
                    <h3 className="text-2xl font-bold mb-4">
                        {winner === 1 ? '🎉 Победа!' : '💀 Поражение'}
                    </h3>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => { setWinner(null); initBoard(); }} className="btn-primary">Играть снова</button>
                        <button onClick={() => navigate('/games')} className="btn-outline">В меню</button>
                    </div>
                                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Checkers;
