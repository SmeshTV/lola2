-- Migration: Add private rooms for RPS (Камень-Ножницы-Бумага)
-- Created: 2025-04-15
-- Purpose: Allow creating private/hidden rooms that don't show in public list

ALTER TABLE rps_rooms 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Add index for filtering private rooms
CREATE INDEX IF NOT EXISTS idx_rps_rooms_private ON rps_rooms(is_private) WHERE is_private = true;
