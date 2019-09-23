"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rabbitmq_1 = require("./rabbitmq");
const loader_1 = require("./loader");
const assert = require("assert");
const qs = require("querystring");
exports.default = app => {
    if (app.config.rabbitmq) {
        app.addSingleton('rabbitmq', createRabbitMQ);
    }
};
function registerConsumer(app, client, consumers) {
    for (const key in consumers) {
        const consumer = consumers[key];
        const { queue, routingKey } = consumer.consumer;
        if (consumer.consumer.disable) {
            continue;
        }
        app.logger.info('[egg-rabbitmq]: register consumer %s', consumer.key);
        const ctx = app.createAnonymousContext({
            method: 'CONSUMER',
            url: `/__consumer?path=${key}&${qs.stringify(consumer.consumer)}`,
        });
        const subscribe = consumer.subscribe(ctx);
        client.registerSubscribe(queue, routingKey, subscribe);
    }
}
function createRabbitMQ(config, app) {
    assert(config.url && config.exchanges && config.queues);
    const client = new rabbitmq_1.default(config);
    const consumers = loader_1.default(app);
    client.on('connect', connection => {
        app.logger.info('[egg-rabbitmq] server connected! connection=' +
            connection.connection.stream.localAddress +
            ':' +
            connection.connection.stream.localPort);
    });
    client.on('close', error => {
        app.logger.info('[egg-rabbitmq] connection closed due to error:', error);
    });
    client.on('error', error => {
        app.logger.error('[egg-rabbitmq] connection error:', error);
    });
    client.on('ch_open', _channel => {
        app.logger.info('[egg-rabbitmq] channel opened!');
    });
    client.on('ch_close', () => {
        app.logger.info('[egg-rabbitmq] channel closed');
    });
    client.on('ch_error', error => {
        app.logger.error('[egg-rabbitmq] channel error:', error);
    });
    client.on('ch_drain', () => {
        app.logger.error('[egg-rabbitmq] channel drain event');
    });
    app.beforeStart(async () => {
        // 注册消费者
        registerConsumer(app, client, consumers);
        await client.init();
    });
    return client;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUNBQWtDO0FBQ2xDLHFDQUFzQztBQUN0QyxpQ0FBaUM7QUFDakMsa0NBQWtDO0FBRWxDLGtCQUFlLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDdkIsR0FBRyxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLENBQUM7S0FDOUM7QUFDSCxDQUFDLENBQUM7QUFFRixTQUFTLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsU0FBUztJQUM5QyxLQUFLLE1BQU0sR0FBRyxJQUFJLFNBQVMsRUFBRTtRQUMzQixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEMsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDO1FBQ2hELElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUU7WUFDN0IsU0FBUztTQUNWO1FBQ0QsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsc0NBQXNDLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQztZQUNyQyxNQUFNLEVBQUUsVUFBVTtZQUNsQixHQUFHLEVBQUUsb0JBQW9CLEdBQUcsSUFBSSxFQUFFLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRTtTQUNsRSxDQUFDLENBQUM7UUFDSCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ3hEO0FBQ0gsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHO0lBQ2pDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELE1BQU0sTUFBTSxHQUFHLElBQUksa0JBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwQyxNQUFNLFNBQVMsR0FBRyxnQkFBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXRDLE1BQU0sQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxFQUFFO1FBQ2hDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLDhDQUE4QztZQUM1QyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxZQUFZO1lBQ3pDLEdBQUc7WUFDSCxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQ3pDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzNFLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEVBQUU7UUFDekIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUM5QixHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFO1FBQ3pCLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsRUFBRTtRQUM1QixHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMzRCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRTtRQUN6QixHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUN6QixRQUFRO1FBQ1IsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN6QyxNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0QixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMifQ==