import EventEmitter from 'events';
import { logger } from '../../../packages/logger/src/index.js';
class AppEventBus extends EventEmitter {
    emitEvent(channel, payload) {
        this.emit(channel, payload);
    }
    subscribe(channel, handler) {
        this.on(channel, async (payload) => {
            try {
                await handler(payload);
            }
            catch (err) {
                logger.error({ channel, err: err.message }, 'Error in event subscriber');
            }
        });
    }
}
export const eventBus = new AppEventBus();
