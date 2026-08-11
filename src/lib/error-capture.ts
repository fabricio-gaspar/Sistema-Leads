let lastError: any = null;

export function captureError(error: any) {
  lastError = error;
  console.error("Captured error:", error);
}

export function consumeLastCapturedError() {
  const error = lastError;
  lastError = null;
  return error;
}
