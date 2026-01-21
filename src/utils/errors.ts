export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    if (typeof err == "string") return err;
    try {
        return JSON.stringify(err)
    } catch {
        return "Uknown error"
    }
}
export function getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined
}

export function isRetryableError(err: unknown): boolean {
    if (err instanceof Error) {
        return /timeout|ECONNRESET|ETIMEDOUT|ECONNREFUSED|5\d\d/.test(err.message);
    }
    return false
}