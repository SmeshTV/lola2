-- Migration: Add game XP function
-- Created: 2025-04-15
-- Purpose: Award site XP (users.xp) for playing games (casino, checkers, rps, durak)
-- Formula: XP = bet / 10 (minimum 1 XP), winner gets +50% bonus XP

-- Function to add game XP
CREATE OR REPLACE FUNCTION add_game_xp(
  p_user_id UUID,
  p_bet INTEGER,
  p_result TEXT -- 'win', 'loss', 'draw'
)
RETURNS VOID AS $$
DECLARE
  v_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_current_xp INTEGER;
BEGIN
  -- Calculate XP: bet / 10, minimum 1
  v_xp = GREATEST(1, p_bet / 10);
  
  -- Winner bonus: +50%
  IF p_result = 'win' THEN
    v_xp = v_xp + (v_xp / 2);
  END IF;
  
  -- Get current XP
  SELECT COALESCE(xp, 0), COALESCE(level, 1) 
  INTO v_current_xp, v_new_level
  FROM users 
  WHERE id = p_user_id;
  
  -- Add XP
  v_new_xp = v_current_xp + v_xp;
  
  -- Calculate new level (each level = level * 200 XP)
  WHILE v_new_xp >= v_new_level * 200 LOOP
    v_new_xp = v_new_xp - (v_new_level * 200);
    v_new_level = v_new_level + 1;
  END LOOP;
  
  -- Update user
  UPDATE users 
  SET xp = v_new_xp, 
      level = v_new_level 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
