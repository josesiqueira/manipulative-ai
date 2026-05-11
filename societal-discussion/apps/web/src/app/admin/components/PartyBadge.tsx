import { PARTY_COLORS, PARTY_DISPLAY_NAMES } from '../lib/types';

export default function PartyBadge({ party }: { party: string }) {
  const color = PARTY_COLORS[party] || '#6B7280';
  const name = PARTY_DISPLAY_NAMES[party] || party;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
