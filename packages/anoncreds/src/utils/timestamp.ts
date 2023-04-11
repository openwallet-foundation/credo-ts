// Timestamps are expressed as Unix epoch time (seconds since 1/1/1970)
export const dateToTimestamp = (date: Date) => Math.floor(date.getTime() / 1000)
