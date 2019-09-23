"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BaseConsumer {
    init(ctx) {
        this.ctx = ctx;
        this.app = ctx.app;
        this.config = ctx.app.config;
        return this;
    }
}
exports.BaseConsumer = BaseConsumer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZUNvbnN1bWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmFzZUNvbnN1bWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsTUFBc0IsWUFBWTtJQUtoQyxJQUFJLENBQUMsR0FBWTtRQUNmLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDN0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBR0Y7QUFiRCxvQ0FhQyJ9