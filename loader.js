"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const assert = require("assert");
const is = require("is-type-of");
const typedi_1 = require("typedi");
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
};
const injectContext = (obj, ctx) => {
    Object.getOwnPropertyNames(obj).map(prop => {
        if (obj[prop] && typeof obj[prop] === 'object') {
            const type = obj[prop].constructor;
            if (typedi_1.Container.has(type) || typedi_1.Container.has(type.name)) {
                injectContext(obj[prop], ctx);
                initCtx(obj[prop], ctx);
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
                        const s = typedi_1.Container.get(consumer);
                        injectContext(s, ctx);
                        initCtx(s, ctx);
                        s.subscribe = app.toAsyncFunction(s.subscribe);
                        return s.subscribe(data);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBRTdCLGlDQUFpQztBQUNqQyxpQ0FBa0M7QUFDbEMsbUNBQW1DO0FBRW5DLGtCQUFlLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFDekYsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVyRCxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN0QyxNQUFNLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLENBQUM7UUFDVCxTQUFTLEVBQUUsSUFBSTtRQUNmLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLE1BQU0sRUFBRSxHQUFHO0tBQ1osQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1YsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyxDQUFDO0FBRUYsTUFBTSxPQUFPLEdBQUcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUU7SUFDOUIsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7SUFDakIsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBQ3JCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7SUFDL0IsTUFBTSxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO0FB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