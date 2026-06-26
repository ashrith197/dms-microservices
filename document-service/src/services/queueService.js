const amqp = require("amqplib");

let channel = null;
const EXCHANGE = "document_events";

const connect = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });

    console.log("[RabbitMQ] Document Service connected");

    conn.on("error", (err) => {
      console.error("[RabbitMQ] Connection error:", err.message);
      channel = null;
    });

    conn.on("close", () => {
      console.warn("[RabbitMQ] Connection closed");
      channel = null;
    });
  } catch (err) {
    console.warn("[RabbitMQ] Could not connect:", err.message);
    console.warn("[RabbitMQ] Falling back to HTTP notifications");
    channel = null;
  }
};

const publishEvent = (routingKey, payload) => {
  if (!channel) {
    console.warn(`[RabbitMQ] No channel — "${routingKey}" not published`);
    return;
  }

  try {
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    console.log(`[RabbitMQ] Published: ${routingKey}`);
  } catch (err) {
    console.error(`[RabbitMQ] Publish failed "${routingKey}":`, err.message);
  }
};

module.exports = { connect, publishEvent };
