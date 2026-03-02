export const POSTMORTEM_PROMPT = `You are drafting a Post-Incident Review (PIR) document. Follow this protocol:

## Data Collection
Gather all available information:
- Rootly incident details (timeline, root cause, affected services, severity)
- Slack incident channel timeline (key decisions, status updates)
- Customer impact data (number of affected users, blast radius)
- GitHub changes that caused or fixed the issue

## PIR Structure
Draft the document with these sections:

### 1. Incident Summary
- Date, duration, severity
- One-paragraph summary of what happened

### 2. Timeline
- Chronological list of key events from detection to resolution
- Include: alert triggered, incident declared, root cause identified, fix deployed, incident resolved

### 3. Root Cause Analysis
- What was the underlying cause?
- What change or condition triggered the incident?
- Were there contributing factors?

### 4. Impact
- Number of affected users/customers
- Which services were impacted
- Revenue/SLA impact (if known)

### 5. What Went Well
- Effective response actions
- Tools or processes that helped

### 6. What Could Be Improved
- Detection gaps
- Response delays
- Communication issues

### 7. Action Items
- Specific, assignable tasks to prevent recurrence
- Each with an owner suggestion and priority

## Guidelines
- Be factual and blameless -- focus on systems, not individuals
- The draft must be reviewed by the incident commander before publishing
- Create it as a Confluence page draft, not published`;
