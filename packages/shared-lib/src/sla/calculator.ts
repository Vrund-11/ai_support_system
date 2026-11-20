import type { BusinessHours, SlaPolicy, TicketPriority } from '@supportpilot/shared-types';

export interface SlaTargetMilestones {
  targetMinutes: number;
  warning75At: Date;
  breach100At: Date;
}

export interface SlaMilestones {
  firstResponse: SlaTargetMilestones;
  resolution: SlaTargetMilestones;
}

export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Checks if a specific wall-clock date is currently inside the tenant's business hours.
 */
export function isWithinBusinessHours(date: Date, businessHours: BusinessHours[]): boolean {
  if (!businessHours || businessHours.length === 0) return true;

  const day = date.getUTCDay();
  const currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();

  const dayConfig = businessHours.find((bh) => bh.day === day);
  if (!dayConfig) return false;

  const startMins = parseTimeToMinutes(dayConfig.start);
  const endMins = parseTimeToMinutes(dayConfig.end);

  return currentMinutes >= startMins && currentMinutes < endMins;
}

/**
 * Fast-forwards a date to the start of the next active business window if outside business hours.
 */
export function fastForwardToBusinessStart(date: Date, businessHours: BusinessHours[]): Date {
  if (!businessHours || businessHours.length === 0) return new Date(date);

  const current = new Date(date);
  // Reset seconds & milliseconds for deterministic minute calculations
  current.setUTCSeconds(0, 0);

  // Safety cap of 14 days lookup to avoid infinite loops if businessHours has 0 open days
  for (let d = 0; d < 14; d++) {
    const day = current.getUTCDay();
    const currentMins = current.getUTCHours() * 60 + current.getUTCMinutes();
    const dayConfig = businessHours.find((bh) => bh.day === day);

    if (dayConfig) {
      const startMins = parseTimeToMinutes(dayConfig.start);
      const endMins = parseTimeToMinutes(dayConfig.end);

      if (currentMins < startMins) {
        // Earlier than today's start -> jump to start of today
        current.setUTCHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
        return current;
      }

      if (currentMins < endMins) {
        // Currently inside today's business hours
        return current;
      }
    }

    // Past today's end or closed today -> advance to 00:00 of tomorrow
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(0, 0, 0, 0);
  }

  return current;
}

/**
 * Calculates the exact wall-clock Date when target business minutes elapse,
 * skipping weekends, nights, and unconfigured non-business hours (AUTO-1).
 */
export function calculateBusinessTimeDeadline(
  startTime: Date,
  targetMinutes: number,
  businessHours: BusinessHours[],
): Date {
  if (isNaN(startTime.getTime())) {
    return new Date(NaN);
  }

  if (targetMinutes <= 0) {
    return new Date(startTime);
  }

  // 24x7 calendar fallback if no business hours configured
  if (!businessHours || businessHours.length === 0) {
    return new Date(startTime.getTime() + targetMinutes * 60000);
  }

  // Start at either startTime or the next active business minute
  let current = fastForwardToBusinessStart(startTime, businessHours);
  let remainingMinutes = targetMinutes;

  let iterations = 0;
  const maxIterations = 365; // Safety guard for 1 calendar year

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;
    const day = current.getUTCDay();
    const dayConfig = businessHours.find((bh) => bh.day === day);

    if (!dayConfig) {
      // Closed today -> advance to tomorrow 00:00 and fast-forward
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
      current = fastForwardToBusinessStart(current, businessHours);
      continue;
    }

    const startMins = parseTimeToMinutes(dayConfig.start);
    const endMins = parseTimeToMinutes(dayConfig.end);
    const currentMins = current.getUTCHours() * 60 + current.getUTCMinutes();

    if (currentMins < startMins) {
      current.setUTCHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
    }

    const availableMinsToday = endMins - (current.getUTCHours() * 60 + current.getUTCMinutes());

    if (availableMinsToday <= 0) {
      // Past end today -> move to tomorrow
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
      current = fastForwardToBusinessStart(current, businessHours);
      continue;
    }

    if (remainingMinutes <= availableMinsToday) {
      // Finished today
      return new Date(current.getTime() + remainingMinutes * 60000);
    }

    // Consume today's available minutes and move to tomorrow's business window
    remainingMinutes -= availableMinsToday;
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(0, 0, 0, 0);
    current = fastForwardToBusinessStart(current, businessHours);
  }

  return current;
}

/**
 * Calculates SLA warning (75%) and breach (100%) deadlines for first response and resolution.
 */
export function calculateSlaMilestones(
  startTime: Date,
  priority: TicketPriority,
  slaConfig: Record<TicketPriority, SlaPolicy>,
  businessHours: BusinessHours[],
): SlaMilestones {
  const policy = slaConfig[priority] ||
    slaConfig.MEDIUM || { firstResponseMin: 240, resolveMin: 720 };

  const frMinutes = policy.firstResponseMin;
  const fr75Minutes = Math.max(1, Math.floor(frMinutes * 0.75));

  const resMinutes = policy.resolveMin;
  const res75Minutes = Math.max(1, Math.floor(resMinutes * 0.75));

  return {
    firstResponse: {
      targetMinutes: frMinutes,
      warning75At: calculateBusinessTimeDeadline(startTime, fr75Minutes, businessHours),
      breach100At: calculateBusinessTimeDeadline(startTime, frMinutes, businessHours),
    },
    resolution: {
      targetMinutes: resMinutes,
      warning75At: calculateBusinessTimeDeadline(startTime, res75Minutes, businessHours),
      breach100At: calculateBusinessTimeDeadline(startTime, resMinutes, businessHours),
    },
  };
}
