const amqp = require("amqplib");
const EventLog = require("../models/EventLog");

const EXCHANGE = "document_events";
const QUEUE    = "logging_queue";

const startConsumer = async () => {
  try {
    const conn    = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();

    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });

    // Bind to all document events including new offboarding events
    await channel.bindQueue(QUEUE, EXCHANGE, "document.*");
    await channel.bindQueue(QUEUE, EXCHANGE, "documents.*");  // ← plural for reassign

    console.log("[RabbitMQ] Logging Service connected — consuming logging_queue");

    channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());

        await EventLog.create({
          event:          payload.event,
          documentId:     payload.documentId     || null,
          title:          payload.title          || null,
          ownerId:        payload.ownerId        || null,
          currentOwnerId: payload.currentOwnerId || null,
          ownerEmail:     payload.ownerEmail     || null,
          organisationId: payload.organisationId || null,
          teamId:         payload.teamId         || null,
          filename:       payload.filename       || null,
          metadata:       payload.metadata       || {},
          timestamp:      new Date(payload.timestamp),
        });

        console.log(`[Event Log] ${payload.event} | org: ${payload.organisationId} | ${payload.timestamp}`);
        channel.ack(msg);
      } catch (err) {
        console.error("[Logging] Failed to process message:", err.message);
        channel.nack(msg, false, false);
      }
    });

    conn.on("error", (err) => {
      console.error("[RabbitMQ] Logging Service error:", err.message);
    });
  } catch (err) {
    console.error("[RabbitMQ] Logging Service failed to connect:", err.message);
    console.log("[RabbitMQ] Retrying in 5 seconds...");
    setTimeout(startConsumer, 5000);
  }
};

module.exports = { startConsumer };
