let lastCapturedError: any = null;

export const captureError = (error: any) => {
  lastCapturedError = error;
  console.error("Captured Error:", error);
};

export const getLastCapturedError = () => lastCapturedError;
export const clearLastCapturedError = () => { lastCapturedError = null; };
