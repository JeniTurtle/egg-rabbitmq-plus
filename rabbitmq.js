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
            await this.assertAllExchange();
            await this.createAllBinding();
            this.createAllConsumer();
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
            exchangeList.push(this.assertExchange(exchange.name, exchange.type, exchange.options));
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
        return this._channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), options);
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
            await this.bindQueue(queue.name, exchange.name);
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
                return this.createBinding(queue, exchange);
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
            await consumer(queue.name, async (data) => {
                const promiseArray = [];
                callbackOptions.forEach(async (option) => {
                    // 如果不设置routingKey，则不作判断
                    if (option.queue === queue.name && (!option.routingKey || data.fields.routingKey === option.routingKey)) {
                        promiseArray.push(option.callback(data));
                    }
                });
                await Promise.all(promiseArray);
            }, queue.subscribeOptions);
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
exports.default = RabbitMQ;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFiYml0bXEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyYWJiaXRtcS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdDQUFnQztBQUVoQyxpQ0FBaUM7QUFDakMsbUNBQXNDO0FBbUJ0QyxNQUFNLFFBQVMsU0FBUSxxQkFBWTtJQUNqQyxZQUFZLE1BQU07UUFDaEIsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMseUJBQXlCLEdBQUcsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUN2QixJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDdEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO1FBQ25DLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM3QixJQUFJLENBQUMsMEJBQTBCLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztJQUN6RCxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU87UUFDWCxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsT0FBTztTQUNSO1FBQ0QsSUFBSTtZQUNGLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxH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