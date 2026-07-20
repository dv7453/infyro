const SCOPE_LABELS: Record<string, string> = {
  openid: "Basic profile info",
  email: "Basic profile info",
  profile: "Basic profile info",
  "https://www.googleapis.com/auth/gmail.readonly": "Can read your email",
  "https://www.googleapis.com/auth/gmail.send":
    "Can send email on your behalf",
  "https://www.googleapis.com/auth/calendar.events":
    "Can manage calendar events",
  "https://www.googleapis.com/auth/documents": "Can access Google Docs",
  "https://www.googleapis.com/auth/spreadsheets": "Can access Google Sheets",
  "https://www.googleapis.com/auth/drive.file":
    "Can access files it creates in Drive",
};

export function getScopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

export function getUniqueScopeLabels(scopes: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const scope of scopes) {
    const label = getScopeLabel(scope);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}
