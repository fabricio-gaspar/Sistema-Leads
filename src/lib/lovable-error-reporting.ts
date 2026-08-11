export const reportLovableError = (error: any, context?: any) => {
  console.error("Lovable Error:", error, context);
};

export const reportError = reportLovableError;
