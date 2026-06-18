// =============================================================================
// scheduler/types
// 提案エンジン全体で共有する型。内部計算はすべて epoch ミリ秒で行う
// （タイムゾーン由来のバグを避けるため）。
// =============================================================================

/** 時間区間。 */
export interface Interval {
  start: number; // epoch ms (inclusive)
  end: number; // epoch ms (exclusive)
}

export interface WorkingHours {
  startHour: number; // 例: 9
  startMinute?: number; // 既定 0
  endHour: number; // 例: 18
  endMinute?: number; // 既定 0
}

export interface SlotPreferences {
  /** 会議の長さ（分）。 */
  durationMinutes: number;
  /** IANA タイムゾーン。例: 'Asia/Tokyo'。 */
  timeZone: string;
  /** 勤務時間帯。既定 9:00-18:00。 */
  workingHours?: WorkingHours;
  /** 候補に含める曜日。0=日, 1=月 ... 6=土。既定は平日 [1,2,3,4,5]。 */
  allowedWeekdays?: number[];
  /** 優先したい時間帯（ローカル時刻の時）。例: 午後なら {startHour:13, endHour:17}。 */
  preferredWindow?: { startHour: number; endHour: number };
  /** 候補開始時刻の刻み（分）。既定 30。 */
  granularityMinutes?: number;
  /** 返す候補数の上限。既定 5。 */
  maxResults?: number;
  /** 既存予定の前後に確保するバッファ（分）。既定 0。 */
  bufferMinutes?: number;
}

export interface SlotCandidate {
  start: number;
  end: number;
  startISO: string;
  endISO: string;
  score: number;
}

export interface RecurringCandidate {
  weekday: number;
  startISOFirst: string; // 初回の開始時刻
  localTime: string; // "13:00" のような表記
  occurrenceStartsISO: string[]; // 各回の開始時刻
  score: number;
}
