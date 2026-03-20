export class ChildSession {
    constructor(public name: string, private config: { budget: number }) {}
    getBudget() { return this.config.budget; }
}
