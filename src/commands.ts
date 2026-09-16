/**
 * Command registry. Every user action in the spreadsheet (moving, editing,
 * formatting, clipboard…) is a command so that plugins can override, extend,
 * re-bind, or invoke it programmatically.
 */

export interface CommandContext<Host = unknown> {
  host: Host;
  /** The originating DOM event, if any. */
  event?: Event;
  args?: unknown;
}

export interface Command<Host = unknown> {
  id: string;
  /** Human-readable label (used for menus/tooltips). */
  label?: string;
  run: (ctx: CommandContext<Host>) => void | boolean | Promise<void | boolean>;
  isEnabled?: (ctx: CommandContext<Host>) => boolean;
}

export class CommandRegistry<Host = unknown> {
  private commands = new Map<string, Command<Host>>();

  constructor(private readonly host: Host) {}

  register(command: Command<Host>): () => void {
    this.commands.set(command.id, command);
    return () => {
      if (this.commands.get(command.id) === command) this.commands.delete(command.id);
    };
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  get(id: string): Command<Host> | undefined {
    return this.commands.get(id);
  }

  list(): Command<Host>[] {
    return Array.from(this.commands.values());
  }

  isEnabled(id: string, extra: Partial<CommandContext<Host>> = {}): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    return cmd.isEnabled ? cmd.isEnabled({ host: this.host, ...extra }) : true;
  }

  /** Execute a command. Returns false when the command is missing or disabled. */
  execute(id: string, extra: Partial<CommandContext<Host>> = {}): boolean | Promise<boolean> {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    const ctx: CommandContext<Host> = { host: this.host, ...extra };
    if (cmd.isEnabled && !cmd.isEnabled(ctx)) return false;
    const result = cmd.run(ctx);
    if (result instanceof Promise) return result.then((r) => r !== false);
    return result !== false;
  }
}
