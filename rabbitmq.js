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
        assert(exchange && message, 'exchange或message参数不能为空');
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