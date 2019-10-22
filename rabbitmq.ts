import * as amqp from 'amqplib';
import { Message } from 'amqplib/properties';
import * as assert from 'assert';
import { EventEmitter } from 'events';

interface SubsribeParams {
  queue: string;
  routingKey: string;
  callback: (any?) => void;
}

interface RabbitMQ {
  _connection: amqp.Connection | null;
  _channel: amqp.Channel | null;
  _url: string | amqp.Options.Connect;
  _connectOptions: any;
  _exchanges: any;
  _queues: any[];
  _subscribeCallbackOptions: SubsribeParams[];
  reConnectIntervalInSeconds: number;
}

class RabbitMQ extends EventEmitter {
  constructor(config) {
    super();
    this._subscribeCallbackOptions = [];
    this._connection = null;
    this._channel = null;
    this._url = config.url;
    this._connectOptions = config.options;
    this._exchanges = config.exchanges;
    this._queues = config.queues;
    this.reConnectIntervalInSeconds = config.reconnectTime;
  }

  async connect() {
    if (this._connection) {
      return;
    }
    try {
      this._connection = await amqp.connect(this._url, this._connectOptions);
      this._connection.on('blocked', reason => this.emit('blocked', { reason }));
      this._connection.on('unblocked', () => this.emit('unblocked'));
      this._connection.on('error', err => this.emit('error', err));
      this._connection.on('close', async err => {
        this.emit('close', err);
        await this.close();
        setTimeout(() => {
          this.connect();
        }, this.reConnectIntervalInSeconds);
      });
      this.emit('connect', this._connection);
    } catch (err) {
      this.emit('error', err);
      setTimeout(() => {
        this.connect();
      }, this.reConnectIntervalInSeconds);
    }
  }

  async close() {
    try {
      this._connection && (await this._connection.close());
    } catch (err) {
      console.error(err);
    }
    this._connection = null;
  }

  async createChannel() {
    if (!this._connection) {
      setTimeout(() => {
        this.createChannel();
      }, this.reConnectIntervalInSeconds);
      return;
    }
    try {
      this._channel = await this._connection.createConfirmChannel();
      this._channel.on('close', () => this._onChannelClose(null));
      this._channel.on('error', error => this._onChannelError(error));
      this._channel.on('return', msg => this._onChannelReturn(msg));
      this._channel.on('drain', () => this._onChannelDrain());
      await this.assertAllExchange();
      await this.createAllBinding();
      this.createAllConsumer();
      this.emit('ch_open', this._channel);
    } catch (err) {
      this.emit('error', err);
      setTimeout(() => {
        this.createChannel();
      }, this.reConnectIntervalInSeconds);
    }
  }

  async closeChannel() {
    if (!this._channel) {
      return;
    }
    try {
      await this._channel.close();
    } catch (err) {
      console.error(err);
    }
    this._channel = null;
  }

  async _onChannelError(error) {
    this.emit('ch_error', error);
    // await this.closeChannel();
  }

  async _onChannelClose(error) {
    this.emit('ch_close', error);
    await this.closeChannel();
    setTimeout(() => {
      this.createChannel();
    }, this.reConnectIntervalInSeconds);
  }

  _onChannelReturn(msg) {
    this.emit('ch_return', msg);
  }

  _onChannelDrain() {
    this.emit('ch_drain');
  }

  async assertAllExchange() {
    const exchangeList: any = [];

    Object.getOwnPropertyNames(this._exchanges).forEach(async index => {
      const exchange = this._exchanges[index];
      exchangeList.push(await this.assertExchange(exchange.name, exchange.type, exchange.options));
    });
    return await Promise.all(exchangeList);
  }

  assertExchange(exchange, type, options = {}) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.assertExchange(exchange, type, options);
  }

  assertQueue(queue, options = {}) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.assertQueue(queue, options);
  }

  bindQueue(queue, source, pattern, args = {}) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.bindQueue(queue, source, pattern, args);
  }

  publish({
    exchange,
    key,
    message,
    options,
  }: {
    exchange: string;
    key: string;
    message: string;
    options?: amqp.Options.Publish;
  }): boolean {
    assert(exchange && key && message, 'exchange、routingKey、message参数不能为空');
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.publish(exchange, key, Buffer.from(JSON.stringify(message)), { ...options });
  }

  prefetch(count) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.prefetch(count);
  }

  sendToQueue(queue, msg, options = {}): boolean {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.sendToQueue(queue, msg, options);
  }

  startConsume(queue, consumeFunc, options = {}) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.consume(queue, consumeFunc, options);
  }

  get(queue, options = {}) {
    if (!this._channel) {
      throw new Error('channel closed!');
    }
    return this._channel.get(queue, options);
  }

  ack(message: Message, allUpTo: boolean = false) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.ack(message, allUpTo);
  }

  nack(message: Message, allUpTo: boolean = false, requeue: boolean = false) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.nack(message, allUpTo, requeue);
  }

  reject(message: Message, requeue: boolean = false) {
    if (!this._channel) {
      throw new Error('the channel is empty');
    }
    return this._channel.reject(message, requeue);
  }

  async createBinding(queue, exchange) {
    await this.assertQueue(queue.name, queue.options);
    if (!queue.keys) {
      return;
    }
    for (const index in queue.keys) {
      const key = queue.keys[index];
      await this.bindQueue(queue.name, exchange.name, key);
    }
  }

  async createAllBinding() {
    const exchangeConfig = {};
    Object.getOwnPropertyNames(this._exchanges).forEach(async index => {
      const exchange = this._exchanges[index];
      exchangeConfig[exchange.name] = exchange;
    });
    return await Promise.all(
      Object.getOwnPropertyNames(this._queues).map(async index => {
        const queue = this._queues[index];
        const exchange = exchangeConfig[queue.exchange];
        if (exchange) {
          return await this.createBinding(queue, exchange);
        }
      }),
    );
  }

  createAllConsumer() {
    const consumer = this.consumer.bind(this);
    const callbackOptions = this._subscribeCallbackOptions;
    Object.getOwnPropertyNames(this._queues).forEach(async index => {
      const queue = this._queues[index];
      if (!queue.autoSubscribe) {
        return;
      }
      await consumer(
        queue.name,
        data => {
          const promiseArray: any[] = [];
          callbackOptions.forEach(async option => {
            // 如果不设置routingKey，则不作判断
            if (option.queue === queue.name && (!option.routingKey || data.fields.routingKey === option.routingKey)) {
              promiseArray.push(await option.callback(data));
            }
          });
          Promise.all(promiseArray);
        },
        queue.subscribeOptions,
      );
    });
  }

  async init() {
    await this.connect(); // 创建连接
    await this.createChannel(); // 创建channel
  }

  async consumer(queue, fn, options) {
    // 默认每次只接受一条
    await this.prefetch(options.prefetch || 1);
    // 启动消费者
    await this.startConsume(queue, fn, options);
  }

  /**
   * 绑定要执行的方法到消费成功的回调函数中。
   * 只有在配置中开启autoSubscribe才会生效，
   * 不开启则需要调用consumer方法去订阅
   * @param queue
   * @param routingKey
   * @param callback
   */
  async registerSubscribe(queue, routingKey, callback) {
    this._subscribeCallbackOptions.push({
      queue,
      routingKey,
      callback,
    });
  }
}

export default RabbitMQ;
