import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

interface SignalingState {
  connections: () => number;
  sessions: () => number;
  transfers: () => { pending: number; accepted: number };
}

export const createMetrics = (state: SignalingState) => {
  // Each server owns its registry; tests and multiple instances never share counters.
  const registry = new Registry();

  registry.setDefaultLabels({ service: "signaling" });
  collectDefaultMetrics({ register: registry });

  registry.registerMetric(
    new Gauge({
      name: "signaling_connections",
      help: "Current WebSocket connections, including unauthenticated connections.",
      registers: [],
      collect() {
        this.set(state.connections());
      },
    }),
  );

  registry.registerMetric(
    new Gauge({
      name: "signaling_sessions",
      help: "Sessions in memory, including disconnected sessions awaiting recovery.",
      registers: [],
      collect() {
        this.set(state.sessions());
      },
    }),
  );

  registry.registerMetric(
    new Gauge({
      name: "signaling_transfers",
      help: "Current transfer offers and accepted transfers tracked by signaling.",
      labelNames: ["stage"] as const,
      registers: [],
      collect() {
        const transfers = state.transfers();

        this.set({ stage: "pending" }, transfers.pending);
        this.set({ stage: "accepted" }, transfers.accepted);
      },
    }),
  );

  return {
    registry,
    connections: new Counter({
      name: "signaling_connections_total",
      help: "WebSocket connections accepted by signaling.",
      registers: [registry],
    }),
    connectionRejections: new Counter({
      name: "signaling_connection_rejections_total",
      help: "WebSocket upgrades rejected by signaling.",
      labelNames: ["reason"] as const,
      registers: [registry],
    }),
    messages: new Counter({
      name: "signaling_messages_received_total",
      help: "Received WebSocket messages by validated type; invalid and rate_limited are bounded fallback types.",
      labelNames: ["type"] as const,
      registers: [registry],
    }),
    protocolErrors: new Counter({
      name: "signaling_protocol_errors_total",
      help: "Protocol rejections by server-defined error code.",
      labelNames: ["code"] as const,
      registers: [registry],
    }),
    websocketErrors: new Counter({
      name: "signaling_websocket_errors_total",
      help: "WebSocket transport errors.",
      registers: [registry],
    }),
    transfersProposed: new Counter({
      name: "signaling_transfers_proposed_total",
      help: "Transfer offers created by signaling.",
      registers: [registry],
    }),
    transfersAccepted: new Counter({
      name: "signaling_transfers_accepted_total",
      help: "Transfer offers accepted by receivers.",
      registers: [registry],
    }),
    transfersEnded: new Counter({
      name: "signaling_transfers_ended_total",
      help: "Transfers ended by reason and stage; complete is receiver-reported.",
      labelNames: ["reason", "stage"] as const,
      registers: [registry],
    }),
    transferDuration: new Histogram({
      name: "signaling_transfer_duration_seconds",
      help: "Time from receiver acceptance to signaling termination, not measured file throughput.",
      labelNames: ["reason"] as const,
      buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600, 1_800],
      registers: [registry],
    }),
    connectionDuration: new Histogram({
      name: "signaling_connection_duration_seconds",
      help: "WebSocket connection lifetime until close.",
      buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1_800, 3_600],
      registers: [registry],
    }),
  };
};
