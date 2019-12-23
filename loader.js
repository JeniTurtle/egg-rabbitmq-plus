"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const assert = require("assert");
const uuidV1 = require("uuid/v1");
const is = require("is-type-of");
const typedi_1 = require("typedi");
const contextId = Symbol('rabbitMqConsumerContextId');
typedi_1.Container.of = function (instanceId) {
    if (instanceId === undefined)
        // @ts-ignore
        return this.globalInstance;
    // @ts-ignore
    var container = this.instances.find(function (instance) { return instance.id === instanceId; });
    if (!container) {
        container = new typedi_1.ContainerInstance(instanceId);
        // @ts-ignore
        container.services.push(...this.globalInstance.services.map(s => (Object.assign(Object.assign({}, s), { value: s.global ? s.value : undefined }))));
        // @ts-ignore
        this.instances.push(container);
    }
    return container;
};
exports.default = app => {
    const dirs = app.loader.getLoadUnits().map(unit => path.join(unit.path, 'app/consumer'));
    dirs.push(...app.config.rabbitmq.consumer.directory);
    const Loader = getConsumerLoader(app);
    const consumers = (app.consumers = {});
    new Loader({
        directory: dirs,
        target: consumers,
        inject: app,
    }).load();
    return consumers;
};
const initCtx = (target, ctx) => {
    target.ctx = ctx;
    target.app = ctx.app;
    target.config = ctx.app.config;
    target.service = ctx.service;
    target[contextId] = ctx[contextId];
};
const injectContext = (obj, ctx) => {
    Object.getOwnPropertyNames(obj).map(prop => {
        if (obj[prop] && typeof obj[prop] === 'object') {
            const type = obj[prop].constructor;
            if (obj[contextId] !== ctx[contextId] && (typedi_1.Container.has(type) || typedi_1.Container.has(type.name))) {
                initCtx(obj[prop], ctx);
                injectContext(obj[prop], ctx);
            }
        }
    });
};
function getConsumerLoader(app) {
    return class ConsumerLoader extends app.loader.FileLoader {
        load() {
            // @ts-ignore
            const target = this.options.target;
            const items = this.parse();
            for (const item of items) {
                const consumer = item.exports;
                const fullpath = item.fullpath;
                const config = consumer.config;
                assert(config, `consumer(${fullpath}): must have config and subscribe properties`);
                assert(config.queue, `consumer(${fullpath}): consumer.config must have queue properties`);
                assert(is.class(consumer) || is.function(consumer.subscribe), `consumer(${fullpath}: consumer.subscribe should be function or consumer should be class`);
                let subscribe;
                if (is.class(consumer)) {
                    subscribe = ctx => async (data) => {
                        ctx[contextId] = uuidV1();
                        const instance = typedi_1.Container.of(ctx[contextId]).get(consumer);
                        injectContext(instance, ctx);
                        initCtx(instance, ctx);
                        instance.subscribe = app.toAsyncFunction(instance.subscribe);
                        return instance.subscribe(data);
                    };
                }
                else {
                    subscribe = () => app.toAsyncFunction(consumer.subscribe);
                }
                const env = app.config.env;
                const envList = config.env;
                if (is.array(envList) && !envList.includes(env)) {
                    app.coreLogger.info(`[egg-rabbitmq]: ignore consumer ${fullpath} due to \`consumer.env\` not match`);
                    continue;
                }
                target[fullpath] = {
                    consumer: config,
                    subscribe,
                    key: fullpath,
                };
            }
            return target;
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLGlDQUFpQztBQUNqQyxrQ0FBa0M7QUFFbEMsaUNBQWtDO0FBQ2xDLG1DQUFzRDtBQUV0RCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQztBQUV0RCxrQkFBUyxDQUFDLEVBQUUsR0FBRyxVQUFVLFVBQVU7SUFDakMsSUFBSSxVQUFVLEtBQUssU0FBUztRQUMxQixhQUFhO1FBQ2IsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQzdCLGFBQWE7SUFDZCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLFFBQVEsSUFBSSxPQUFPLFFBQVEsQ0FBQyxFQUFFLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEcsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNiLFNBQVMsR0FBRyxJQUFJLDBCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLGFBQWE7UUFDZixTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlDQUM3RCxDQUFDLEtBQ0osS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFDTCxhQUFhO1FBQ2YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDL0I7SUFDRCxPQUFPLFNBQVMsQ0FBQztBQUNsQixDQUFDLENBQUM7QUFFRixrQkFBZSxHQUFHLENBQUMsRUFBRTtJQUNuQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMs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