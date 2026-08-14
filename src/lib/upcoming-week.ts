// Today §2.6 "Upcoming": a Mon–Sun calendar strip, one column per day.

export interface UpcomingItem {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO
  categoryInitial: string;
  categoryColor: string;
}

export interface DayColumn {
  date: string;
  isToday: boolean;
  items: UpcomingItem[];
  total: number;
}

/** The Monday–Sunday week containing `todayISO`, each day's due items and per-day total. */
export function weekStrip(todayISO: string, items: UpcomingItem[]): DayColumn[] {
  const today = new Date(todayISO + "T00:00:00");
  const mondayOffset = (today.getDay() + 6) % 7; // getDay(): 0 = Sunday
  const monday = new Date(today);
  monday.setDate(monday.getDate() - mondayOffset);

  const days: DayColumn[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const dayItems = items.filter((it) => it.date === date);
    days.push({
      date,
      isToday: date === todayISO,
      items: dayItems,
      total: dayItems.reduce((s, it) => s + it.amount, 0),
    });
  }
  return days;
}
