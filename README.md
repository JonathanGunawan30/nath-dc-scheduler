# Nath DC Scheduler

Nath DC Scheduler is a small Node.js application that periodically connects to Discord, sends one configured message to one configured channel, disconnects, and schedules the next delivery.

The application includes environment validation, randomized delivery intervals, exponential retry backoff, structured JSON logging, graceful shutdown handling, and automated tests.

## Important notice

> [!CAUTION]
> This project uses `discord.js-selfbot-youtsuho-v13` to automate a regular Discord user account. This behavior violates Discord's rules regarding selfbots and may result in warnings, restricted access, suspension, permanent account termination, or other enforcement action. Owning or managing the destination server or channel does not remove this risk or make user-account automation compliant with Discord's policies.

By downloading, configuring, running, modifying, or distributing this software, you acknowledge that you understand these risks and accept full responsibility for every consequence resulting from its use. The project authors and contributors are not responsible for account enforcement, lost access, deleted data, credential exposure, service disruption, or any other direct or indirect damage.

This project is not affiliated with, endorsed by, sponsored by, or supported by Discord Inc. It is provided as-is, without warranty or any guarantee that it will remain functional, undetected, safe, or compatible with future Discord changes. If you are not prepared to accept these risks, do not use this software.

Review the official Discord policy before running this application:

https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots

Use this project only where you have explicit authorization to post messages. Never use it to send unsolicited messages, evade platform controls, or access channels without permission. The safest supported approach is to use Discord's official bot or webhook APIs.

## Features

- Loads all runtime configuration from `.env`.
- Rejects invalid configuration before loading the Discord client.
- Sends one configured message to one Discord channel.
- Creates a fresh Discord client for every delivery cycle.
- Fetches the target channel instead of relying only on cache state.
- Prevents overlapping delivery cycles in a single process.
- Disconnects the client after success or failure.
- Schedules successful deliveries within a configurable interval.
- Retries failed deliveries with capped exponential backoff.
- Applies a configurable login timeout.
- Produces structured JSON logs with timestamps.
- Handles `SIGINT`, `SIGTERM`, unhandled rejections, and uncaught exceptions.
- Suppresses the known non-actionable `Worker stopped with exit code 1` shutdown error.
- Includes syntax checks and unit tests.

## Requirements

- Node.js 20.12.0 or newer.
- npm.
- A Discord channel ID accessible to the configured account.
- A valid local `.env` file.

The current development environment uses Node.js 24, but the declared minimum version is Node.js 20.12.0 because the application uses the built-in `process.loadEnvFile()` API.

## Project structure

```text
nath-dc-scheduler/
|-- index.js
|-- package.json
|-- package-lock.json
|-- .env
|-- .env.example
|-- .gitignore
|-- src/
|   |-- config.js
|   |-- delays.js
|   |-- logger.js
|   `-- message-scheduler.js
`-- test/
    |-- config.test.js
    |-- delays.test.js
    `-- message-scheduler.test.js
