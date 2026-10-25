// Shared StatusBadge component
export function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    'Terkirim': 'badge-terkirim',
    'Ditinjau': 'badge-ditinjau',
    'Menunggu Keputusan': 'badge-menunggu',
    'Implementasi': 'badge-implementasi',
    'Antre Implementasi': 'badge-antre',
    'Riset Lanjut': 'badge-riset',
    'Ditolak': 'badge-ditolak',
    'Dibatalkan': 'badge-dibatalkan',
    'Selesai': 'badge-selesai',
  };
  return (
    <span className={`badge ${classMap[status] || 'badge-terkirim'}`}>
      {status}
    </span>
  );
}
