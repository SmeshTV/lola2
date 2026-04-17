// Карта ролей сервера LOLA
export interface ServerRole {
  id: string;
  name: string;
  aliases?: string[]; // альтернативные названия (из Discord API)
  color: string;
  category: 'admin' | 'rank' | 'special' | 'game' | 'tag' | 'other';
}

export const SERVER_ROLES: ServerRole[] = [
  // ===== Администрация =====
  { id: '1463230825041756302', name: '𝓛𝓸𝓵𝓪', aliases: ['Lola', '@𝓛𝓸𝓵𝓪'], color: 'from-red-500 to-pink-500', category: 'admin' },
  { id: '1463271031501357067', name: 'ℳ𝒶𝒾𝓃 ℳ𝑜𝒹𝑒𝓇𝒶𝓉𝑜𝓇', aliases: ['Main Moderator', '@ℳ𝒶𝒾𝓃 ℳ𝑜𝒹𝑒𝓇𝒶𝓉𝑜𝓇'], color: 'from-purple-500 to-indigo-500', category: 'admin' },
  { id: '1464965472704266414', name: '𝓖𝓻𝓪𝓷𝓭 𝓜𝓸𝓭', aliases: ['Grand Mod', '@𝓖𝓻𝓪𝓷𝓭 𝓜𝓸𝓭'], color: 'from-purple-500 to-pink-500', category: 'admin' },
  { id: '1478351837835825235', name: '𝓐𝓭𝓶𝓲𝓷', aliases: ['Admin', '@𝓐𝓭𝓶𝓲𝓷'], color: 'from-red-500 to-orange-500', category: 'admin' },
  { id: '1466565907857014825', name: '𝒯𝑒𝒸𝒽 𝒜𝒹𝓂𝒾𝓃', aliases: ['Tech Admin', '@𝒯𝑒𝒸𝒽 𝒜𝒹𝓂𝒾𝓃'], color: 'from-cyan-500 to-blue-500', category: 'admin' },
  { id: '1464964592575709309', name: '𝓜𝓸𝓭', aliases: ['Mod', '@𝓜𝓸𝓭'], color: 'from-blue-500 to-indigo-500', category: 'admin' },
  { id: '1464787504183115816', name: '𝓗𝓮𝓵𝓹𝓮𝓻', aliases: ['Helper', '@𝓗𝓮𝓵𝓹𝓮𝓻'], color: 'from-green-500 to-emerald-500', category: 'admin' },
  { id: '1469686860627447931', name: '𝓖𝓪𝓶𝓮 𝓐𝓻𝓬𝓱𝓲𝓽𝓮𝓬𝓽', aliases: ['Game Architect', '@𝓖𝓪𝓶𝓮 𝓐𝓻𝓬𝓱𝓲𝓽𝓮𝓬𝓽'], color: 'from-amber-500 to-orange-500', category: 'admin' },
  { id: '1465825700031234172', name: '𝓔𝓿𝓮𝓷𝓽 𝓜𝓪𝓴𝓮𝓻', aliases: ['Event Maker', '@𝓔𝓿𝓮𝓷𝓽 𝓜𝓪𝓴𝓮𝓻'], color: 'from-violet-500 to-purple-500', category: 'admin' },

  // ===== Ранговая система =====
  { id: '1464878082996568337', name: 'Pawn', color: 'from-gray-500 to-gray-600', category: 'rank' },
  { id: '1464878249564962827', name: 'Knight', color: 'from-gray-400 to-gray-500', category: 'rank' },
  { id: '1464881720418631834', name: 'Bishop', color: 'from-slate-500 to-slate-600', category: 'rank' },
  { id: '1464878407207751793', name: 'Rook', color: 'from-zinc-500 to-zinc-600', category: 'rank' },
  { id: '1464878493346041917', name: 'Queen', color: 'from-neutral-400 to-neutral-500', category: 'rank' },
  { id: '1464878560711020781', name: 'King', color: 'from-stone-400 to-stone-500', category: 'rank' },

  // ===== Особые роли =====
  { id: '1464915038564515993', name: '𝕲𝖗𝖆𝖓𝖉𝖒𝖆𝖘𝖙𝖊𝖗', aliases: ['Grandmaster'], color: 'from-yellow-500 to-amber-500', category: 'special' },
  { id: '1464898072000598058', name: '𝕸𝖊𝖉𝖎𝖆', aliases: ['Media'], color: 'from-pink-500 to-rose-500', category: 'special' },
  { id: '1465258626552', name: '𝕾𝖕𝖊𝖈𝖎𝖆𝖑 𝖌𝖚𝖊𝖘𝖙', aliases: ['Special Guest', 'Special guest'], color: 'from-fuchsia-500 to-purple-500', category: 'special' },
  { id: '1465744785267753082', name: 'Server Booster', color: 'from-pink-500 to-purple-500', category: 'special' },

  // ===== Игровые роли =====
  { id: '1478094359332126812', name: 'Minecraft', color: 'from-green-600 to-lime-500', category: 'game' },
  { id: '1475558835035963602', name: 'Clash Royale', color: 'from-yellow-500 to-orange-500', category: 'game' },
  { id: '1485703963280937181', name: 'Brawl Stars', color: 'from-red-500 to-yellow-500', category: 'game' },

  // ===== Уведомления =====
  { id: '1467974295639556219', name: 'server news', color: 'from-slate-500 to-slate-600', category: 'tag' },
  { id: '1467974381085921462', name: 'media news', color: 'from-pink-500 to-rose-500', category: 'tag' },
  { id: '1467974588183871541', name: 'game news', color: 'from-green-500 to-emerald-500', category: 'tag' },
  { id: '1467975816297054512', name: 'event news', color: 'from-violet-500 to-purple-500', category: 'tag' },
];

