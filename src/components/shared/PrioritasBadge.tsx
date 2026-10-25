// ============================================================
// KAIZENBOX - Lencana Prioritas (dipakai di antrean, detail, Semua Aspirasi)
// ============================================================

const WARNA: Record<string, string> = {
  Mendesak: 'bg-red-100 text-red-700',
  Tinggi: 'bg-orange-100 text-orange-700',
  Normal: 'bg-blue-100 text-blue-700',
  Rendah: 'bg-gray-100 text-gray-600',
};

export function PrioritasBadge({ prioritas }: { prioritas: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${WARNA[prioritas] ?? 'bg-gray-100 text-gray-600'}`}>
      {prioritas || '-'}
    </span>
  );
}

// Penanda tenggat: tampil hanya jika mendekati atau lewat
export function TenggatBadge({ level }: { level: string }) {
  if (level === 'Terlambat') return <span className="text-xs font-semibold text-red-700">🔴 Terlambat</span>;
  if (level === 'Mendekati SLA') return <span className="text-xs font-semibold text-amber-700">⚠️ Mendekati batas waktu</span>;
  return null;
}
