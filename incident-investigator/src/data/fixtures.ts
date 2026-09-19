export const logs = [
  {
    timestamp: "10:27:14",
    service: "checkout",
    level: "ERROR",
    message: "Database connection timeout",
  },
  {
    timestamp: "10:28:03",
    service: "checkout",
    level: "ERROR",
    message: "Database connection timeout",
  },
  {
    timestamp: "10:29:41",
    service: "checkout",
    level: "ERROR",
    message: "Database connection timeout",
  },
  {
    timestamp: "10:30:12",
    service: "checkout",
    level: "ERROR",
    message: "Failed to acquire database connection",
  },
  {
    timestamp: "10:31:05",
    service: "checkout",
    level: "ERROR",
    message: "Database connection timeout",
  },
];

export const metrics = {
  checkout: {
    errorRate: 18.4,
    requestRate: 1240,
    latencyP95: 1850,
  },
  database: {
    connectionUtilization: 98,
    connectionErrors: 47,
  },
};

export const serviceStatuses = {
  checkout: {
    status: "degraded",
    message: "Elevated 5xx errors detected",
  },
  database: {
    status: "degraded",
    message: "Connection pool near capacity",
  },
};