// Порядок категорий для отображения (по приоритету)
export const ROLE_CATEGORIES: { key: ServerRole['category']; label: string; emoji: string }[] = [
  { key: 'admin', label: 'Администрация', emoji: '🛡️' },
  { key: 'rank', label: 'Ранговая система', emoji: '⚔️' },
  { key: 'special', label: 'Особые роли', emoji: '⭐' },
  { key: 'game', label: 'Игровые роли', emoji: '🎮' },
  { key: 'tag', label: 'Уведомления', emoji: '🔔' },
  { key: 'other', label: 'Другие', emoji: '📌' },
];

// Роли для прав на сайте
export const SITE_ADMIN_ROLES = SERVER_ROLES
  .filter(r => r.category === 'admin')
  .map(r => r.id);

export const SITE_EVENT_MAKER_ROLES = SERVER_ROLES
  .filter(r => r.category === 'admin' && ['𝓖𝓪𝓶𝓮 𝓐𝓻𝓬𝓱𝓲𝓽𝓮𝓬𝓽', '𝓔𝓿𝓮𝓷𝓽 𝓜𝓪𝓴𝓮𝓻', 'Minecraft', 'Clash Royale', 'Brawl Stars'].includes(r.name))
  .map(r => r.id);

export const SITE_SPECIAL_ROLES = SERVER_ROLES
  .filter(r => r.category === 'special')
  .map(r => r.id);

// Получить роль по ID, названию или алиасу
export function getRoleById(roleId: string): ServerRole | null {
  return SERVER_ROLES.find(r =>
    r.id === roleId ||
    r.name === roleId ||
    (r.aliases && r.aliases.includes(roleId))
  ) || null;
}

// Получить название роли по ID (с fallback на Discord название)
export function getRoleName(roleId: string, fallbackNames?: Record<string, string>): string {
  const role = getRoleById(roleId);
  if (role) return role.name;
  // Если роль не найдена — берём название из Discord
  if (fallbackNames && fallbackNames[roleId]) return fallbackNames[roleId];
  return roleId;
}

// Получить CSS класс цвета роли
export function getRoleColor(roleId: string): string {
  const role = getRoleById(roleId);
  return role ? role.color : 'from-gray-500 to-gray-600';
}

// Получить категорию роли (работает и с ID, и с названием)
export function getRoleCategory(roleId: string): ServerRole['category'] {
  const role = getRoleById(roleId);
  return role ? role.category : 'other';
}

// Получить индекс категории (для сортировки)
export function getCategoryIndex(category: ServerRole['category']): number {
  const idx = ROLE_CATEGORIES.findIndex(c => c.key === category);
  return idx === -1 ? ROLE_CATEGORIES.length : idx;
}

// Сортировка ролей по иерархии (работает с ID, названиями и алиасами)
export function sortRolesByHierarchy(roleIdsOrNames: string[]): string[] {
  return [...roleIdsOrNames].sort((a, b) => {
    const roleA = getRoleById(a);
    const roleB = getRoleById(b);
    const catA = getCategoryIndex(roleA?.category || 'other');
    const catB = getCategoryIndex(roleB?.category || 'other');
    if (catA !== catB) return catA - catB;
    // Внутри одной категории — порядок в массиве SERVER_ROLES
    const idxA = SERVER_ROLES.findIndex(r =>
      r.id === a || r.name === a || (r.aliases && r.aliases.includes(a))
    );
    const idxB = SERVER_ROLES.findIndex(r =>
      r.id === b || r.name === b || (r.aliases && r.aliases.includes(b))
    );
    return idxA - idxB;
  });
}
