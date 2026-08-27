export class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export class CommandExecutionError extends Error {
  command: string;
  stderr: string;
  exitCode: number;

  constructor(command: string, stderr: string, exitCode: number) {
    super(`Command failed with exit code ${exitCode}`);
    this.name = "CommandExecutionError";
    this.command = command;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}