```

### Main files

| File | Responsibility |
| --- | --- |
| `index.js` | Loads configuration, constructs the client and scheduler, and handles process shutdown. |
| `src/config.js` | Reads, validates, normalizes, and freezes environment configuration. |
| `src/delays.js` | Calculates successful delivery intervals and retry backoff delays. |
| `src/logger.js` | Writes structured JSON logs and serializes errors. |
| `src/message-scheduler.js` | Manages scheduling, client lifecycle, channel lookup, message delivery, retry, and disconnect behavior. |
| `test/` | Contains configuration, delay, scheduler, and error-filter tests. |

## Installation

Install the locked dependencies:

```bash
npm install
```

If the platform-specific `@snazzah/davey` binary is missing, install optional dependencies:

```bash
npm install --include=optional
```

The dependency directory is intentionally excluded from Git and can be reconstructed from `package.json` and `package-lock.json`.

## Configuration

Create `.env` from the provided template.

Linux, macOS, or WSL:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Expected layout:

```env
DISCORD_TOKEN=
CHANNEL_ID=
MESSAGE=Promosi item in-game! Cek toko sekarang!
MIN_DELAY_MINUTES=120
MAX_DELAY_MINUTES=180
RETRY_DELAY_MINUTES=5
MAX_RETRY_DELAY_MINUTES=60
LOGIN_TIMEOUT_SECONDS=30
CLIENT_BUILD_NUMBER=66416
```

### Environment variables

| Variable | Required | Description | Validation |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord credential used by the configured client. | Must not be empty. |
| `CHANNEL_ID` | Yes | Destination Discord channel ID. | Must contain 17 to 20 digits. |
| `MESSAGE` | Yes | Message sent during every successful cycle. | Must contain 1 to 2,000 characters after trimming. |
| `MIN_DELAY_MINUTES` | Yes | Minimum delay after a successful delivery. | Must be a positive number and not exceed the maximum delay. |
| `MAX_DELAY_MINUTES` | Yes | Maximum delay after a successful delivery. | Must be a positive number. |
| `RETRY_DELAY_MINUTES` | Yes | Initial delay after the first failed cycle. | Must be a positive number and not exceed the maximum retry delay. |
| `MAX_RETRY_DELAY_MINUTES` | Yes | Upper limit for exponential retry backoff. | Must be a positive number. |
| `LOGIN_TIMEOUT_SECONDS` | Yes | Maximum time allowed for login to complete. | Must be a positive number. |
| `CLIENT_BUILD_NUMBER` | Yes | Numeric client metadata consumed by the current client constructor. | Must be a positive number. |

No runtime defaults are applied. Missing or invalid variables stop the application before it attempts a connection.

## Security

Treat `DISCORD_TOKEN` as a password.

- Never paste the token into source code, logs, issues, chat messages, or documentation.
- Never commit `.env` to version control.
- Rotate the token immediately if it is exposed.
- Restrict access to the machine and user account running the process.
- Avoid printing the environment or inspecting it through shared process-management dashboards.
- Use a dedicated test channel when validating delivery behavior.

The repository ignores `.env` and `node_modules/` through `.gitignore`. The `.env.example` file must remain free of real credentials.

## Running the application

Start the scheduler:

```bash
npm start
```

The process stays active while it waits for the next scheduled cycle. Stop it with `Ctrl+C` or send `SIGTERM` from the process manager.

## Runtime behavior

On startup, the application performs the following sequence:

1. Loads `.env` through Node.js.
2. Validates every required configuration value.
3. Loads the Discord client dependency.
4. Starts a single in-memory scheduler.
5. Runs the first delivery cycle immediately.
6. Creates a new Discord client.
7. Attempts login within `LOGIN_TIMEOUT_SECONDS`.
8. Fetches `CHANNEL_ID`.
9. Verifies that the channel supports message delivery.
10. Sends a typing state when supported by the channel.
11. Applies the configured internal pre-delivery behavior.
12. Sends `MESSAGE`.
13. Applies the internal post-delivery delay.
14. Disconnects the client.
15. Schedules the next successful cycle between `MIN_DELAY_MINUTES` and `MAX_DELAY_MINUTES`.

Only one delivery cycle can run at a time within a single process.

## Retry behavior

When login, channel lookup, or message delivery fails, the application increments a consecutive failure counter and calculates an exponential retry delay.

With the default retry configuration, consecutive failures are scheduled approximately as follows:

| Consecutive failure | Retry delay |
| ---: | ---: |
| 1 | 5 minutes |
| 2 | 10 minutes |
| 3 | 20 minutes |
| 4 | 40 minutes |
| 5 and later | 60 minutes |

The failure counter resets to zero after a successful delivery.

## Logging

Logs are emitted as one JSON object per line. This format can be consumed by a process manager or log aggregation system.

Example:

```json
{"timestamp":"2026-08-28T06:00:00.000Z","level":"info","message":"Siklus dijadwalkan","reason":"deliverySuccess","delayMs":7200000,"nextRunAt":"2026-08-28T08:00:00.000Z"}
```

Typical events include:

- Scheduler startup.
- Next cycle time and scheduling reason.
- Successful login.
- Successful message delivery and returned message ID.
- Client disconnect.
- Delivery failures and retry delays.
- Process shutdown.

The logger does not intentionally include the Discord token or message contents.

## Graceful shutdown

The entry point listens for:

- `SIGINT`, normally produced by `Ctrl+C`.
- `SIGTERM`, commonly sent by containers and process managers.
- Unhandled promise rejections.
- Uncaught exceptions.

During shutdown, the scheduler clears its pending timer and disconnects the active client before assigning the process exit code.

## Development commands

Run syntax checks for every application module:

```bash
npm run check
```

Run all tests:

```bash
npm test
```

Run both before committing:

```bash
npm run check && npm test
```

## Testing

The test suite uses the built-in Node.js test runner and does not require Discord credentials or a live network connection.

Current coverage includes:

- Environment parsing and conversion to milliseconds.
- Required configuration validation.
- Invalid delay-range validation.
- Minimum and maximum randomized schedule boundaries.
- Exponential retry backoff and maximum capping.
- Successful message delivery through a mocked client.
- Client cleanup after success and failure.
- Retry scheduling after a failed delivery.
- Filtering of the known worker shutdown error.

Some scheduler tests execute the current internal delivery delays and can take several seconds. Unit tests do not verify whether a real Discord token is valid or whether the target account has permission to send messages.

## Deployment notes

For a long-running deployment:

- Use a process manager or container restart policy.
- Keep exactly one application instance active for a given destination and message.
- Capture standard output and standard error as JSON logs.
- Ensure the process receives `SIGTERM` and has enough time to shut down.
- Keep `.env` outside source control and restrict its filesystem permissions.
- Monitor repeated `deliveryFailure` events and increasing retry delays.

Do not run multiple replicas without external coordination. Each replica owns an independent in-memory timer and can send duplicate messages.

## Operational limitations

- The next scheduled time is stored only in memory.
- Restarting the process discards the previous schedule and triggers an immediate initial cycle.
- The application supports one token, one channel, and one message per process.
- There is no persistent delivery history or deduplication across restarts.
- There is no health-check endpoint or metrics server.
- In-progress waits are not persisted across shutdowns.
- Real Discord connectivity and channel permissions cannot be covered by offline unit tests.
- The unofficial Discord dependency and its native optional packages may behave differently across Node.js versions and operating systems.
- Client metadata values can become incompatible with future platform or dependency changes.

## Troubleshooting

### Configuration is rejected

Read every item in the `Konfigurasi tidak valid` error. All variables in `.env.example` are required, and numeric variables must contain positive numbers.

### Channel is not found

Confirm that `CHANNEL_ID` contains only the channel ID, the account can access the channel, and the destination supports text messages.

### Login times out

Confirm network connectivity and credential validity. If the connection is consistently slower than the configured limit, review `LOGIN_TIMEOUT_SECONDS`.

### Native binding cannot be loaded

Ensure optional dependencies were installed for the current operating system and architecture:

```bash
npm install --include=optional
```

Do not copy `node_modules` between Windows, WSL, Linux, macOS, or different CPU architectures. Reinstall dependencies in the environment where the application will run.

### Repeated delivery failures

Inspect the structured `Siklus gagal` entry. It contains the serialized error, consecutive failure count, and next retry delay. Check authentication, network connectivity, channel access, and message validity.

### Process sends immediately after restart

This is expected. The schedule is in memory and the initial cycle uses a zero-delay timer. Persistent scheduling would require external storage or a separate scheduler.

## License

No license is currently declared for this project. Add a license file before distributing or accepting external contributions.
