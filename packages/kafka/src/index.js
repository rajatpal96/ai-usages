import { Kafka } from 'kafkajs';
import { logger } from '../../logger/src/index.js';
import EventEmitter from 'events';
export const KAFKA_TOPICS = {
    USAGE_EVENTS: 'agentmeter.usage-events',
    MCP_EVENTS: 'agentmeter.mcp-events',
    ALERTS: 'agentmeter.alerts',
};
export class AgentMeterKafkaClient {
    kafka = null;
    producer = null;
    consumer = null;
    isConnected = false;
    memoryFallbackBus = new EventEmitter();
    isFallbackMode = false;
    constructor() {
        const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
        try {
            this.kafka = new Kafka({
                clientId: 'agentmeter-fleet',
                brokers,
                retry: {
                    initialRetryTime: 100,
                    retries: 2,
                },
            });
        }
        catch (err) {
            logger.warn({ err: err.message }, 'Failed to initialize Kafka client. Enabling in-memory streaming fallback...');
            this.isFallbackMode = true;
        }
    }
    async connectProducer() {
        if (this.producer)
            return;
        if (this.isFallbackMode || !this.kafka) {
            this.isFallbackMode = true;
            return;
        }
        try {
            this.producer = this.kafka.producer();
            await this.producer.connect();
            this.isConnected = true;
            logger.info('🛰️ Kafka Producer connected successfully');
        }
        catch (err) {
            logger.warn({ err: err.message }, 'Kafka Broker unavailable. Using resilient in-memory streaming fallback.');
            this.isFallbackMode = true;
        }
    }
    async produceEvent(topic, key, payload) {
        if (this.isFallbackMode || !this.producer) {
            this.memoryFallbackBus.emit(topic, payload);
            return;
        }
        try {
            await this.producer.send({
                topic,
                messages: [
                    {
                        key,
                        value: JSON.stringify(payload),
                        timestamp: Date.now().toString(),
                    },
                ],
            });
        }
        catch (err) {
            logger.error({ err: err.message, topic }, 'Failed to publish to Kafka. Routing to fallback stream...');
            this.memoryFallbackBus.emit(topic, payload);
        }
    }
    async subscribeConsumer(topic, groupId, handler) {
        // Register in-memory fallback listener
        this.memoryFallbackBus.on(topic, async (event) => {
            try {
                await handler(event);
            }
            catch (err) {
                logger.error({ err: err.message, topic }, 'Error in fallback stream handler');
            }
        });
        if (this.isFallbackMode || !this.kafka)
            return;
        try {
            if (!this.consumer) {
                this.consumer = this.kafka.consumer({ groupId });
                await this.consumer.connect();
                logger.info({ groupId }, '🛰️ Kafka Consumer connected');
            }
            await this.consumer.subscribe({ topic, fromBeginning: true });
            await this.consumer.run({
                eachMessage: async ({ message }) => {
                    if (message.value) {
                        try {
                            const parsed = JSON.parse(message.value.toString());
                            await handler(parsed);
                        }
                        catch (e) {
                            logger.error({ err: e.message }, 'Failed to parse Kafka message');
                        }
                    }
                },
            });
        }
        catch (err) {
            logger.warn({ err: err.message, topic }, 'Kafka subscription fallback active.');
            this.isFallbackMode = true;
        }
    }
    async disconnect() {
        if (this.producer)
            await this.producer.disconnect().catch(() => { });
        if (this.consumer)
            await this.consumer.disconnect().catch(() => { });
    }
}
export const kafkaClient = new AgentMeterKafkaClient();
