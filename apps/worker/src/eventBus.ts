import EventEmitter from 'events';
import { logger } from '../../../packages/logger/src/index.js';

class AppEventBus extends EventEmitter {
  public emitEvent(channel: string, payload: any) {
    this.emit(channel, payload);
  }

  public subscribe(channel: string, handler: (payload: any) => Promise<void> | void) {
    this.on(channel, async (payload) => {
      try {
        await handler(payload);
      } catch (err: any) {
        logger.error({ channel, err: err.message }, 'Error in event subscriber');
      }
    });
  }
}

export const eventBus = new AppEventBus();
