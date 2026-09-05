export type DataQualityIssue = {
  severity: "warning" | "error";
  code: string;
  message: string;
  sourceRow?: number;
};

export type DataQualityReport = {
  isValid: boolean;
  rowsRead: number;
  rowsAccepted: number;
  rowsRejected: number;
  checkedAt: string;
  issues: DataQualityIssue[];
};

export function createQualityReport(input: Omit<DataQualityReport, "isValid" | "checkedAt">): DataQualityReport {
  return {
    ...input,
    isValid: !input.issues.some((issue) => issue.severity === "error"),
    checkedAt: new Date().toISOString(),
  };
}

export function limitedIssueCollector(limit = 50) {
  const issues: DataQualityIssue[] = [];
  return {
    issues,
    add(issue: DataQualityIssue) {
      if (issues.length < limit) issues.push(issue);
    },
  };
}

