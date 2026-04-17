/**
 * 日曆領域服務（Phase B-5）
 */
export type CalendarServiceDeps<TEvent> = {
  getCalendarEventsImpl: () => TEvent[];
  processCalendarBridgeEventsOnLoadImpl: () => Promise<void>;
  addCalendarEventImpl: (params: {
    month: number;
    day: number;
    title: string;
    description?: string;
  }) => Promise<{ ok: boolean; id?: string; message?: string }>;
  updateCalendarEventImpl: (
    id: string,
    patch: { title?: string; description?: string; month?: number; day?: number },
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteCalendarEventImpl: (id: string) => Promise<{ ok: boolean; message?: string }>;
  findCalendarEventByTitleAndDateImpl: (title: string, month: number, day: number) => TEvent | undefined;
};

export function createCalendarService<TEvent>(deps: CalendarServiceDeps<TEvent>) {
  return {
    getCalendarEvents(): TEvent[] {
      return deps.getCalendarEventsImpl();
    },
    processCalendarBridgeEventsOnLoad(): Promise<void> {
      return deps.processCalendarBridgeEventsOnLoadImpl();
    },
    addCalendarEvent(params: {
      month: number;
      day: number;
      title: string;
      description?: string;
    }): Promise<{ ok: boolean; id?: string; message?: string }> {
      return deps.addCalendarEventImpl(params);
    },
    updateCalendarEvent(
      id: string,
      patch: { title?: string; description?: string; month?: number; day?: number },
    ): Promise<{ ok: boolean; message?: string }> {
      return deps.updateCalendarEventImpl(id, patch);
    },
    deleteCalendarEvent(id: string): Promise<{ ok: boolean; message?: string }> {
      return deps.deleteCalendarEventImpl(id);
    },
    findCalendarEventByTitleAndDate(title: string, month: number, day: number): TEvent | undefined {
      return deps.findCalendarEventByTitleAndDateImpl(title, month, day);
    },
  };
}
