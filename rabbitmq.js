"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const assert = require("assert");
const events_1 = require("events");
class RabbitMQ extends events_1.EventEmitter {
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
            this._connection.on('close', async (err) => {
                this.emit('close', err);
                await this.close();
                setTimeout(() => {
                    this.connect();
                }, this.reConnectIntervalInSeconds);
            });
            this.emit('connect', this._connection);
        }
        catch (err) {
            this.emit('error', err);
            setTimeout(() => {
                this.connect();
            }, this.reConnectIntervalInSeconds);
        }
    }
    async close() {
        try {
            this._connection && (await this._connection.close());
        }
        catch (err) {
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
            this.emit('ch_open', this._channel);
        }
        catch (err) {
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
        }
        catch (err) {
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
        const exchangeList = [];
        Object.getOwnPropertyNames(this._exchanges).forEach(async (index) => {
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
    publish({ exchange, key, message, options, }) {
        assert(exchange && key && message, 'exchange、routingKey、message参数不能为空');
        if (!this._channel) {
            throw new Error('the channel is empty');
        }
        return this._channel.publish(exchange, key, Buffer.from(JSON.stringify(message)), Object.assign({}, options));
    }
    prefetch(count) {
        if (!this._channel) {
            throw new Error('the channel is empty');
        }
        return this._channel.prefetch(count);
    }
    sendToQueue(queue, msg, options = {}) {
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
    ack(message, allUpTo = false) {
        if (!this._channel) {
            throw new Error('the channel is empty');
        }
        return this._channel.ack(message, allUpTo);
    }
    nack(message, allUpTo = false, requeue = false) {
        if (!this._channel) {
            throw new Error('the channel is empty');
        }
        return this._channel.nack(message, allUpTo, requeue);
    }
    reject(message, requeue = false) {
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
        Object.getOwnPropertyNames(this._exchanges).forEach(async (index) => {
            const exchange = this._exchanges[index];
            exchangeConfig[exchange.name] = exchange;
        });
        return await Promise.all(Object.getOwnPropertyNames(this._queues).map(async (index) => {
            const queue = this._queues[index];
            const exchange = exchangeConfig[queue.exchange];
            if (exchange) {
                return await this.createBinding(queue, exchange);
            }
        }));
    }
    createAllConsumer() {
        const consumer = this.consumer.bind(this);
        const callbackOptions = this._subscribeCallbackOptions;
        Object.getOwnPropertyNames(this._queues).forEach(async (index) => {
            const queue = this._queues[index];
            if (!queue.autoSubscribe) {
                return;
            }
            await consumer(queue.name, data => {
                const promiseArray = [];
                callbackOptions.forEach(async (option) => {
                    // 如果不设置routingKey，则不作判断
                    if (option.queue === queue.name && (!option.routingKey || data.fields.routingKey === option.routingKey)) {
                        promiseArray.push(await option.callback(data));
                    }
                });
                Promise.all(promiseArray);
            }, queue.subscribeOptions);
        });
    }
    async init() {
        await this.connect(); // 创建连接
        await this.createChannel(); // 创建channel
        if (!this._channel) {
            return;
        }
        await this.assertAllExchange();
        await this.createAllBinding();
        this.createAllConsumer();
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
exports.default = RabbitMQ;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFiYml0bXEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyYWJiaXRtcS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdDQUFnQztBQUVoQyxpQ0FBaUM7QUFDakMsbUNBQXNDO0FBbUJ0QyxNQUFNLFFBQVMsU0FBUSxxQkFBWTtJQUNqQyxZQUFZLE1BQU07UUFDaEIsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMseUJBQXlCLEdBQUcsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUN2QixJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDdEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO1FBQ25DLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM3QixJQUFJLENBQUMsMEJBQTBCLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztJQUN6RCxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU87UUFDWCxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsT0FBTztTQUNSO1FBQ0QsSUFBSTtZQUNGLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxH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