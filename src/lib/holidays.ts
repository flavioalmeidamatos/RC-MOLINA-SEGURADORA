export interface Holiday {
  date: string;
  name: string;
  type: string;
}

const holidayCache: Record<number, Holiday[]> = {};

export async function fetchHolidays(year: number): Promise<Holiday[]> {
  if (holidayCache[year]) {
    return holidayCache[year];
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch holidays: ${response.statusText}`);
    }
    const data = await response.json();
    holidayCache[year] = data;
    return data;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
}

export function isHoliday(date: Date, holidays: Holiday[]): Holiday | undefined {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.find(h => h.date === dateStr);
}
